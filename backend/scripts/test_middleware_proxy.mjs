import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendDir = path.resolve(__dirname, '..')

const BASE_URL = 'http://localhost:4000'

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/products`)
      if (res.status === 200 || res.status === 401) {
        return true
      }
    } catch (e) {
      // not ready yet
    }
    await sleep(1000)
  }
  return false
}

async function runTests() {
  console.log('--- Starting Next.js 16 Backend on Port 4000 ---')
  const nextProcess = spawn('npx.cmd', ['next', 'start', '-p', '4000'], {
    cwd: backendDir,
    stdio: 'pipe',
    shell: true,
  })

  let output = ''
  nextProcess.stdout.on('data', (d) => {
    output += d.toString()
  })
  nextProcess.stderr.on('data', (d) => {
    output += d.toString()
  })

  try {
    const isReady = await waitForServer(35)
    if (!isReady) {
      console.error('Backend failed to start. Logs:\n', output)
      process.exit(1)
    }
    console.log('✓ Backend started successfully and is ready on port 4000\n')

    let allPassed = true
    function assert(cond, msg) {
      if (!cond) {
        console.error(`❌ FAIL: ${msg}`)
        allPassed = false
      } else {
        console.log(`✓ PASS: ${msg}`)
      }
    }

    console.log('--- 1. Testing OPTIONS Preflight & CORS Headers (User, Admin, Superadmin) ---')
    // 1. User preflight
    const preflightUser = await fetch(`${BASE_URL}/api/products`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    })
    assert(preflightUser.status === 204, `User preflight status is 204 (got ${preflightUser.status})`)
    assert(
      preflightUser.headers.get('access-control-allow-origin') === 'http://localhost:3000',
      `User preflight allow-origin header is http://localhost:3000 (got ${preflightUser.headers.get('access-control-allow-origin')})`
    )
    assert(
      preflightUser.headers.get('access-control-allow-credentials') === 'true',
      'User preflight allow-credentials is true'
    )
    assert(
      preflightUser.headers.get('access-control-allow-methods') === 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'User preflight allow-methods includes all expected methods'
    )

    // 2. Admin preflight
    const preflightAdmin = await fetch(`${BASE_URL}/api/restaurants`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3001',
        'Access-Control-Request-Method': 'GET',
      },
    })
    assert(preflightAdmin.status === 204, `Admin preflight status is 204 (got ${preflightAdmin.status})`)
    assert(
      preflightAdmin.headers.get('access-control-allow-origin') === 'http://localhost:3001',
      `Admin preflight allow-origin header is http://localhost:3001 (got ${preflightAdmin.headers.get('access-control-allow-origin')})`
    )

    // 3. Superadmin preflight
    const preflightSuperadmin = await fetch(`${BASE_URL}/api/messages`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3002',
        'Access-Control-Request-Method': 'POST',
      },
    })
    assert(preflightSuperadmin.status === 204, `Superadmin preflight status is 204 (got ${preflightSuperadmin.status})`)
    assert(
      preflightSuperadmin.headers.get('access-control-allow-origin') === 'http://localhost:3002',
      `Superadmin preflight allow-origin header is http://localhost:3002 (got ${preflightSuperadmin.headers.get('access-control-allow-origin')})`
    )

    console.log('\n--- 2. Testing Simple API Requests & Dynamic CORS Origin Assignment ---')
    // User request (GET /api/products)
    const resUser = await fetch(`${BASE_URL}/api/products`, {
      headers: { 'Origin': 'http://localhost:3000' },
    })
    assert(resUser.status === 200, `User API request status is 200 (got ${resUser.status})`)
    assert(
      resUser.headers.get('access-control-allow-origin') === 'http://localhost:3000',
      'User API response origin header matched http://localhost:3000'
    )
    const userData = await resUser.json()
    assert(userData.success === true && Array.isArray(userData.products), 'User API response payload is intact')

    // Admin request (GET /api/restaurants)
    const resAdmin = await fetch(`${BASE_URL}/api/restaurants`, {
      headers: { 'Origin': 'http://localhost:3001' },
    })
    assert(resAdmin.status === 200, `Admin API request status is 200 (got ${resAdmin.status})`)
    assert(
      resAdmin.headers.get('access-control-allow-origin') === 'http://localhost:3001',
      'Admin API response origin header matched http://localhost:3001'
    )

    // Superadmin request (GET /api/messages)
    const resSuperadmin = await fetch(`${BASE_URL}/api/messages`, {
      headers: { 'Origin': 'http://localhost:3002' },
    })
    assert(resSuperadmin.status === 200, `Superadmin API request status is 200 (got ${resSuperadmin.status})`)
    assert(
      resSuperadmin.headers.get('access-control-allow-origin') === 'http://localhost:3002',
      'Superadmin API response origin header matched http://localhost:3002'
    )

    // 127.0.0.1 origins
    const res127 = await fetch(`${BASE_URL}/api/products`, {
      headers: { 'Origin': 'http://127.0.0.1:3000' },
    })
    assert(
      res127.headers.get('access-control-allow-origin') === 'http://127.0.0.1:3000',
      '127.0.0.1:3000 origin correctly allowed and reflected'
    )

    console.log('\n--- 3. Testing Disallowed Origin Security ---')
    const resDisallowed = await fetch(`${BASE_URL}/api/products`, {
      headers: { 'Origin': 'http://malicious-origin.com' },
    })
    assert(
      resDisallowed.headers.get('access-control-allow-origin') === null,
      'Disallowed origin does NOT receive Access-Control-Allow-Origin header'
    )

    console.log('\n--- 4. Testing Unauthorized Requests (Auth/Authz Preservation) ---')
    // Unauthorized POST to /api/products
    const unauthPostProduct = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ name: 'Hacked dish' }),
    })
    assert(
      unauthPostProduct.status === 401,
      `Unauthorized POST /api/products rejected with 401 (got ${unauthPostProduct.status})`
    )
    assert(
      unauthPostProduct.headers.get('access-control-allow-origin') === 'http://localhost:3000',
      '401 response retains CORS headers for allowed client'
    )

    // Unauthorized GET to admin stats
    const unauthAdminStats = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { 'Origin': 'http://localhost:3001' },
    })
    assert(
      unauthAdminStats.status === 401,
      `Unauthorized GET /api/admin/stats rejected with 401 (got ${unauthAdminStats.status})`
    )

    // Unauthorized GET to superadmin stats
    const unauthSuperStats = await fetch(`${BASE_URL}/api/superadmin/stats`, {
      headers: { 'Origin': 'http://localhost:3002' },
    })
    assert(
      unauthSuperStats.status === 401,
      `Unauthorized GET /api/superadmin/stats rejected with 401 (got ${unauthSuperStats.status})`
    )

    if (allPassed) {
      console.log('\n✅ ALL BACKEND PROXY & CORS TESTS PASSED!')
    } else {
      console.error('\n❌ SOME TESTS FAILED!')
      process.exit(1)
    }
  } finally {
    console.log('\n--- Shutting Down Backend Server ---')
    // On Windows, killing process tree
    try {
      if (nextProcess.pid) {
        spawn('taskkill', ['/pid', nextProcess.pid.toString(), '/f', '/t'])
      }
    } catch (e) {
      nextProcess.kill()
    }
  }
}

runTests().catch((err) => {
  console.error('Test suite error:', err)
  process.exit(1)
})

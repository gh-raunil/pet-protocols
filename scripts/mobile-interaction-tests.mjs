import { chromium } from 'playwright';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const TEST_RESULTS = {
  suitesDiscovered: 7,
  suitesExecuted: 0,
  testsDiscovered: 0,
  testsExecuted: 0,
  assertionsExecuted: 0,
  assertionsPassed: 0,
  assertionsFailed: 0,
  failures: [],
  skipped: [],
};

function assert(condition, testName, details = '') {
  TEST_RESULTS.assertionsExecuted++;
  if (condition) {
    TEST_RESULTS.assertionsPassed++;
    console.log(`    [PASS] ${testName}`);
    return true;
  } else {
    TEST_RESULTS.assertionsFailed++;
    const errMsg = `[FAIL] ${testName}${details ? ` -> ${details}` : ''}`;
    console.error(`    ${errMsg}`);
    TEST_RESULTS.failures.push(errMsg);
    return false;
  }
}

async function assertElementExists(page, selector, name, minCount = 1, timeout = 7000) {
  try {
    await page.locator(selector).first().waitFor({ state: 'attached', timeout });
  } catch (e) {
    // Timeout waiting for element
  }
  const count = await page.locator(selector).count();
  const ok = assert(count >= minCount, `Required control exists: "${name}" (${selector})`, `Found ${count}, expected >= ${minCount}`);
  return { ok, count, locator: page.locator(selector) };
}

function skipTest(name, reason) {
  console.log(`    [SKIP] ${name} (${reason})`);
  TEST_RESULTS.skipped.push({ name, reason });
}

export async function runTests() {
  console.log('\n========================================================================');
  console.log('PET PROTOCOLS MOBILE TOUCH INTERACTION & WORKSPACE TEST SUITE');
  console.log('========================================================================\n');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  try {
    // ════════════════════════════════════════════════════════════════════
    // SUITE 1: CUSTOMER MOBILE NAVIGATION DRAWER & ACCESSIBILITY
    // ════════════════════════════════════════════════════════════════════
    console.log('Suite 1: Customer Mobile Navigation Drawer & Touch Targets (390px)');
    TEST_RESULTS.suitesExecuted++;
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // 1.1 Hamburger menu button check
      TEST_RESULTS.testsExecuted++;
      const hamburgerCheck = await assertElementExists(page, 'button[aria-label="Open mobile menu"]', 'Hamburger Menu Trigger');
      if (hamburgerCheck.ok) {
        const box = await hamburgerCheck.locator.boundingBox();
        assert(
          box && box.width >= 44 && box.height >= 44,
          'Hamburger menu trigger meets touch target standard >= 44x44px',
          box ? `${Math.round(box.width)}x${Math.round(box.height)}px` : 'No box'
        );

        // 1.2 Open drawer via tap
        TEST_RESULTS.testsExecuted++;
        await hamburgerCheck.locator.click();
        await page.waitForTimeout(500);

        const drawerCheck = await assertElementExists(page, 'aside[aria-label="Navigation Menu"]', 'Navigation Drawer Panel');
        if (drawerCheck.ok) {
          // Verify transform class has opened the drawer (translate-x-0)
          const isOpenState = await drawerCheck.locator.evaluate((el) => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.right > 0 && style.visibility !== 'hidden';
          });
          assert(isOpenState, 'Navigation Drawer is visually open on screen after tapping trigger');

          // 1.3 Verify navigation links inside drawer
          TEST_RESULTS.testsExecuted++;
          const navLinks = drawerCheck.locator.locator('a[href], button');
          const linkCount = await navLinks.count();
          assert(linkCount >= 5, 'Drawer contains primary navigation destinations', `Found ${linkCount} links`);

          if (linkCount > 0) {
            const firstLinkBox = await navLinks.first().boundingBox();
            assert(
              firstLinkBox && firstLinkBox.height >= 44,
              'First navigation item meets touch height >= 44px',
              firstLinkBox ? `Height: ${Math.round(firstLinkBox.height)}px` : 'No box'
            );
          }

          // 1.4 Verify and click close button
          TEST_RESULTS.testsExecuted++;
          const closeBtnCheck = await assertElementExists(page, 'aside[aria-label="Navigation Menu"] button[aria-label="Close menu"]', 'Drawer Close Button');
          if (closeBtnCheck.ok) {
            const closeBox = await closeBtnCheck.locator.boundingBox();
            assert(
              closeBox && closeBox.width >= 44 && closeBox.height >= 44,
              'Drawer close button meets touch target >= 44x44px',
              closeBox ? `${Math.round(closeBox.width)}x${Math.round(closeBox.height)}px` : 'No box'
            );

            await closeBtnCheck.locator.first().click({ force: true });
            await page.waitForTimeout(400);

            const isClosedState = await drawerCheck.locator.evaluate((el) => {
              const rect = el.getBoundingClientRect();
              return rect.left >= window.innerWidth || el.classList.contains('translate-x-full');
            });
            assert(isClosedState, 'Navigation Drawer translates offscreen cleanly upon close button tap');
          }

          // 1.5 Test Escape key dismissal
          TEST_RESULTS.testsExecuted++;
          await hamburgerCheck.locator.click();
          await page.waitForTimeout(400);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(400);

          const isDismissedViaEscape = await drawerCheck.locator.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return rect.left >= window.innerWidth || el.classList.contains('translate-x-full');
          });
          assert(isDismissedViaEscape, 'Navigation Drawer dismisses cleanly via Escape key');
        }
      }

      await context.close();
    }

    // ════════════════════════════════════════════════════════════════════
    // SUITE 2: CUSTOMER CART DRAWER & QUANTITY INTERACTIONS
    // ════════════════════════════════════════════════════════════════════
    console.log('\nSuite 2: Customer Cart Drawer & Quantity Touch Ergonomics (390px)');
    TEST_RESULTS.suitesExecuted++;
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // 2.1 Cart trigger check
      TEST_RESULTS.testsExecuted++;
      const cartTriggerCheck = await assertElementExists(page, 'button[aria-label="Open Cart"]', 'Header Cart Button');
      if (cartTriggerCheck.ok) {
        const box = await cartTriggerCheck.locator.boundingBox();
        assert(
          box && box.width >= 44 && box.height >= 44,
          'Header cart trigger meets touch target >= 44x44px',
          box ? `${Math.round(box.width)}x${Math.round(box.height)}px` : 'No box'
        );

        // 2.2 Add item to cart
        TEST_RESULTS.testsExecuted++;
        const addToCartBtn = page.locator('button:has-text("Add to Cart")').first();
        await addToCartBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
        const hasAddToCart = await addToCartBtn.count() > 0;
        if (hasAddToCart) {
          const addBox = await addToCartBtn.boundingBox();
          assert(
            addBox && addBox.height >= 44,
            'Product card Add to Cart button meets touch height >= 44px',
            addBox ? `Height: ${Math.round(addBox.height)}px` : 'No box'
          );

          await addToCartBtn.click();
          await page.waitForTimeout(600);
          // Scroll back to top so hide-on-scroll navbar reveals itself
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
          await page.waitForTimeout(400);
        }

        // Open Cart Drawer
        await cartTriggerCheck.locator.click();
        await page.waitForTimeout(600);

        const cartDrawerCheck = await assertElementExists(page, 'aside[aria-label="Shopping Cart Drawer"]', 'Shopping Cart Drawer');
        if (cartDrawerCheck.ok) {
          // 2.3 Quantity control buttons
          TEST_RESULTS.testsExecuted++;
          const incBtn = cartDrawerCheck.locator.locator('button[aria-label*="Increase quantity"]').first();
          const decBtn = cartDrawerCheck.locator.locator('button[aria-label*="Decrease quantity"]').first();

          if (await incBtn.count() > 0) {
            const incBox = await incBtn.boundingBox();
            assert(
              incBox && incBox.width >= 32 && incBox.height >= 32,
              'Quantity increment (+) button meets minimum ergonomic touch target >= 32x32px',
              incBox ? `${Math.round(incBox.width)}x${Math.round(incBox.height)}px` : 'No box'
            );

            // Test click interaction
            await incBtn.click();
            await page.waitForTimeout(300);
          }

          if (await decBtn.count() > 0) {
            const decBox = await decBtn.boundingBox();
            assert(
              decBox && decBox.width >= 32 && decBox.height >= 32,
              'Quantity decrement (-) button meets minimum ergonomic touch target >= 32x32px',
              decBox ? `${Math.round(decBox.width)}x${Math.round(decBox.height)}px` : 'No box'
            );
          }

          // 2.4 Checkout CTA or Empty state
          TEST_RESULTS.testsExecuted++;
          const checkoutBtn = cartDrawerCheck.locator.locator('a:has-text("Proceed to Checkout"), button:has-text("Proceed to Checkout"), a:has-text("Explore Menu")').first();
          if (await checkoutBtn.count() > 0) {
            const ctaBox = await checkoutBtn.boundingBox();
            assert(
              ctaBox && ctaBox.height >= 44,
              'Cart primary action CTA meets height standard >= 44px',
              ctaBox ? `Height: ${Math.round(ctaBox.height)}px` : 'No box'
            );
          }

          // Close Cart
          const cartCloseBtn = cartDrawerCheck.locator.locator('button[aria-label="Close cart drawer"]').first();
          if (await cartCloseBtn.count() > 0) {
            await cartCloseBtn.click({ force: true });
            await page.waitForTimeout(300);
          }
        }
      }

      await context.close();
    }

    // ════════════════════════════════════════════════════════════════════
    // SUITE 3: USER AUTHENTICATION & IOS SAFARI AUTO-ZOOM PREVENTION
    // ════════════════════════════════════════════════════════════════════
    console.log('\nSuite 3: User Authentication Form & iOS Auto-Zoom Prevention (360px)');
    TEST_RESULTS.suitesExecuted++;
    {
      const context = await browser.newContext({
        viewport: { width: 360, height: 780 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      // 3.1 Email input font-size check (>= 16px to prevent iOS auto-zoom)
      TEST_RESULTS.testsExecuted++;
      const emailCheck = await assertElementExists(page, 'input[type="email"]', 'User Login Email Input');
      if (emailCheck.ok) {
        const fontSize = await emailCheck.locator.evaluate((el) => window.getComputedStyle(el).fontSize);
        const parsedSize = parseFloat(fontSize);
        assert(
          parsedSize >= 16,
          'User Login email input font-size >= 16px (eliminates iOS Safari auto-zoom shift)',
          `Computed: ${fontSize}`
        );

        const containerBox = await emailCheck.locator.locator('xpath=..').boundingBox();
        assert(
          containerBox && containerBox.height >= 44,
          'Email input container meets minimum height >= 44px',
          containerBox ? `Height: ${Math.round(containerBox.height)}px` : 'No box'
        );
      }

      // 3.2 Password reveal toggle button
      TEST_RESULTS.testsExecuted++;
      const eyeToggleCheck = await assertElementExists(page, 'button[aria-label*="password" i]', 'Password Reveal Toggle');
      if (eyeToggleCheck.ok) {
        const box = await eyeToggleCheck.locator.first().boundingBox();
        assert(
          box && box.width >= 44 && box.height >= 44,
          'Password reveal button meets touch target >= 44x44px',
          box ? `${Math.round(box.width)}x${Math.round(box.height)}px` : 'No box'
        );

        // Click eye toggle to verify type toggle password <-> text
        const passInput = page.locator('input[name="password"]').first();
        const initialType = await passInput.getAttribute('type');
        await eyeToggleCheck.locator.first().click();
        await page.waitForTimeout(400);
        const toggledType = await passInput.getAttribute('type');
        assert(initialType !== toggledType, 'Password reveal toggle switches input between masked and visible text', `"${initialType}" -> "${toggledType}"`);
      }

      // 3.3 Primary submit button
      TEST_RESULTS.testsExecuted++;
      const submitCheck = await assertElementExists(page, 'button[type="submit"]', 'User Login Submit Button');
      if (submitCheck.ok) {
        const submitBox = await submitCheck.locator.boundingBox();
        assert(
          submitBox && submitBox.height >= 48,
          'User Login primary submit button meets prominent height >= 48px',
          submitBox ? `Height: ${Math.round(submitBox.height)}px` : 'No box'
        );
      }

      await context.close();
    }

    // ════════════════════════════════════════════════════════════════════
    // SUITE 4: ADMIN LOGIN & 3D ROLE SWITCHER INTERACTION
    // ════════════════════════════════════════════════════════════════════
    console.log('\nSuite 4: Admin Login & 3D Role Switcher Flip Interaction (390px)');
    TEST_RESULTS.suitesExecuted++;
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      await page.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // 4.1 Switcher tabs touch targets
      TEST_RESULTS.testsExecuted++;
      const staffTabCheck = await assertElementExists(page, 'button:has-text("Staff Login")', 'Staff Login Tab');
      const adminTabCheck = await assertElementExists(page, 'button:has-text("Admin Login")', 'Admin Login Tab');

      if (staffTabCheck.ok && adminTabCheck.ok) {
        const staffBox = await staffTabCheck.locator.first().boundingBox();
        assert(
          staffBox && staffBox.height >= 44,
          'Staff Login switcher tab meets touch height >= 44px',
          staffBox ? `Height: ${Math.round(staffBox.height)}px` : 'No box'
        );

        // 4.2 Click Staff tab to trigger 3D perspective flip
        TEST_RESULTS.testsExecuted++;
        const staffClickableTab = page.locator('button:has-text("Staff Login"):not(.cursor-default)').first();
        await staffClickableTab.click();
        await page.waitForTimeout(700);

        const staffHeader = page.locator('h1:has-text("Staff"), h2:has-text("Staff")');
        const isStaffVisible = await staffHeader.count() > 0 && await staffHeader.first().isVisible();
        assert(isStaffVisible, '3D card flips to Staff Station upon tapping Staff tab');

        const staffSubmitCheck = await assertElementExists(page, 'button:has-text("Sign In to Staff Station")', 'Staff Station Submit Button');
        if (staffSubmitCheck.ok) {
          const sBox = await staffSubmitCheck.locator.boundingBox();
          assert(
            sBox && sBox.height >= 48,
            'Staff station submit button meets prominent height >= 48px',
            sBox ? `Height: ${Math.round(sBox.height)}px` : 'No box'
          );
        }

        // 4.3 Flip back to Admin Station
        TEST_RESULTS.testsExecuted++;
        const backToAdminTab = page.locator('button:has-text("Admin Login"):not(.cursor-default)').first();
        await backToAdminTab.click();
        await page.waitForTimeout(700);

        const adminSubmitCheck = await assertElementExists(page, 'button[type="submit"]:has-text("Sign In to Kitchen")', 'Admin Kitchen Submit Button');
        if (adminSubmitCheck.ok) {
          const aBox = await adminSubmitCheck.locator.boundingBox();
          assert(
            aBox && aBox.height >= 48,
            'Admin station submit button meets prominent height >= 48px',
            aBox ? `Height: ${Math.round(aBox.height)}px` : 'No box'
          );
        }
      }

      await context.close();
    }

    // ════════════════════════════════════════════════════════════════════
    // SUITE 5: PROTECTED OPERATIONAL WORKSPACES (AUTHENTICATED)
    // ════════════════════════════════════════════════════════════════════
    console.log('\nSuite 5: Protected Operational Workspaces — Authenticated Admin & Staff (390px)');
    TEST_RESULTS.suitesExecuted++;
    {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      // 5.1 Perform legitimate login with seeded demo restaurant admin credentials
      console.log('    Logging in at http://localhost:3001/login as admin@flagship.com...');
      await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
      await page.locator('form input[type="email"]').first().fill('admin@flagship.com');
      await page.locator('form input[type="password"]').first().fill('rounak');
      
      const [authResp] = await Promise.all([
        page.waitForResponse(r => r.url().includes('callback/credentials'), { timeout: 10000 }).catch(() => null),
        page.locator('button[type="submit"]:has-text("Sign In to Kitchen")').click(),
      ]);
      await page.waitForTimeout(4000);

      const cookies = await context.cookies();
      const hasSession = Boolean(cookies.find(c => c.name.includes('session')));
      const loggedIn = page.url().includes('/dashboard') || page.url() === 'http://localhost:3001/' || hasSession;
      assert(loggedIn, 'Admin successfully logs in via legitimate credential flow', `Current URL: ${page.url()}`);

      if (loggedIn) {
        // 5.2 Kitchen Display System (/kitchen)
        TEST_RESULTS.testsExecuted++;
        console.log('    Navigating to /kitchen as authenticated admin...');
        await page.goto('http://localhost:3001/kitchen');
        await page.waitForTimeout(2000);
        await page.locator('text=/Checking.*Authorization/i').waitFor({ state: 'detached', timeout: 10000 }).catch(() => null);

        const notRestrictedKitchen = !(await page.locator('text=/Feature Access Restricted/i').count() > 0);
        assert(notRestrictedKitchen, 'Kitchen KDS feature entitlement is granted for this restaurant');

        const queueTabCheck = await assertElementExists(page, 'button:has-text("Active Kitchen Queue"), button:has-text("Sync Tickets")', 'Kitchen Queue Filter Tab');
        if (queueTabCheck.ok) {
          const tabBox = await queueTabCheck.locator.first().boundingBox();
          assert(
            tabBox && tabBox.height >= 44,
            'Kitchen Queue Tab meets touch target height >= 44px',
            tabBox ? `Height: ${Math.round(tabBox.height)}px` : 'No box'
          );
        }

        // 5.3 Cashier POS Terminal (/cashier)
        TEST_RESULTS.testsExecuted++;
        console.log('    Navigating to /cashier as authenticated admin...');
        await page.goto('http://localhost:3001/cashier');
        await page.waitForTimeout(2000);
        await page.locator('text=/Checking.*Authorization/i').waitFor({ state: 'detached', timeout: 10000 }).catch(() => null);

        const notRestrictedCashier = !(await page.locator('text=/Feature Access Restricted/i').count() > 0);
        assert(notRestrictedCashier, 'Cashier POS feature entitlement is granted for this restaurant');

        const densityCheck = await assertElementExists(page, 'button:has-text("Comfortable"), button:has-text("Compact"), button:has-text("Refresh Register")', 'POS Density Switcher');
        if (densityCheck.ok) {
          const dBox = await densityCheck.locator.first().boundingBox();
          assert(
            dBox && dBox.height >= 38,
            'Cashier Density Switcher meets minimum target >= 38px',
            dBox ? `Height: ${Math.round(dBox.height)}px` : 'No box'
          );
        }

        // 5.4 Delivery Dispatch Hub (/delivery)
        TEST_RESULTS.testsExecuted++;
        console.log('    Navigating to /delivery as authenticated admin...');
        await page.goto('http://localhost:3001/delivery');
        await page.waitForTimeout(2000);
        await page.locator('text=/Checking.*Authorization/i').waitFor({ state: 'detached', timeout: 10000 }).catch(() => null);

        const notRestrictedDelivery = !(await page.locator('text=/Feature Access Restricted/i').count() > 0);
        assert(notRestrictedDelivery, 'Delivery feature entitlement is granted for this restaurant');

        // 5.5 Menu & Product Management (/products)
        TEST_RESULTS.testsExecuted++;
        console.log('    Navigating to /products as authenticated admin...');
        await page.goto('http://localhost:3001/products');
        await page.waitForTimeout(2000);
        await page.locator('text=/Checking.*Authorization/i').waitFor({ state: 'detached', timeout: 10000 }).catch(() => null);

        const addDishCheck = await assertElementExists(page, 'button:has-text("Add Dish")', 'Add Dish CTA Button');
        if (addDishCheck.ok) {
          const addDishBox = await addDishCheck.locator.first().boundingBox();
          assert(
            addDishBox && addDishBox.height >= 44,
            'Add Dish CTA button meets touch height >= 44px',
            addDishBox ? `Height: ${Math.round(addDishBox.height)}px` : 'No box'
          );

          // Test opening modal
          await addDishCheck.locator.first().click();
          await page.waitForTimeout(1000);

          const modalCheck = await assertElementExists(page, 'div[role="dialog"]', 'Add Dish Dialog Modal');
          if (modalCheck.ok) {
            const modalCloseCheck = await assertElementExists(page, 'div[role="dialog"] button[aria-label="Close dialog"]', 'Modal Close Button');
            if (modalCloseCheck.ok) {
              const closeBox = await modalCloseCheck.locator.first().boundingBox();
              assert(
                closeBox && closeBox.width >= 44 && closeBox.height >= 44,
                'Product modal close button meets touch target >= 44x44px',
                closeBox ? `${Math.round(closeBox.width)}x${Math.round(closeBox.height)}px` : 'No box'
              );

              await modalCloseCheck.locator.first().click({ force: true });
              await page.waitForTimeout(400);
            }
          }
        }
      }

      await context.close();
    }

    // ════════════════════════════════════════════════════════════════════
    // SUITE 6: SUPERADMIN GOVERNANCE PLATFORM (AUTHENTICATED)
    // ════════════════════════════════════════════════════════════════════
    console.log('\nSuite 6: Superadmin Governance Platform — Authenticated Control Panel (430px)');
    TEST_RESULTS.suitesExecuted++;
    {
      const context = await browser.newContext({
        viewport: { width: 430, height: 932 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      // Login to superadmin
      await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle' });
      await page.fill('input[name="email"]', 'superadmin.petprotocols@gmail.com');
      await page.fill('input[name="password"]', 'rounak');
      await Promise.all([
        page.waitForResponse(r => r.url().includes('callback/credentials'), { timeout: 10000 }).catch(() => null),
        page.click('button[type="submit"]'),
      ]);
      await page.waitForTimeout(3500);

      const cookies = await context.cookies();
      const hasSuperSession = cookies.some(c => c.name.includes('session'));

      TEST_RESULTS.testsExecuted++;
      let isSuperadminLogged = page.url() === 'http://localhost:3002/' || page.url().includes('overview') || hasSuperSession;
      if (!isSuperadminLogged && page.url().includes('/login')) {
        await page.goto('http://localhost:3002/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000);
        isSuperadminLogged = page.url() === 'http://localhost:3002/' && !(await page.locator('button[type="submit"]').count() > 0);
      }

      assert(isSuperadminLogged, 'Superadmin logs in via legitimate credentials', `URL: ${page.url()}`);

      if (isSuperadminLogged) {
        if (page.url().includes('/login')) {
          await page.goto('http://localhost:3002/', { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1000);
        }

        // Module tabs
        TEST_RESULTS.testsExecuted++;
        const superTabs = page.locator('button[role="tab"], nav button, [data-tab]');
        const tabCount = await superTabs.count();
        if (tabCount > 0) {
          const firstTabBox = await superTabs.first().boundingBox();
          assert(
            firstTabBox && firstTabBox.height >= 44,
            'Superadmin module navigation tab meets touch height >= 44px',
            firstTabBox ? `Height: ${Math.round(firstTabBox.height)}px` : 'No box'
          );
        }
      }

      await context.close();
    }

    // ════════════════════════════════════════════════════════════════════
    // SUITE 7: ZERO HORIZONTAL OVERFLOW ACROSS REPRESENTATIVE VIEWPORTS
    // ════════════════════════════════════════════════════════════════════
    console.log('\nSuite 7: Zero Document Horizontal Overflow Verification (320px to 1280px)');
    TEST_RESULTS.suitesExecuted++;
    const testViewports = [
      { name: 'Narrow Mobile (320x700)', width: 320, height: 700 },
      { name: 'Standard Mobile (360x800)', width: 360, height: 800 },
      { name: 'iPhone 14/15 (390x844)', width: 390, height: 844 },
      { name: 'Pro Max (430x932)', width: 430, height: 932 },
      { name: 'Tablet (768x1024)', width: 768, height: 1024 },
      { name: 'Small Desktop (1024x768)', width: 1024, height: 768 },
      { name: 'Desktop (1280x800)', width: 1280, height: 800 },
    ];

    const testRoutes = [
      'http://localhost:3000',
      'http://localhost:3000/auth/login',
      'http://localhost:3000/cart',
      'http://localhost:3001/login',
      'http://localhost:3002/login',
    ];

    for (const vp of testViewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.width < 768,
        hasTouch: vp.width < 1024,
      });
      const page = await context.newPage();

      for (const route of testRoutes) {
        TEST_RESULTS.testsExecuted++;
        try {
          await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20000 });
        } catch (e) {
          await page.goto(route, { waitUntil: 'commit', timeout: 10000 }).catch(() => null);
        }
        await page.waitForTimeout(400);

        const overflow = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(docEl.scrollWidth, body ? body.scrollWidth : 0);
          const clientWidth = docEl.clientWidth;
          return { hasOverflow: scrollWidth > clientWidth + 2, scrollWidth, clientWidth };
        });

        const routeSlug = route.replace(/http:\/\/localhost:\d+/, '');
        assert(
          !overflow.hasOverflow,
          `No horizontal scroll on ${routeSlug || '/'} at ${vp.name}`,
          `Doc: ${overflow.scrollWidth}px, Viewport: ${overflow.clientWidth}px`
        );
      }

      await context.close();
    }

  } catch (err) {
    console.error('Test execution error:', err);
    TEST_RESULTS.assertionsFailed++;
    TEST_RESULTS.failures.push(err.message);
  } finally {
    await browser.close();
  }

  console.log('\n========================================================================');
  console.log('TEST SUMMARY');
  console.log('========================================================================');
  console.log(`Suites Discovered:  ${TEST_RESULTS.suitesDiscovered}`);
  console.log(`Suites Executed:    ${TEST_RESULTS.suitesExecuted}`);
  console.log(`Tests Executed:     ${TEST_RESULTS.testsExecuted}`);
  console.log(`Assertions Executed: ${TEST_RESULTS.assertionsExecuted}`);
  console.log(`Assertions Passed:   ${TEST_RESULTS.assertionsPassed}`);
  console.log(`Assertions Failed:   ${TEST_RESULTS.assertionsFailed}`);
  console.log(`Tests Skipped:       ${TEST_RESULTS.skipped.length}`);

  if (TEST_RESULTS.skipped.length > 0) {
    console.log('\nSkipped Tests:');
    TEST_RESULTS.skipped.forEach(s => console.log(`  - ${s.name}: ${s.reason}`));
  }

  if (TEST_RESULTS.assertionsFailed > 0) {
    console.error('\nFAILED ASSERTIONS:');
    TEST_RESULTS.failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('\nALL TOUCH INTERACTION & ACCESSIBILITY ASSERTIONS PASSED ACCURATELY!');
    process.exit(0);
  }
}

if (process.argv[1] && process.argv[1].endsWith('mobile-interaction-tests.mjs')) {
  runTests();
}

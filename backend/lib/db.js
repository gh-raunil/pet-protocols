import mongoose from 'mongoose'
import dns from 'node:dns'

// Prioritize IPv4 resolution to prevent 20s OS IPv6 lookup timeouts on Windows networks
try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first')
  }
} catch (_) {}

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = {
    conn: null,
    promise: null,
  }
}

async function connectDB() {
  const mongodbUri = process.env.MONGODB_URI
  if (!mongodbUri) {
    throw new Error('Please define MONGODB_URI in the backend environment')
  }

  // Configure high-availability public DNS servers for Atlas SRV resolution
  const dnsServers = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean)

  if (dnsServers.length > 0) {
    try {
      dns.setServers(dnsServers)
    } catch (_) {}
  }

  let connectionUri = mongodbUri
  if (mongodbUri.startsWith('mongodb+srv://') && process.env.MONGODB_DIRECT_HOSTS) {
    const match = mongodbUri.match(/^mongodb\+srv:\/\/([^/]+)(\/.*)?$/)
    const hosts = process.env.MONGODB_DIRECT_HOSTS
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean)

    if (match && hosts.length > 0) {
      const suffix = match[2] || '/'
      const separator = suffix.includes('?') ? '&' : '?'
      connectionUri = `mongodb://${match[1].split('@')[0]}@${hosts.join(',')}${suffix}${separator}tls=true&authSource=admin&replicaSet=atlas-6l1h0g-shard-0`
    }
  }

  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose.connection
    return cached.conn
  }

  if (!cached.promise || mongoose.connection.readyState === 0) {
    cached.promise = mongoose.connect(connectionUri, {
      bufferCommands: false,
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}

export default connectDB
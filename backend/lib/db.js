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

  // Only override DNS servers if explicitly configured
  if (process.env.MONGODB_DNS_SERVERS) {
    const dnsServers = process.env.MONGODB_DNS_SERVERS
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean)

    if (dnsServers.length > 0) {
      try {
        dns.setServers(dnsServers)
      } catch (_) {}
    }
  }

  let connectionUri = mongodbUri
  const rawDirectHosts =
    process.env.MONGODB_DIRECT_HOSTS ||
    process.env.MONGODB_HOSTS ||
    (mongodbUri.includes('pet-protocols.t3jdmic.mongodb.net')
      ? 'ac-e6norca-shard-00-00.t3jdmic.mongodb.net:27017,ac-e6norca-shard-00-01.t3jdmic.mongodb.net:27017,ac-e6norca-shard-00-02.t3jdmic.mongodb.net:27017'
      : '')

  if (mongodbUri.startsWith('mongodb+srv://') && rawDirectHosts) {
    const match = mongodbUri.match(/^mongodb\+srv:\/\/([^/]+)(\/.*)?$/)
    const hosts = rawDirectHosts
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean)
      .map((host) => (host.includes(':') ? host : `${host}:27017`))

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
      serverSelectionTimeoutMS: 5000,
      family: 4,
      autoIndex: false,
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}

export default connectDB
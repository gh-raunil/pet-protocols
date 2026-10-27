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

export function resolveConnectionUri(
  mongodbUri = process.env.MONGODB_URI,
  rawDirectHosts = process.env.MONGODB_DIRECT_HOSTS || process.env.MONGODB_HOSTS,
  replicaSet = process.env.MONGODB_REPLICA_SET
) {
  if (!mongodbUri || typeof mongodbUri !== 'string' || !mongodbUri.trim()) {
    throw new Error('Please define MONGODB_URI in the backend environment')
  }

  let connectionUri = mongodbUri.trim()

  if (connectionUri.startsWith('mongodb+srv://') && rawDirectHosts) {
    const match = connectionUri.match(/^mongodb\+srv:\/\/([^/]+)(\/.*)?$/)
    const hosts = rawDirectHosts
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean)
      .map((host) => (host.includes(':') ? host : `${host}:27017`))

    if (match && hosts.length > 0) {
      const suffix = match[2] || '/'
      const separator = suffix.includes('?') ? '&' : '?'
      const rsParam = replicaSet ? `&replicaSet=${encodeURIComponent(replicaSet)}` : ''
      connectionUri = `mongodb://${match[1].split('@')[0]}@${hosts.join(',')}${suffix}${separator}tls=true&authSource=admin${rsParam}`
    }
  }

  return connectionUri
}

async function connectDB() {
  const mongodbUri = process.env.MONGODB_URI
  if (!mongodbUri) {
    throw new Error('Please define MONGODB_URI in the backend environment')
  }

  // Security Hardening: Never allow tests to connect to Atlas, production, or non-loopback databases
  if (process.env.NODE_ENV === 'test') {
    if (!mongodbUri.includes('127.0.0.1') && !mongodbUri.includes('localhost')) {
      throw new Error('SECURITY VIOLATION: Test environment must use loopback MongoMemoryReplSet URI');
    }
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

  const connectionUri = resolveConnectionUri(mongodbUri)

  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose.connection
    return cached.conn
  }

  if (!cached.promise || mongoose.connection.readyState === 0) {
    cached.promise = mongoose.connect(connectionUri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4,
      autoIndex: false,
    }).catch((err) => {
      cached.promise = null;
      cached.conn = null;
      throw err;
    });
  }

  cached.conn = await cached.promise
  return cached.conn
}

export default connectDB
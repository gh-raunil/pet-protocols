import mongoose from 'mongoose'
import dns from 'node:dns'

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

  let connectionUri = mongodbUri
  if (mongodbUri.startsWith('mongodb+srv://') && process.env.MONGODB_HOSTS) {
    const match = mongodbUri.match(/^mongodb\+srv:\/\/([^/]+)(\/.*)?$/)
    const hosts = process.env.MONGODB_HOSTS
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean)

    if (match && hosts.length > 0) {
      const suffix = match[2] || '/'
      const separator = suffix.includes('?') ? '&' : '?'
      connectionUri = `mongodb://${match[1].split('@')[0]}@${hosts.join(',')}${suffix}${separator}tls=true&authSource=admin&replicaSet=atlas-6l1h0g-shard-0`
    }
  } else if (mongodbUri.startsWith('mongodb+srv://') && process.env.MONGODB_DNS_SERVERS) {
    const servers = process.env.MONGODB_DNS_SERVERS
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean)

    if (servers.length > 0) dns.setServers(servers)
  }

  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(connectionUri, {
      bufferCommands: false,
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}

export default connectDB
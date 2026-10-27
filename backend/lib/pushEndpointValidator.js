import dns from 'node:dns';
import net from 'node:net';
import https from 'node:https';

/**
 * Standard Web Push Provider Domain Patterns (W3C Push API / RFC 8030)
 * Google FCM / Android, Apple Push Notification service, Mozilla Autopush, Windows WNS.
 */
const DEFAULT_ALLOWED_PUSH_PROVIDERS = [
  // Google Cloud Messaging / Firebase Cloud Messaging
  /^(?:[a-zA-Z0-9-]+\.)*fcm\.googleapis\.com$/i,
  /^android\.googleapis\.com$/i,
  // Apple Push Notification service
  /^(?:[a-zA-Z0-9-]+\.)*push\.apple\.com$/i,
  // Mozilla Firefox Autopush
  /^(?:[a-zA-Z0-9-]+\.)*push\.services\.mozilla\.com$/i,
  // Microsoft Windows Notification Service (WNS)
  /^(?:[a-zA-Z0-9-]+\.)*notify\.windows\.com$/i,
];

// Test resolver hook for isolated testing without live DNS/network
let customDnsResolver = null;

export function _setTestDnsResolver(resolverFn) {
  customDnsResolver = resolverFn;
}

export function _resetTestDnsResolver() {
  customDnsResolver = null;
}

/**
 * Converts standard dotted-quad IPv4 string to 32-bit unsigned integer.
 * Returns null if string is not valid 4-octet IPv4.
 * @param {string} ip
 * @returns {number|null}
 */
function ipv4ToInt(ip) {
  if (typeof ip !== 'string') return null;
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let result = 0;
  for (let i = 0; i < 4; i++) {
    const part = parts[i];
    // Reject empty, leading zeros, or non-numeric octets
    if (!/^\d+$/.test(part)) return null;
    if (part.length > 1 && part.startsWith('0')) return null; // Octal rejection
    const num = Number(part);
    if (num < 0 || num > 255) return null;
    result = ((result << 8) | num) >>> 0;
  }
  return result;
}

/**
 * Checks whether an IPv4 integer matches a given CIDR network.
 * @param {number} ipInt
 * @param {string} cidrIp
 * @param {number} prefixLen
 * @returns {boolean}
 */
function inCidrIPv4(ipInt, cidrIp, prefixLen) {
  const cidrInt = ipv4ToInt(cidrIp);
  if (cidrInt === null) return false;
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (ipInt & mask) === (cidrInt & mask);
}

/**
 * Determines whether a given IP address (IPv4 or IPv6) falls within private,
 * loopback, link-local, cloud metadata, multicast, or reserved address spaces.
 *
 * @param {string} rawIp
 * @returns {boolean} true if IP is restricted/unsafe; false if public/safe
 */
export function isRestrictedIp(rawIp) {
  if (!rawIp || typeof rawIp !== 'string') return true;

  let ip = rawIp.trim();
  // Strip IPv6 brackets if present: [::1] -> ::1
  if (ip.startsWith('[') && ip.endsWith(']')) {
    ip = ip.slice(1, -1);
  }

  // Handle IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1)
  const lowerIp = ip.toLowerCase();
  if (lowerIp.startsWith('::ffff:')) {
    const rest = lowerIp.slice(7);
    if (net.isIPv4(rest)) {
      ip = rest;
    } else {
      // Hex representation in IPv4-mapped, e.g. ::ffff:7f00:0001
      const hexParts = rest.split(':');
      if (hexParts.length === 2) {
        const p1 = parseInt(hexParts[0], 16);
        const p2 = parseInt(hexParts[1], 16);
        if (!isNaN(p1) && !isNaN(p2)) {
          ip = `${(p1 >> 8) & 0xff}.${p1 & 0xff}.${(p2 >> 8) & 0xff}.${p2 & 0xff}`;
        }
      }
    }
  }

  // 1. IPv4 Inspection
  if (net.isIPv4(ip)) {
    const ipInt = ipv4ToInt(ip);
    if (ipInt === null) return true; // Malformed / octal trick

    // Blocked IPv4 CIDR blocks:
    const restrictedCidrs = [
      { cidr: '0.0.0.0', prefix: 8, name: 'Current network (this host)' },
      { cidr: '10.0.0.0', prefix: 8, name: 'Private RFC 1918' },
      { cidr: '100.64.0.0', prefix: 10, name: 'Shared / CGNAT RFC 6598' },
      { cidr: '127.0.0.0', prefix: 8, name: 'Loopback RFC 1122' },
      { cidr: '169.254.0.0', prefix: 16, name: 'Link-Local / Cloud Metadata RFC 3927' },
      { cidr: '172.16.0.0', prefix: 12, name: 'Private RFC 1918' },
      { cidr: '192.0.0.0', prefix: 24, name: 'IETF Protocol Assignments RFC 6890' },
      { cidr: '192.0.2.0', prefix: 24, name: 'TEST-NET-1 RFC 5737' },
      { cidr: '192.88.99.0', prefix: 24, name: '6to4 Relay Anycast RFC 7526' },
      { cidr: '192.168.0.0', prefix: 16, name: 'Private RFC 1918' },
      { cidr: '198.18.0.0', prefix: 15, name: 'Interconnect Benchmark RFC 2544' },
      { cidr: '198.51.100.0', prefix: 24, name: 'TEST-NET-2 RFC 5737' },
      { cidr: '203.0.113.0', prefix: 24, name: 'TEST-NET-3 RFC 5737' },
      { cidr: '224.0.0.0', prefix: 4, name: 'Multicast RFC 5771' },
      { cidr: '240.0.0.0', prefix: 4, name: 'Reserved / Class E RFC 1112' },
      { cidr: '255.255.255.255', prefix: 32, name: 'Limited Broadcast' },
    ];

    for (const block of restrictedCidrs) {
      if (inCidrIPv4(ipInt, block.cidr, block.prefix)) {
        return true;
      }
    }

    return false;
  }

  // 2. IPv6 Inspection
  if (net.isIPv6(ip)) {
    const normalized = lowerIp;

    // Loopback ::1
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

    // Unspecified ::
    if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

    // Unique Local Address (ULA / Private) fc00::/7 (starts with fc or fd)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

    // Link-Local Unicast fe80::/10 (fe8x, fe9x, feax, febx)
    if (/^fe[89ab]/i.test(normalized)) return true;

    // Multicast ff00::/8
    if (normalized.startsWith('ff')) return true;

    // Discard prefix 100::/64
    if (normalized.startsWith('100:')) return true;

    // Documentation 2001:db8::/32
    if (normalized.startsWith('2001:db8') || normalized.startsWith('2001:0db8')) return true;

    // 6to4 prefix 2002::/16 - extracts embedded IPv4
    if (normalized.startsWith('2002:')) {
      const parts = normalized.split(':');
      if (parts.length >= 3) {
        const p1 = parseInt(parts[1], 16);
        const p2 = parseInt(parts[2], 16);
        if (!isNaN(p1) && !isNaN(p2)) {
          const embeddedIPv4 = `${(p1 >> 8) & 0xff}.${p1 & 0xff}.${(p2 >> 8) & 0xff}.${p2 & 0xff}`;
          if (isRestrictedIp(embeddedIPv4)) return true;
        }
      }
    }

    return false;
  }

  // Not a recognized valid IP format -> reject as restricted
  return true;
}

/**
 * Returns the effective set of push provider hostname matchers.
 * Incorporates environment-specific trusted domains if provided.
 * @param {object} options
 * @returns {Array<RegExp|string>}
 */
export function getAllowedPushHostMatchers(options = {}) {
  const matchers = [...DEFAULT_ALLOWED_PUSH_PROVIDERS];

  // Operator-configured trusted push hosts (comma-separated domain list)
  const additionalHosts = (process.env.ADDITIONAL_PUSH_HOSTS || process.env.TRUSTED_PUSH_DOMAINS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  for (const host of additionalHosts) {
    if (host.startsWith('*.')) {
      const suffix = host.slice(2).replace(/\./g, '\\.');
      matchers.push(new RegExp(`^(?:[a-zA-Z0-9-]+\\.)*${suffix}$`, 'i'));
    } else {
      matchers.push(new RegExp(`^${host.replace(/\./g, '\\.')}$`, 'i'));
    }
  }

  // Synthetic test domains allowed strictly in test environment when opted in
  if (options.allowSyntheticInTest && process.env.NODE_ENV === 'test') {
    matchers.push(/^(?:[a-zA-Z0-9-]+\.)*synthetic-test\.internal$/i);
    matchers.push(/^synthetic\.push\.test$/i);
    matchers.push(/^mock-push\.local-test$/i);
  }

  return matchers;
}

/**
 * Validates whether a hostname matches the legitimate push provider policy.
 * @param {string} hostname
 * @param {object} options
 * @returns {boolean}
 */
export function isAllowedPushHostname(hostname, options = {}) {
  if (!hostname || typeof hostname !== 'string') return false;
  const cleanHost = hostname.trim().toLowerCase();

  // Explicitly reject localhost and local service domains
  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.localhost') ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal') && !(options.allowSyntheticInTest && process.env.NODE_ENV === 'test') ||
    cleanHost === 'metadata.google.internal' ||
    cleanHost === 'instance-data'
  ) {
    return false;
  }

  // Reject IP literals (both IPv4 and IPv6) as hostnames in push endpoints
  if (net.isIP(cleanHost)) {
    return false;
  }

  // Reject integer/hex IP notation masquerading as hostnames (e.g. 2130706433 or 0x7f000001)
  if (/^\d+$/.test(cleanHost) || /^0x[0-9a-fA-F]+$/i.test(cleanHost)) {
    return false;
  }

  const matchers = getAllowedPushHostMatchers(options);
  return matchers.some((matcher) => {
    if (matcher instanceof RegExp) {
      return matcher.test(cleanHost);
    }
    return matcher.toLowerCase() === cleanHost;
  });
}

/**
 * Validates a push subscription endpoint against strict SSRF prevention rules:
 * 1. Must be a valid HTTPS URL (reject http, ftp, file, etc.).
 * 2. Must use default HTTPS port (443 or omitted).
 * 3. Must not embed user credentials (username/password).
 * 4. Must not contain ASCII control characters.
 * 5. Hostname must match legitimate browser Web Push providers.
 * 6. Hostname must resolve via DNS to non-private, non-loopback, non-metadata IP addresses.
 *
 * @param {string} endpointUrl
 * @param {object} options
 * @param {boolean} [options.allowSyntheticInTest=false]
 * @returns {Promise<{ valid: boolean, error?: string, parsedUrl?: URL, resolvedIps?: string[] }>}
 */
export async function validatePushEndpoint(endpointUrl, options = {}) {
  if (!endpointUrl || typeof endpointUrl !== 'string') {
    return { valid: false, error: 'Endpoint must be a non-empty string' };
  }

  const trimmed = endpointUrl.trim();

  // Reject excessive length
  if (trimmed.length > 2048) {
    return { valid: false, error: 'Endpoint URL exceeds maximum permitted length (2048 characters)' };
  }

  // Reject ASCII control characters and DEL
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return { valid: false, error: 'Endpoint contains illegal ASCII control characters' };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    return { valid: false, error: 'Malformed endpoint URL' };
  }

  // 1. Enforce HTTPS scheme only
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: `Invalid protocol '${parsed.protocol}'. Push subscriptions must strictly use 'https:'` };
  }

  // 2. Reject non-standard ports (allow only default empty or 443)
  if (parsed.port && parsed.port !== '443') {
    return { valid: false, error: `Invalid port '${parsed.port}'. Push subscriptions must strictly use standard HTTPS port 443` };
  }

  // 3. Reject embedded user credentials
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'Endpoints containing embedded credentials are prohibited' };
  }

  // 4. Hostname validation
  const hostname = parsed.hostname;
  if (!hostname) {
    return { valid: false, error: 'Missing endpoint hostname' };
  }

  if (!isAllowedPushHostname(hostname, options)) {
    return { valid: false, error: `Hostname '${hostname}' is not a recognized or trusted Web Push provider` };
  }

  // 5. DNS Resolution & IP Range Verification (Defense against DNS Rebinding)
  try {
    let addresses;
    if (customDnsResolver) {
      addresses = await customDnsResolver(hostname);
    } else {
      addresses = await dns.promises.lookup(hostname, { all: true });
    }

    if (!addresses || (Array.isArray(addresses) && addresses.length === 0)) {
      return { valid: false, error: `DNS resolution returned no addresses for '${hostname}'` };
    }

    const addrList = Array.isArray(addresses) ? addresses : [addresses];
    const resolvedIps = [];

    for (const item of addrList) {
      const ip = typeof item === 'string' ? item : item.address;
      resolvedIps.push(ip);

      if (isRestrictedIp(ip)) {
        return {
          valid: false,
          error: `Endpoint resolves to restricted/internal IP address (${ip}). Request blocked.`,
          resolvedIps,
        };
      }
    }

    return {
      valid: true,
      parsedUrl: parsed,
      hostname,
      resolvedIps,
    };
  } catch (dnsErr) {
    return {
      valid: false,
      error: `DNS resolution failed for '${hostname}': ${dnsErr.message || dnsErr.code}`,
    };
  }
}

/**
 * Creates a secure HTTPS Agent that enforces IP range checks at connection time.
 * Guards against Time-Of-Check to Time-Of-Use (TOCTOU) DNS rebinding attacks.
 *
 * @returns {https.Agent}
 */
export function createSecurePushAgent() {
  return new https.Agent({
    keepAlive: false,
    lookup: (hostname, lookupOptions, callback) => {
      const cb = typeof lookupOptions === 'function' ? lookupOptions : callback;
      const opts = typeof lookupOptions === 'object' ? lookupOptions : {};

      // If test resolver is active
      if (customDnsResolver) {
        Promise.resolve(customDnsResolver(hostname))
          .then((result) => {
            const list = Array.isArray(result) ? result : [result];
            for (const item of list) {
              const ip = typeof item === 'string' ? item : item.address;
              if (isRestrictedIp(ip)) {
                return cb(new Error(`SSRF Blocked: Destination IP ${ip} is in a restricted range`));
              }
            }
            const first = typeof list[0] === 'string' ? list[0] : list[0].address;
            const family = net.isIPv6(first) ? 6 : 4;
            cb(null, first, family);
          })
          .catch((err) => cb(err));
        return;
      }

      dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
        if (err) return cb(err);
        if (!addresses || addresses.length === 0) {
          return cb(new Error('DNS lookup returned no addresses'));
        }

        const addrList = Array.isArray(addresses) ? addresses : [addresses];
        for (const item of addrList) {
          const ip = typeof item === 'string' ? item : item.address;
          if (isRestrictedIp(ip)) {
            return cb(new Error(`SSRF Blocked: Destination IP ${ip} is in a restricted range`));
          }
        }

        if (opts.all) {
          return cb(null, addresses);
        }

        const first = addrList[0];
        cb(null, first.address, first.family);
      });
    },
  });
}

/**
 * Sanitizes a push subscription endpoint or log message so sensitive tokens,
 * cryptographic keys, or request parameters are never leaked to log files.
 *
 * @param {string|object} subscriptionOrUrl
 * @returns {string} Safe log identifier
 */
export function sanitizePushLog(subscriptionOrUrl) {
  if (!subscriptionOrUrl) return '[undefined endpoint]';

  const endpoint = typeof subscriptionOrUrl === 'string'
    ? subscriptionOrUrl
    : subscriptionOrUrl.endpoint;

  if (!endpoint || typeof endpoint !== 'string') return '[invalid endpoint]';

  try {
    const url = new URL(endpoint);
    // Truncate path to first 12 characters and compute simple length indicator
    const pathSnippet = url.pathname.length > 16 ? `${url.pathname.slice(0, 16)}...` : url.pathname;
    return `https://${url.hostname}${pathSnippet}`;
  } catch (_) {
    return '[malformed endpoint]';
  }
}

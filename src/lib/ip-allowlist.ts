/**
 * IP allowlist matching — supports exact IP and CIDR notation.
 *
 * Handles both IPv4 and IPv6. Uses binary comparison so no external deps needed.
 */

import { isIP } from 'net';

/**
 * Check if an IP address matches any entry in an allowlist.
 * Each entry may be an exact IP (e.g., "203.0.113.5") or CIDR (e.g., "203.0.113.0/24").
 *
 * Returns true if allowlist is empty (meaning: no restriction).
 */
export function ipMatchesAllowlist(ip: string | null | undefined, allowlist: string[]): boolean {
  if (!allowlist || allowlist.length === 0) return true;
  if (!ip) return false;

  const target = ipToBytes(ip);
  if (!target) return false;

  for (const entry of allowlist) {
    if (entry.includes('/')) {
      if (cidrMatches(target, entry)) return true;
    } else {
      const entryBytes = ipToBytes(entry);
      if (entryBytes && buffersEqual(target, entryBytes)) return true;
    }
  }
  return false;
}

/**
 * Validate that a string is a valid IP or CIDR. Returns the version (4 or 6) or null.
 */
export function validateAllowlistEntry(entry: string): 4 | 6 | null {
  const trimmed = entry.trim();
  if (trimmed.includes('/')) {
    const [ip, prefix] = trimmed.split('/');
    const version = isIP(ip);
    if (!version) return null;
    const prefixNum = Number.parseInt(prefix, 10);
    if (!Number.isInteger(prefixNum)) return null;
    if (version === 4 && (prefixNum < 0 || prefixNum > 32)) return null;
    if (version === 6 && (prefixNum < 0 || prefixNum > 128)) return null;
    return version as 4 | 6;
  }
  const v = isIP(trimmed);
  return v === 0 ? null : (v as 4 | 6);
}

// ----------------------------------------------------------------------------
// Internals
// ----------------------------------------------------------------------------

function ipToBytes(ip: string): Buffer | null {
  const v = isIP(ip);
  if (v === 4) return ipv4ToBytes(ip);
  if (v === 6) return ipv6ToBytes(ip);
  return null;
}

function ipv4ToBytes(ip: string): Buffer {
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  const buf = Buffer.alloc(4);
  buf[0] = parts[0];
  buf[1] = parts[1];
  buf[2] = parts[2];
  buf[3] = parts[3];
  return buf;
}

function ipv6ToBytes(ip: string): Buffer {
  // Handle :: shorthand and optional IPv4 suffix
  let normalized = ip;
  if (ip.includes('.')) {
    // Mixed form like ::ffff:192.0.2.1 — replace the v4 tail with two hex groups
    const lastColon = ip.lastIndexOf(':');
    const v4 = ip.slice(lastColon + 1);
    const v4Bytes = ipv4ToBytes(v4);
    const hex = `${v4Bytes[0].toString(16).padStart(2, '0')}${v4Bytes[1].toString(16).padStart(2, '0')}:${v4Bytes[2].toString(16).padStart(2, '0')}${v4Bytes[3].toString(16).padStart(2, '0')}`;
    normalized = `${ip.slice(0, lastColon + 1)}${hex}`;
  }

  const [head, tail] = normalized.includes('::') ? normalized.split('::') : [normalized, ''];
  const headGroups = head ? head.split(':').filter(Boolean) : [];
  const tailGroups = tail ? tail.split(':').filter(Boolean) : [];
  const zerosNeeded = 8 - headGroups.length - tailGroups.length;
  const zeros = Array(Math.max(0, zerosNeeded)).fill('0');
  const allGroups = [...headGroups, ...zeros, ...tailGroups];

  const buf = Buffer.alloc(16);
  for (let i = 0; i < 8; i++) {
    const val = Number.parseInt(allGroups[i] || '0', 16);
    buf[i * 2] = (val >> 8) & 0xff;
    buf[i * 2 + 1] = val & 0xff;
  }
  return buf;
}

function cidrMatches(target: Buffer, cidr: string): boolean {
  const [ip, prefixStr] = cidr.split('/');
  const prefix = Number.parseInt(prefixStr, 10);
  const cidrBytes = ipToBytes(ip);
  if (!cidrBytes || cidrBytes.length !== target.length) return false;

  const fullBytes = Math.floor(prefix / 8);
  const remainderBits = prefix % 8;

  // Check fully-covered bytes
  for (let i = 0; i < fullBytes; i++) {
    if (target[i] !== cidrBytes[i]) return false;
  }
  // Check partial byte
  if (remainderBits > 0 && fullBytes < cidrBytes.length) {
    const mask = (0xff << (8 - remainderBits)) & 0xff;
    if ((target[fullBytes] & mask) !== (cidrBytes[fullBytes] & mask)) return false;
  }
  return true;
}

function buffersEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

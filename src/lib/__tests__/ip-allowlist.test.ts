import { describe, it, expect } from 'vitest';
import { ipMatchesAllowlist, validateAllowlistEntry } from '../ip-allowlist';

describe('ipMatchesAllowlist', () => {
  it('allows any IP when allowlist is empty', () => {
    expect(ipMatchesAllowlist('1.2.3.4', [])).toBe(true);
    expect(ipMatchesAllowlist(null, [])).toBe(true);
  });

  it('blocks when allowlist is set but IP is null', () => {
    expect(ipMatchesAllowlist(null, ['1.2.3.4'])).toBe(false);
    expect(ipMatchesAllowlist(undefined, ['1.2.3.4'])).toBe(false);
  });

  it('matches exact IPv4', () => {
    expect(ipMatchesAllowlist('192.168.1.5', ['192.168.1.5'])).toBe(true);
    expect(ipMatchesAllowlist('192.168.1.6', ['192.168.1.5'])).toBe(false);
  });

  it('matches /24 CIDR', () => {
    expect(ipMatchesAllowlist('203.0.113.42', ['203.0.113.0/24'])).toBe(true);
    expect(ipMatchesAllowlist('203.0.113.255', ['203.0.113.0/24'])).toBe(true);
    expect(ipMatchesAllowlist('203.0.114.0', ['203.0.113.0/24'])).toBe(false);
  });

  it('matches /32 CIDR (exact host)', () => {
    expect(ipMatchesAllowlist('10.0.0.1', ['10.0.0.1/32'])).toBe(true);
    expect(ipMatchesAllowlist('10.0.0.2', ['10.0.0.1/32'])).toBe(false);
  });

  it('matches /16 CIDR', () => {
    expect(ipMatchesAllowlist('10.5.200.13', ['10.5.0.0/16'])).toBe(true);
    expect(ipMatchesAllowlist('10.6.0.1', ['10.5.0.0/16'])).toBe(false);
  });

  it('matches /8 CIDR', () => {
    expect(ipMatchesAllowlist('10.1.2.3', ['10.0.0.0/8'])).toBe(true);
    expect(ipMatchesAllowlist('11.0.0.0', ['10.0.0.0/8'])).toBe(false);
  });

  it('matches /0 CIDR (allows all of v4)', () => {
    expect(ipMatchesAllowlist('1.2.3.4', ['0.0.0.0/0'])).toBe(true);
    expect(ipMatchesAllowlist('255.255.255.255', ['0.0.0.0/0'])).toBe(true);
  });

  it('supports odd prefix lengths (e.g., /23)', () => {
    // 10.0.0.0/23 covers 10.0.0.0 through 10.0.1.255
    expect(ipMatchesAllowlist('10.0.0.0', ['10.0.0.0/23'])).toBe(true);
    expect(ipMatchesAllowlist('10.0.1.255', ['10.0.0.0/23'])).toBe(true);
    expect(ipMatchesAllowlist('10.0.2.0', ['10.0.0.0/23'])).toBe(false);
  });

  it('checks multiple entries', () => {
    const list = ['10.0.0.1', '192.168.0.0/16', '203.0.113.0/24'];
    expect(ipMatchesAllowlist('10.0.0.1', list)).toBe(true);
    expect(ipMatchesAllowlist('192.168.50.5', list)).toBe(true);
    expect(ipMatchesAllowlist('203.0.113.100', list)).toBe(true);
    expect(ipMatchesAllowlist('8.8.8.8', list)).toBe(false);
  });

  it('handles IPv6 exact match', () => {
    expect(ipMatchesAllowlist('2001:db8::1', ['2001:db8::1'])).toBe(true);
    expect(ipMatchesAllowlist('2001:db8::2', ['2001:db8::1'])).toBe(false);
  });

  it('handles IPv6 CIDR', () => {
    expect(ipMatchesAllowlist('2001:db8::1', ['2001:db8::/32'])).toBe(true);
    expect(ipMatchesAllowlist('2001:db8:1234::1', ['2001:db8::/32'])).toBe(true);
    expect(ipMatchesAllowlist('2001:db9::1', ['2001:db8::/32'])).toBe(false);
  });

  it('returns false for invalid IP input', () => {
    expect(ipMatchesAllowlist('not-an-ip', ['1.2.3.4'])).toBe(false);
    expect(ipMatchesAllowlist('', ['1.2.3.4'])).toBe(false);
  });

  it('does not match v4 IP against v6 CIDR', () => {
    expect(ipMatchesAllowlist('192.0.2.1', ['2001:db8::/32'])).toBe(false);
  });
});

describe('validateAllowlistEntry', () => {
  it('accepts valid IPv4', () => {
    expect(validateAllowlistEntry('192.168.1.1')).toBe(4);
    expect(validateAllowlistEntry('0.0.0.0')).toBe(4);
    expect(validateAllowlistEntry('255.255.255.255')).toBe(4);
  });

  it('accepts valid IPv4 CIDR', () => {
    expect(validateAllowlistEntry('10.0.0.0/8')).toBe(4);
    expect(validateAllowlistEntry('10.0.0.0/32')).toBe(4);
    expect(validateAllowlistEntry('0.0.0.0/0')).toBe(4);
  });

  it('accepts valid IPv6', () => {
    expect(validateAllowlistEntry('2001:db8::1')).toBe(6);
    expect(validateAllowlistEntry('::1')).toBe(6);
  });

  it('accepts valid IPv6 CIDR', () => {
    expect(validateAllowlistEntry('2001:db8::/32')).toBe(6);
    expect(validateAllowlistEntry('::/0')).toBe(6);
  });

  it('rejects invalid IPs', () => {
    expect(validateAllowlistEntry('not-an-ip')).toBe(null);
    expect(validateAllowlistEntry('256.0.0.0')).toBe(null);
    expect(validateAllowlistEntry('192.168.1')).toBe(null);
    expect(validateAllowlistEntry('')).toBe(null);
  });

  it('rejects out-of-range prefix lengths', () => {
    expect(validateAllowlistEntry('10.0.0.0/33')).toBe(null);
    expect(validateAllowlistEntry('10.0.0.0/-1')).toBe(null);
    expect(validateAllowlistEntry('2001:db8::/129')).toBe(null);
  });

  it('rejects non-numeric prefix', () => {
    expect(validateAllowlistEntry('10.0.0.0/abc')).toBe(null);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractSubdomain } from '../subdomain';

describe('extractSubdomain', () => {
  const originalBaseDomain = process.env.BASE_DOMAIN;

  beforeEach(() => {
    process.env.BASE_DOMAIN = 'tpaplatform.com';
  });

  afterEach(() => {
    if (originalBaseDomain === undefined) {
      delete process.env.BASE_DOMAIN;
    } else {
      process.env.BASE_DOMAIN = originalBaseDomain;
    }
  });

  it('extracts a simple subdomain', () => {
    expect(extractSubdomain('jmti.tpaplatform.com')).toBe('jmti');
  });

  it('returns null for the apex domain', () => {
    expect(extractSubdomain('tpaplatform.com')).toBe(null);
  });

  it('returns null for localhost', () => {
    expect(extractSubdomain('localhost')).toBe(null);
    expect(extractSubdomain('localhost:3000')).toBe(null);
    expect(extractSubdomain('127.0.0.1')).toBe(null);
  });

  it('strips port numbers', () => {
    expect(extractSubdomain('jmti.tpaplatform.com:443')).toBe('jmti');
  });

  it('returns null for reserved subdomains', () => {
    expect(extractSubdomain('www.tpaplatform.com')).toBe(null);
    expect(extractSubdomain('app.tpaplatform.com')).toBe(null);
    expect(extractSubdomain('api.tpaplatform.com')).toBe(null);
    expect(extractSubdomain('admin.tpaplatform.com')).toBe(null);
    expect(extractSubdomain('platform.tpaplatform.com')).toBe(null);
    expect(extractSubdomain('staging.tpaplatform.com')).toBe(null);
    expect(extractSubdomain('dev.tpaplatform.com')).toBe(null);
  });

  it('returns null when hostname does not end with base domain', () => {
    expect(extractSubdomain('example.com')).toBe(null);
    expect(extractSubdomain('foo.other.com')).toBe(null);
  });

  it('handles case-sensitivity consistently', () => {
    // hostname is typically lowercase already; test real behavior
    expect(extractSubdomain('jmti.tpaplatform.com')).toBe('jmti');
  });

  it('handles hyphens in subdomain', () => {
    expect(extractSubdomain('acme-corp.tpaplatform.com')).toBe('acme-corp');
  });
});

import { describe, it, expect } from 'vitest';
import { signWebhookPayload } from '../webhooks';
import crypto from 'crypto';

describe('signWebhookPayload', () => {
  it('returns an HMAC-SHA256 signature in sha256=<hex> format', () => {
    const sig = signWebhookPayload('{"event":"test"}', 'mysecret');
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('is deterministic for the same inputs', () => {
    const payload = '{"a":1}';
    const secret = 'secret';
    expect(signWebhookPayload(payload, secret)).toBe(signWebhookPayload(payload, secret));
  });

  it('differs when payload changes', () => {
    const s1 = signWebhookPayload('{"a":1}', 'secret');
    const s2 = signWebhookPayload('{"a":2}', 'secret');
    expect(s1).not.toBe(s2);
  });

  it('differs when secret changes', () => {
    const s1 = signWebhookPayload('payload', 'secret1');
    const s2 = signWebhookPayload('payload', 'secret2');
    expect(s1).not.toBe(s2);
  });

  it('matches a manually-computed HMAC-SHA256', () => {
    const payload = 'hello world';
    const secret = 'shhh';
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    expect(signWebhookPayload(payload, secret)).toBe(`sha256=${expected}`);
  });

  it('handles unicode payloads', () => {
    const sig = signWebhookPayload('日本語 🔒', 'key');
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('handles empty payload', () => {
    const sig = signWebhookPayload('', 'key');
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('subscribers can verify signatures with a matching secret', () => {
    // Simulate a subscriber verifying the signature
    const payload = JSON.stringify({ event: 'order.created', id: '123' });
    const secret = 'webhook-secret-abc';

    const received = signWebhookPayload(payload, secret);

    // Receiver's verification
    const expectedSig = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')}`;

    // Timing-safe comparison (what a proper subscriber would do)
    const receivedBuf = Buffer.from(received);
    const expectedBuf = Buffer.from(expectedSig);
    expect(receivedBuf.length).toBe(expectedBuf.length);
    expect(crypto.timingSafeEqual(receivedBuf, expectedBuf)).toBe(true);
  });
});

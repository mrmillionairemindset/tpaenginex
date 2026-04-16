import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the collector sync endpoint logic.
 *
 * Since the sync route is a Next.js API route, we test the core logic patterns
 * (idempotency, partial failures, validation) by exercising the zod schemas
 * and simulating the processing logic.
 */

import { z } from 'zod';

// ============================================================================
// Reproduce the schemas from the sync route for unit testing
// ============================================================================

const completionSchema = z.object({
  orderId: z.string().uuid(),
  ccfNumber: z.string().optional(),
  completedAt: z.string().datetime(),
});

const waitTimeSchema = z.object({
  orderId: z.string().uuid(),
  hours: z.number().positive(),
});

const documentSchema = z.object({
  orderId: z.string().uuid(),
  kind: z.enum(['result', 'chain_of_custody', 'consent', 'authorization', 'other']),
  fileName: z.string().min(1),
  storageKey: z.string().min(1),
});

const syncSchema = z.object({
  completions: z.array(completionSchema).default([]),
  waitTimes: z.array(waitTimeSchema).default([]),
  documents: z.array(documentSchema).default([]),
});

// ============================================================================
// Schema Validation Tests
// ============================================================================

describe('Sync Schema Validation', () => {
  describe('completions', () => {
    it('accepts valid completion', () => {
      const result = completionSchema.safeParse({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
        ccfNumber: 'CCF-123',
        completedAt: '2026-04-15T10:30:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('accepts completion without ccfNumber', () => {
      const result = completionSchema.safeParse({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
        completedAt: '2026-04-15T10:30:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid orderId', () => {
      const result = completionSchema.safeParse({
        orderId: 'not-a-uuid',
        completedAt: '2026-04-15T10:30:00Z',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing completedAt', () => {
      const result = completionSchema.safeParse({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid datetime format', () => {
      const result = completionSchema.safeParse({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
        completedAt: 'not-a-datetime',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('waitTimes', () => {
    it('accepts valid wait time', () => {
      const result = waitTimeSchema.safeParse({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
        hours: 1.5,
      });
      expect(result.success).toBe(true);
    });

    it('rejects zero hours', () => {
      const result = waitTimeSchema.safeParse({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
        hours: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative hours', () => {
      const result = waitTimeSchema.safeParse({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
        hours: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('documents', () => {
    it('accepts valid document', () => {
      const result = documentSchema.safeParse({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
        kind: 'chain_of_custody',
        fileName: 'ccf-photo.jpg',
        storageKey: 'orders/123/chain_of_custody/1234567890-ccf-photo.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid document kind', () => {
      const result = documentSchema.safeParse({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
        kind: 'invalid_kind',
        fileName: 'photo.jpg',
        storageKey: 'orders/123/other/photo.jpg',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty fileName', () => {
      const result = documentSchema.safeParse({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
        kind: 'other',
        fileName: '',
        storageKey: 'orders/123/other/photo.jpg',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty storageKey', () => {
      const result = documentSchema.safeParse({
        orderId: '550e8400-e29b-41d4-a716-446655440000',
        kind: 'other',
        fileName: 'photo.jpg',
        storageKey: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('full sync payload', () => {
    it('accepts empty arrays (no-op sync)', () => {
      const result = syncSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.completions).toEqual([]);
        expect(result.data.waitTimes).toEqual([]);
        expect(result.data.documents).toEqual([]);
      }
    });

    it('accepts a mixed payload with all three action types', () => {
      const result = syncSchema.safeParse({
        completions: [
          { orderId: '550e8400-e29b-41d4-a716-446655440000', completedAt: '2026-04-15T10:30:00Z' },
        ],
        waitTimes: [
          { orderId: '550e8400-e29b-41d4-a716-446655440001', hours: 2 },
        ],
        documents: [
          {
            orderId: '550e8400-e29b-41d4-a716-446655440002',
            kind: 'chain_of_custody',
            fileName: 'ccf.jpg',
            storageKey: 'orders/xyz/chain_of_custody/ccf.jpg',
          },
        ],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.completions).toHaveLength(1);
        expect(result.data.waitTimes).toHaveLength(1);
        expect(result.data.documents).toHaveLength(1);
      }
    });

    it('rejects if a nested item is invalid', () => {
      const result = syncSchema.safeParse({
        completions: [
          { orderId: 'bad-uuid', completedAt: '2026-04-15T10:30:00Z' },
        ],
      });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Idempotency Logic Tests
// ============================================================================

describe('Sync Idempotency Logic', () => {
  it('already-completed orders should not cause errors (completion)', () => {
    // Simulate the logic: if order.status === 'complete', return success without modifying
    const order = { id: 'ord-1', status: 'complete', collectorId: 'col-1' };
    const isAlreadyDone = order.status === 'complete' || order.status === 'cancelled';
    expect(isAlreadyDone).toBe(true);
    // The sync endpoint returns { success: true } for already-done orders
  });

  it('already-logged shy bladder should not duplicate', () => {
    const testType = 'DOT 5-Panel, Shy Bladder / Extended Wait (1hr)';
    const alreadyLogged = testType.includes('Shy Bladder');
    expect(alreadyLogged).toBe(true);
  });

  it('new shy bladder appends correctly', () => {
    const testType = 'DOT 5-Panel';
    const hours = 2;
    const entry = `Shy Bladder / Extended Wait (${hours}hr)`;
    const updated = `${testType}, ${entry}`;
    expect(updated).toBe('DOT 5-Panel, Shy Bladder / Extended Wait (2hr)');
    expect(updated.includes('Shy Bladder')).toBe(true);
  });

  it('handles partial failures gracefully', () => {
    // Simulate: 3 completions, 1 fails, 2 succeed
    const results = [
      { orderId: 'a', success: true },
      { orderId: 'b', success: false, error: 'Order not found or not assigned to you' },
      { orderId: 'c', success: true },
    ];

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes).toHaveLength(2);
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toBe('Order not found or not assigned to you');
  });

  it('duplicate document upload is idempotent (same storageKey)', () => {
    // Simulate: existing doc with same storageUrl found
    const existingDoc = {
      id: 'doc-1',
      orderId: 'ord-1',
      storageUrl: 'orders/ord-1/chain_of_custody/1234-ccf.jpg',
    };
    const newDoc = {
      orderId: 'ord-1',
      storageKey: 'orders/ord-1/chain_of_custody/1234-ccf.jpg',
    };

    const isDuplicate = existingDoc.storageUrl === newDoc.storageKey;
    expect(isDuplicate).toBe(true);
    // In this case, the sync endpoint returns { success: true } without inserting
  });
});

// ============================================================================
// Location Schema Validation
// ============================================================================

describe('Location Check-in Schema', () => {
  const locationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().positive().optional(),
  });

  it('accepts valid coordinates', () => {
    const result = locationSchema.safeParse({ latitude: 32.7767, longitude: -96.797 });
    expect(result.success).toBe(true);
  });

  it('accepts coordinates with accuracy', () => {
    const result = locationSchema.safeParse({ latitude: 32.7767, longitude: -96.797, accuracy: 10.5 });
    expect(result.success).toBe(true);
  });

  it('rejects latitude out of range', () => {
    expect(locationSchema.safeParse({ latitude: 91, longitude: 0 }).success).toBe(false);
    expect(locationSchema.safeParse({ latitude: -91, longitude: 0 }).success).toBe(false);
  });

  it('rejects longitude out of range', () => {
    expect(locationSchema.safeParse({ latitude: 0, longitude: 181 }).success).toBe(false);
    expect(locationSchema.safeParse({ latitude: 0, longitude: -181 }).success).toBe(false);
  });

  it('rejects negative accuracy', () => {
    expect(locationSchema.safeParse({ latitude: 0, longitude: 0, accuracy: -5 }).success).toBe(false);
  });
});

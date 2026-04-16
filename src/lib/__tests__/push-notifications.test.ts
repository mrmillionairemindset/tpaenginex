import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Mock Expo SDK
// ============================================================================

const mockSendPushNotificationsAsync = vi.fn();
const mockGetPushNotificationReceiptsAsync = vi.fn();

vi.mock('expo-server-sdk', () => {
  class MockExpo {
    sendPushNotificationsAsync = mockSendPushNotificationsAsync;
    getPushNotificationReceiptsAsync = mockGetPushNotificationReceiptsAsync;

    chunkPushNotifications(messages: any[]) {
      // Return all messages as a single chunk for simplicity
      return [messages];
    }

    chunkPushNotificationReceiptIds(ids: string[]) {
      return [ids];
    }

    static isExpoPushToken(token: string) {
      return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
    }
  }

  return { default: MockExpo, __esModule: true };
});

// ============================================================================
// Mock DB
// ============================================================================

const mockFindMany = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) });

vi.mock('@/db', () => ({
  db: {
    query: {
      collectorPushTokens: {
        findMany: (...args: any[]) => mockFindMany(...args),
      },
    },
    update: (...args: any[]) => mockUpdate(...args),
  },
}));

vi.mock('@/db/schema', () => ({
  collectorPushTokens: {
    collectorId: 'collector_id',
    isActive: 'is_active',
    token: 'token',
    id: 'id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (field: any, value: any) => ({ field, value, op: 'eq' }),
  and: (...conditions: any[]) => ({ conditions, op: 'and' }),
  inArray: (field: any, values: any[]) => ({ field, values, op: 'inArray' }),
}));

// ============================================================================
// Tests
// ============================================================================

describe('Push Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env
    delete process.env.EXPO_PUSH_DISABLED;
  });

  afterEach(() => {
    delete process.env.EXPO_PUSH_DISABLED;
  });

  describe('sendPushNotification', () => {
    it('sends push notification to all active tokens for a collector', async () => {
      mockFindMany.mockResolvedValue([
        { id: 'tok1', token: 'ExponentPushToken[abc123]', collectorId: 'col-1' },
        { id: 'tok2', token: 'ExponentPushToken[def456]', collectorId: 'col-1' },
      ]);

      mockSendPushNotificationsAsync.mockResolvedValue([
        { status: 'ok', id: 'ticket-1' },
        { status: 'ok', id: 'ticket-2' },
      ]);

      // Need to re-import after mocks are set up
      const { sendPushNotification } = await import('../push-notifications');

      const tickets = await sendPushNotification('col-1', {
        title: 'New Assignment',
        body: 'Order #123 at Downtown Office',
      });

      expect(mockFindMany).toHaveBeenCalledTimes(1);
      expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(1);
      expect(tickets).toHaveLength(2);
      expect(tickets[0].ticketId).toBe('ticket-1');
      expect(tickets[1].ticketId).toBe('ticket-2');
    });

    it('returns empty array when no active tokens exist', async () => {
      mockFindMany.mockResolvedValue([]);

      const { sendPushNotification } = await import('../push-notifications');

      const tickets = await sendPushNotification('col-1', {
        title: 'Test',
        body: 'Test body',
      });

      expect(tickets).toHaveLength(0);
      expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
    });

    it('filters out invalid Expo tokens', async () => {
      mockFindMany.mockResolvedValue([
        { id: 'tok1', token: 'invalid-token', collectorId: 'col-1' },
      ]);

      const { sendPushNotification } = await import('../push-notifications');

      const tickets = await sendPushNotification('col-1', {
        title: 'Test',
        body: 'Test body',
      });

      expect(tickets).toHaveLength(0);
      expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
    });

    it('handles DeviceNotRegistered error by deactivating token', async () => {
      mockFindMany.mockResolvedValue([
        { id: 'tok1', token: 'ExponentPushToken[expired]', collectorId: 'col-1' },
      ]);

      mockSendPushNotificationsAsync.mockResolvedValue([
        {
          status: 'error',
          message: 'DeviceNotRegistered',
          details: { error: 'DeviceNotRegistered' },
        },
      ]);

      const mockSetWhere = vi.fn();
      const mockSet = vi.fn().mockReturnValue({ where: mockSetWhere });
      mockUpdate.mockReturnValue({ set: mockSet });

      const { sendPushNotification } = await import('../push-notifications');

      const tickets = await sendPushNotification('col-1', {
        title: 'Test',
        body: 'Test body',
      });

      expect(tickets).toHaveLength(0);
      // Token should be deactivated
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('sendBulkPushNotifications', () => {
    it('sends notifications to multiple collectors', async () => {
      mockFindMany.mockResolvedValue([
        { id: 'tok1', token: 'ExponentPushToken[abc]', collectorId: 'col-1' },
      ]);

      mockSendPushNotificationsAsync.mockResolvedValue([
        { status: 'ok', id: 'ticket-1' },
      ]);

      const { sendBulkPushNotifications } = await import('../push-notifications');

      const tickets = await sendBulkPushNotifications([
        { collectorId: 'col-1', payload: { title: 'A', body: 'B' } },
        { collectorId: 'col-2', payload: { title: 'C', body: 'D' } },
      ]);

      // Called once per collector
      expect(mockFindMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('disabled mode', () => {
    it('skips sending when EXPO_PUSH_DISABLED=true', async () => {
      process.env.EXPO_PUSH_DISABLED = 'true';

      // Clear module cache to pick up new env var
      vi.resetModules();

      // Re-apply mocks after reset
      vi.doMock('expo-server-sdk', () => {
        class MockExpo {
          sendPushNotificationsAsync = mockSendPushNotificationsAsync;
          getPushNotificationReceiptsAsync = mockGetPushNotificationReceiptsAsync;
          chunkPushNotifications(messages: any[]) { return [messages]; }
          chunkPushNotificationReceiptIds(ids: string[]) { return [ids]; }
          static isExpoPushToken(token: string) {
            return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
          }
        }
        return { default: MockExpo, __esModule: true };
      });
      vi.doMock('@/db', () => ({
        db: {
          query: { collectorPushTokens: { findMany: mockFindMany } },
          update: mockUpdate,
        },
      }));
      vi.doMock('@/db/schema', () => ({
        collectorPushTokens: { collectorId: 'collector_id', isActive: 'is_active', token: 'token', id: 'id' },
      }));
      vi.doMock('drizzle-orm', () => ({
        eq: (f: any, v: any) => ({ f, v }),
        and: (...c: any[]) => ({ c }),
        inArray: (f: any, v: any[]) => ({ f, v }),
      }));

      mockFindMany.mockResolvedValue([
        { id: 'tok1', token: 'ExponentPushToken[abc]', collectorId: 'col-1' },
      ]);

      const mod = await import('../push-notifications');
      const tickets = await mod.sendPushNotification('col-1', {
        title: 'Test',
        body: 'Test',
      });

      expect(tickets).toHaveLength(0);
      expect(mockSendPushNotificationsAsync).not.toHaveBeenCalled();
    });
  });

  describe('processPushReceipts', () => {
    it('processes receipts and deactivates DeviceNotRegistered tokens', async () => {
      // Ensure push is NOT disabled for this test
      delete process.env.EXPO_PUSH_DISABLED;
      vi.resetModules();

      // Re-apply mocks after reset
      vi.doMock('expo-server-sdk', () => {
        class MockExpo {
          sendPushNotificationsAsync = mockSendPushNotificationsAsync;
          getPushNotificationReceiptsAsync = mockGetPushNotificationReceiptsAsync;
          chunkPushNotifications(messages: any[]) { return [messages]; }
          chunkPushNotificationReceiptIds(ids: string[]) { return [ids]; }
          static isExpoPushToken(token: string) {
            return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
          }
        }
        return { default: MockExpo, __esModule: true };
      });
      vi.doMock('@/db', () => ({
        db: {
          query: { collectorPushTokens: { findMany: mockFindMany } },
          update: mockUpdate,
        },
      }));
      vi.doMock('@/db/schema', () => ({
        collectorPushTokens: { collectorId: 'collector_id', isActive: 'is_active', token: 'token', id: 'id' },
      }));
      vi.doMock('drizzle-orm', () => ({
        eq: (f: any, v: any) => ({ f, v }),
        and: (...c: any[]) => ({ c }),
        inArray: (f: any, v: any[]) => ({ f, v }),
      }));

      mockGetPushNotificationReceiptsAsync.mockResolvedValue({
        'ticket-1': { status: 'ok' },
        'ticket-2': {
          status: 'error',
          message: 'DeviceNotRegistered',
          details: { error: 'DeviceNotRegistered' },
        },
      });

      const mockSetWhere = vi.fn();
      const mockSet = vi.fn().mockReturnValue({ where: mockSetWhere });
      mockUpdate.mockReturnValue({ set: mockSet });

      const mod = await import('../push-notifications');

      const result = await mod.processPushReceipts([
        { ticketId: 'ticket-1', token: 'ExponentPushToken[good]', collectorId: 'col-1' },
        { ticketId: 'ticket-2', token: 'ExponentPushToken[bad]', collectorId: 'col-2' },
      ]);

      expect(result.processed).toBe(2);
      expect(result.deactivated).toBe(1);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('returns zeros when no tickets provided', async () => {
      delete process.env.EXPO_PUSH_DISABLED;
      vi.resetModules();

      vi.doMock('expo-server-sdk', () => {
        class MockExpo {
          sendPushNotificationsAsync = mockSendPushNotificationsAsync;
          getPushNotificationReceiptsAsync = mockGetPushNotificationReceiptsAsync;
          chunkPushNotifications(messages: any[]) { return [messages]; }
          chunkPushNotificationReceiptIds(ids: string[]) { return [ids]; }
          static isExpoPushToken(token: string) {
            return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
          }
        }
        return { default: MockExpo, __esModule: true };
      });
      vi.doMock('@/db', () => ({
        db: {
          query: { collectorPushTokens: { findMany: mockFindMany } },
          update: mockUpdate,
        },
      }));
      vi.doMock('@/db/schema', () => ({
        collectorPushTokens: { collectorId: 'collector_id', isActive: 'is_active', token: 'token', id: 'id' },
      }));
      vi.doMock('drizzle-orm', () => ({
        eq: (f: any, v: any) => ({ f, v }),
        and: (...c: any[]) => ({ c }),
        inArray: (f: any, v: any[]) => ({ f, v }),
      }));

      const mod = await import('../push-notifications');

      const result = await mod.processPushReceipts([]);

      expect(result.processed).toBe(0);
      expect(result.deactivated).toBe(0);
    });
  });
});

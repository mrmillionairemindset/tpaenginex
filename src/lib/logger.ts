/**
 * Structured JSON logging via Pino.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info({ userId, action }, 'user logged in');
 *   logger.error({ err, orderId }, 'failed to create order');
 *
 * In production, emits JSON for log aggregation (Datadog, Logtail, CloudWatch).
 * In development, uses pino-pretty for human-readable output.
 *
 * HIPAA note: never log PHI (person names, DOB, SSN, results) — use IDs only.
 * The redact list below strips common sensitive fields even if accidentally passed.
 */

import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),

  // Pretty print in dev, JSON in prod
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },

  // Scrub common secret field names — defense against accidental logging of PHI/secrets.
  // Anything matching these paths is replaced with '[Redacted]' in every log line.
  redact: {
    paths: [
      'password', 'newPassword', 'currentPassword',
      'token', 'totpToken', 'backupCode', 'totpSecret',
      'apiKey', 'api_key', 'secret', 'webhookSecret',
      'authorization', 'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      '*.password', '*.token', '*.secret',
      // HIPAA PHI fields — never log these
      'ssn', 'ssnLast4', 'dob', 'dateOfBirth',
      '*.ssn', '*.ssnLast4', '*.dob', '*.dateOfBirth',
    ],
    censor: '[Redacted]',
  },

  // Standard serializers
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      // NEVER log full headers (auth, cookies)
    }),
  },

  base: {
    env: process.env.NODE_ENV || 'development',
    service: 'tpaenginex',
  },
});

/**
 * Child logger scoped to a specific module/component.
 * Useful for filtering logs per subsystem.
 */
export function createLogger(component: string) {
  return logger.child({ component });
}

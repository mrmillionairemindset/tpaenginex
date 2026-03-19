import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.warn('REDIS_URL is not set — BullMQ jobs will not work');
}

export const redis = redisUrl
  ? new IORedis(redisUrl, { maxRetriesPerRequest: null })
  : (null as unknown as IORedis);

export const redisConnection = redisUrl
  ? { connection: redis }
  : undefined;

import Redis from 'ioredis'
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableReadyCheck: false
})
redis.on('error', (err: Error) => {
  console.error('Redis connection error:', err.message)
})
export async function redisGet(key: string): Promise<string | null> {
  try { return await redis.get(key) } catch { return null }
}
export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  try {
    if (ttlSeconds) { await redis.setex(key, ttlSeconds, value) }
    else { await redis.set(key, value) }
  } catch (err) { console.error('Redis set error:', err) }
}
export async function redisDel(key: string): Promise<void> {
  try { await redis.del(key) } catch (err) { console.error('Redis del error:', err) }
}
export async function redisIncr(key: string, ttlSeconds?: number): Promise<number> {
  try {
    const val = await redis.incr(key)
    if (ttlSeconds && val === 1) { await redis.expire(key, ttlSeconds) }
    return val
  } catch { return 0 }
}
export async function redisTtl(key: string): Promise<number> {
  try { return await redis.ttl(key) } catch { return -1 }
}
export default redis


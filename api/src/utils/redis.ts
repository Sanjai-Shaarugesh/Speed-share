import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('error', (err) => {
  console.log(`Redis error: ${err}`);
  
});

export async function connectRedis() {
  if(!redisClient.isOpen){
    await redisClient.connect();
    console.log(`Redis connected`);
  }
  
  return redisClient;
}

export async function cacheFile(fileId:string, fileData:any , ttl=3600){
  const redis = await connectRedis();
  await redis.set(`file:${fileId}`, JSON.stringify(fileData), { EX: ttl });
}

export async function getCacheFile(fileId:string){
  const redis = await connectRedis();
  const cacheData = await redis.get(`file:${fileId}`);
  return cacheData ? JSON.parse(cacheData) : null;
}

export async function  invalidateFileCache(fileId:string){
  const redis = await connectRedis();
  await redis.del(`file:${fileId}`);
}






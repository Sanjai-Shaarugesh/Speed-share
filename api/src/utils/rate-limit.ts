import { Elysia } from 'elysia';
import { redisClient ,connectRedis } from './redis';

interface RateLimitOptions {
  max: number;
  window: number;
  keyGenerator?: (contex: any) => string;
}

export function rateLimit(options: RateLimitOptions){
  const {
    max = 100,
    window = 60 * 1000,// default 1  minute default
    keyGenerator = (context) => {
      // Default ip address the key
      const ip = context.request.headers.get("x-forwarded-for") ||
        context.request.headers.get("x-real-ip") ||
        "unknown";
      return `rate-limit:${ip}`;
    }
  } = options;

  return new Elysia()
    .onBeforeHandle(async (context)=>{
      try{
        // ensure redis is connected
        if(!redisClient.isOpen){
          await connectRedis();
        }

        const key = keyGenerator(context);

        // use redis pipline for atomicity
        const pipline = redisClient.multi();
        pipline.incr(key);
        pipline.expire(key, Math.ceil(window / 1000)); // convert ms to sec for redis

        const results = await pipline.exec();
        const count = results?.[0] as number || 0;

        // set rate limiters for headers 
        context.set.headers["X-RateLimit-Limit"] = String(max);
        context.set.headers["X-RateLimit-Remainig"] = String(Math.max(0, max - count));
        context.set.headers["X-RateLimit-Rest"] = String(Math.ceil(Date.now() / 1000) + Math.ceil(window / 1000));
        
        // if ratemit exceded return 429
        if(count > max){
          context.set.status = 429;
          
          return {
            error: "Too many Requests",
            message: "You have exceedd the rate limit try again later"
          };
          
        }
      }
      catch(error){
        console.error('Rate limit error', error);
      }
    })
}
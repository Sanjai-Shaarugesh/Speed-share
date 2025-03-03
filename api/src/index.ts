import { Elysia } from "elysia";
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { authRoutes } from './routes/auth-routes';
import { fileRoutes } from "./routes/file_routes";
import { scheduleCleanup } from "./services/file-service";
import { setupWebRTCSignaling , setupRedisSignaling } from './services/webrtc-service';
import { connectRedis } from "./utils/redis";


const app = new Elysia().get("/", () => "Hello Elysia").listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);

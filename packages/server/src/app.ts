import Fastify from "fastify";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import authPlugin from "./plugins/auth.js";
import { authRoutes } from "./modules/auth/auth.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
    },
  });

  // Connect to DB and Redis on server ready
  app.addHook("onReady", async () => {
    await prisma.$connect();
    app.log.info("[Prisma] Connected");
    // Redis connects automatically, but we verify it's alive
    await redis.ping();
    app.log.info("[Redis] Ping OK");
  });

  // Graceful shutdown
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
    await redis.quit();
    app.log.info("[Prisma] Disconnected");
    app.log.info("[Redis] Disconnected");
  });

  app.register(authPlugin);
  app.register(authRoutes);

  app.get("/health", async () => {
    return { status: "OK" };
  });

  // //For api-key testing route
  // app.get("/test", async () => {
  //   return { message: "authenticated" };
  // });

  return app;
}

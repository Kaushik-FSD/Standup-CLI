import Fastify from "fastify";
import { FastifyError } from "fastify";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import authPlugin from "./plugins/auth.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { logsRoutes } from "./modules/logs/logs.routes.js";
import { generateRoutes } from "./modules/generate/generate.routes.js";

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

  // Global error handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    app.log.error({ err: error, url: request.url }, "Unhandled error");

    // Known HTTP errors (4xx) — send as-is
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({ error: error.message });
    }

    // Unknown/server errors (5xx) — don't leak internals
    return reply.status(500).send({ error: "Internal server error" });
  });

  app.register(authPlugin);
  app.register(authRoutes);
  app.register(logsRoutes);
  app.register(generateRoutes);

  app.get("/health", async () => {
    return { status: "OK" };
  });

  // //For api-key testing route
  // app.get("/test", async () => {
  //   return { message: "authenticated" };
  // });

  return app;
}

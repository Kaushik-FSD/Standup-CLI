import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_PREFIX = "apikey:";
const PUBLIC_ROUTES = ["/health", "/api/auth/init"]; //used to exclude api's that dont need api key validation

const authPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    // Skip auth for health check
    if (PUBLIC_ROUTES.includes(request.url)) return;

    const apiKey = request.headers["x-api-key"];

    if (!apiKey || typeof apiKey !== "string") {
      return reply.status(401).send({ error: "Missing API key" });
    }

    // Redis cache check
    const cached = await redis.get(`${CACHE_PREFIX}${apiKey}`);
    if (cached) {
      request.log.info("[Auth] Cache hit");
      request.userId = cached;
      return;
    }

    // DB lookup
    const user = await prisma.user.findUnique({
      where: { apiKey },
      select: { id: true },
    });

    if (!user) {
      return reply.status(401).send({ error: "Invalid API key" });
    }

    //attach user id in request
    request.userId = user.id;

    // Cache for next time
    await redis.set(
      `${CACHE_PREFIX}${apiKey}`,
      user.id,
      "EX",
      CACHE_TTL_SECONDS,
    );
    request.log.info("[Auth] Cache miss — user cached");
  });
};

export default fp(authPlugin);

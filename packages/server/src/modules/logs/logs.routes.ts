import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { redis } from "../../lib/redis.js";

const getCacheKey = (userId: string) => `logs:${userId}:today`;

const getTTLUntilEndOfDay = (): number => {
  const now = new Date();
  const endOfDay = new Date();
  endOfDay.setUTCHours(23, 59, 59, 999);
  return Math.floor((endOfDay.getTime() - now.getTime()) / 1000);
};

export async function logsRoutes(app: FastifyInstance) {
  app.post("/api/logs", async (request, reply) => {
    const { content, isBlocker } = request.body as {
      content: string;
      isBlocker?: boolean;
    };

    if (!content || typeof content !== "string" || content.trim() === "") {
      return reply.status(400).send({ error: "Content is required" });
    }

    const log = await prisma.logEntry.create({
      data: {
        userId: request.userId,
        content: content.trim(),
        isBlocker: isBlocker ?? false,
        logDate: new Date(),
      },
    });

    // Invalidate cache
    await redis.del(getCacheKey(request.userId));

    return reply.status(201).send(log);
  });

  app.get("/api/logs", async (request, reply) => {
    const cacheKey = getCacheKey(request.userId);

    // Cache check
    const cached = await redis.get(cacheKey);
    if (cached) {
      request.log.info("[Logs] Cache hit");
      return reply.send(JSON.parse(cached));
    }

    //etches only today's logs, not all logs ever. So we filter by a date range.
    //startOfDay = 2026-03-25 00:00:00.000
    //endOfDay = 2026-03-25 23:59:59.999
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setUTCHours(23, 59, 59, 999);

    const logs = await prisma.logEntry.findMany({
      where: {
        userId: request.userId,
        logDate: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { createdAt: "asc" },
    });

    // Cache until end of UTC day
    await redis.set(
      cacheKey,
      JSON.stringify(logs),
      "EX",
      getTTLUntilEndOfDay(),
    );
    request.log.info("[Logs] Cache miss — logs cached");

    return reply.send(logs);
  });

  app.delete("/api/logs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const log = await prisma.logEntry.findUnique({ where: { id } });

    if (!log) {
      return reply.status(404).send({ error: "Log not found" });
    }

    if (log.userId !== request.userId) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    await prisma.logEntry.delete({ where: { id } });

    // Invalidate cache
    await redis.del(getCacheKey(request.userId));

    return reply.status(204).send();
  });
}

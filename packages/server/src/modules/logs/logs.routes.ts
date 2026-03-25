import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";

export async function logsRoutes(app: FastifyInstance) {
  // POST /api/logs — create a log entry
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

    return reply.status(201).send(log);
  });

  // GET /api/logs — get today's logs
  app.get("/api/logs", async (request, reply) => {
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

    return reply.send(logs);
  });

  // DELETE /api/logs/:id
  app.delete("/api/logs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const log = await prisma.logEntry.findUnique({ where: { id } });

    if (!log) {
      return reply.status(404).send({ error: "Log not found" });
    }

    if (log.userId !== request.userId) {
      return reply.status(403).send({ error: "Forbidden User" });
    }

    await prisma.logEntry.delete({ where: { id } });

    return reply.status(204).send();
  });
}

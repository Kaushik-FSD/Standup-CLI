import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { getAIProvider } from "../../lib/ai/index.js";
import {
  buildDailyPrompt,
  buildWeeklyPrompt,
} from "../../lib/ai/prompt.builder.js";

export async function generateRoutes(app: FastifyInstance) {
  // GET /api/generate — today's summary
  app.get("/api/generate", async (request, reply) => {
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

    if (logs.length === 0) {
      return reply
        .status(400)
        .send({ error: "No logs found for today. Add some logs first." });
    }

    const prompt = buildDailyPrompt(logs);
    const ai = getAIProvider();
    const summary = await ai.generate(prompt);

    return reply.send({ summary });
  });

  // GET /api/generate/weekly — this week's summary
  app.get("/api/generate/weekly", async (request, reply) => {
    const startOfWeek = new Date();
    startOfWeek.setUTCHours(0, 0, 0, 0);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay());

    const endOfWeek = new Date();
    endOfWeek.setUTCHours(23, 59, 59, 999);
    endOfWeek.setUTCDate(endOfWeek.getUTCDate() + (6 - endOfWeek.getUTCDay()));

    const logs = await prisma.logEntry.findMany({
      where: {
        userId: request.userId,
        logDate: { gte: startOfWeek, lte: endOfWeek },
      },
      orderBy: { createdAt: "asc" },
    });

    if (logs.length === 0) {
      return reply
        .status(400)
        .send({ error: "No logs found for this week. Add some logs first." });
    }

    const prompt = buildWeeklyPrompt(logs);
    const ai = getAIProvider();
    const summary = await ai.generate(prompt);

    return reply.send({ summary });
  });
}

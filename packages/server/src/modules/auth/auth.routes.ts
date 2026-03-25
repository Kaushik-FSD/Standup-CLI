import type { FastifyInstance } from "fastify";
import { randomBytes } from "crypto";
import { prisma } from "../../lib/prisma.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/init", async (request, reply) => {
    const { name } = request.body as { name: string };

    if (!name || typeof name !== "string" || name.trim() === "") {
      return reply.status(400).send({ error: "Name is required" });
    }

    const apiKey = `sb_${randomBytes(32).toString("hex")}`;

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        apiKey,
        timezone: "UTC",
      },
    });

    return reply.status(201).send({
      apiKey,
      userId: user.id,
      message: `User ${user.name} created successfully`,
    });
  });
}

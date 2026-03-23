import Fastify from "fastify";

export function buildApp(){
    const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname'
        }
      }
    }
  })

  app.get('/health', async () => {
    return { status: 'OK' }
  })

  return app;
}
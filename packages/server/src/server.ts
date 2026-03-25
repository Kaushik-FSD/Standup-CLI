import { buildApp } from "./app.js";
import dotenv from "dotenv";

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  const app = buildApp();

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Server running on port ${PORT}`);
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
}

start();

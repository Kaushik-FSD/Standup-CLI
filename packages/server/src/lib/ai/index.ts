import type { AIProvider } from "./types.js";
import { GeminiProvider } from "./gemini.provider.js";
import dotenv from "dotenv";

dotenv.config();

export const getAIProvider = (): AIProvider => {
  const provider = process.env.AI_PROVIDER ?? "gemini";

  switch (provider) {
    case "gemini":
      return new GeminiProvider();
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
};

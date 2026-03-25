import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider } from "./types.js";
import dotenv from "dotenv";

dotenv.config();

export class GeminiProvider implements AIProvider {
  private model;

  constructor() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
    this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
  }

  async generate(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }
}

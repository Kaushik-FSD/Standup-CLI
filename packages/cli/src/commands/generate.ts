import { Command } from "commander";
import { createHttpClient } from "../lib/http.js";
import { printError } from "../lib/printer.js";

export const generateCommand = new Command("generate")
  .description("Generate AI standup summary for today")
  .action(async () => {
    try {
      const http = createHttpClient();
      const response = await http.get("/api/generate");
      console.log("\n🤖 AI Standup Summary\n");
      console.log(response.data.summary);
      console.log();
    } catch (err: any) {
      printError(err?.response?.data?.error ?? "Failed to generate summary");
    }
  });

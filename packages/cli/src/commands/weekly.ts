import { Command } from "commander";
import { createHttpClient } from "../lib/http.js";
import { printError } from "../lib/printer.js";

export const weeklyCommand = new Command("weekly")
  .description("Generate AI weekly summary")
  .action(async () => {
    try {
      const http = createHttpClient();
      const response = await http.get("/api/generate/weekly");
      console.log("\n🤖 AI Weekly Summary\n");
      console.log(response.data.summary);
      console.log();
    } catch (err: any) {
      printError(
        err?.response?.data?.error ?? "Failed to generate weekly summary",
      );
    }
  });

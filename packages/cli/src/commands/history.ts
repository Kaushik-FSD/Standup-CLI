import { Command } from "commander";
import { createHttpClient } from "../lib/http.js";
import { printLogs, printError } from "../lib/printer.js";

export const historyCommand = new Command("history")
  .description("View today's standup logs")
  .action(async () => {
    try {
      const http = createHttpClient();
      const response = await http.get("/api/logs");
      printLogs(response.data);
    } catch (err: any) {
      printError(err?.response?.data?.error ?? "Failed to fetch logs");
    }
  });

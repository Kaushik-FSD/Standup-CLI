import { Command } from "commander";
import { createHttpClient } from "../lib/http.js";
import { printSuccess, printError } from "../lib/printer.js";

export const logCommand = new Command("log")
  .description("Add a standup log entry")
  .argument("<content>", "What did you work on?")
  .option("-b, --blocker", "Mark as a blocker")
  .action(async (content, options) => {
    try {
      const http = createHttpClient();
      await http.post("/api/logs", {
        content,
        isBlocker: options.blocker ?? false,
      });
      printSuccess(`Log added — "${content}"`);
    } catch (err: any) {
      printError(err?.response?.data?.error ?? "Failed to add log");
    }
  });

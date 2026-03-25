import { Command } from "commander";
import { createHttpClient } from "../lib/http.js";
import { printSuccess, printError } from "../lib/printer.js";

export const deleteCommand = new Command("delete")
  .description("Delete a standup log entry")
  .argument("<id>", "Log ID to delete")
  .action(async (id) => {
    try {
      const http = createHttpClient();
      await http.delete(`/api/logs/${id}`);
      printSuccess(`Log ${id} deleted`);
    } catch (err: any) {
      printError(err?.response?.data?.error ?? "Failed to delete log");
    }
  });

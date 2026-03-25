import type { LogEntry } from "./types.js";

export const printSuccess = (message: string): void => {
  console.log(`✅ ${message}`);
};

export const printError = (message: string): void => {
  console.error(`❌ ${message}`);
};

export const printLogs = (logs: LogEntry[]): void => {
  if (logs.length === 0) {
    console.log("📭 No logs found for today.");
    return;
  }

  console.log("\n📋 Today's standup logs:\n");
  logs.forEach((log, index) => {
    const blocker = log.isBlocker ? " 🚨 [BLOCKER]" : "";
    console.log(`  ${index + 1}. ${log.content}${blocker}`);
    console.log(`     id: ${log.id}\n`);
  });
};

import type { LogEntry } from "@prisma/client";

export const buildDailyPrompt = (logs: LogEntry[]): string => {
  const logLines = logs
    .map((log, i) => {
      const blocker = log.isBlocker ? " [BLOCKER]" : "";
      return `${i + 1}. ${log.content}${blocker}`;
    })
    .join("\n");

  return `You are a helpful assistant that generates professional daily standup summaries.

        Based on the following work logs, generate a concise standup summary with three sections:
        - What I did today
        - What I plan to do next
        - Blockers (if any)

        Keep it professional, concise, and in first person.

        Work logs:
        ${logLines}

        Generate the standup summary now:`;
};

export const buildWeeklyPrompt = (logs: LogEntry[]): string => {
  const logLines = logs
    .map((log, i) => {
      const blocker = log.isBlocker ? " [BLOCKER]" : "";
      return `${i + 1}. ${log.content}${blocker}`;
    })
    .join("\n");

  return `You are a helpful assistant that generates professional weekly standup summaries.

    Based on the following work logs from this week, generate a concise weekly summary with three sections:
    - Key accomplishments this week
    - Goals for next week
    - Blockers or concerns (if any)

    Keep it professional, concise, and in first person.

    Work logs:
    ${logLines}

    Generate the weekly summary now:`;
};

#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { logCommand } from "./commands/log.js";
import { historyCommand } from "./commands/history.js";
import { deleteCommand } from "./commands/delete.js";
import { generateCommand } from "./commands/generate.js";
import { weeklyCommand } from "./commands/weekly.js";

const program = new Command();

program.name("standup").description("AI-powered standup CLI").version("1.0.0");

// commands will be registered here
program.addCommand(initCommand);
program.addCommand(logCommand);
program.addCommand(historyCommand);
program.addCommand(deleteCommand);
program.addCommand(generateCommand);
program.addCommand(weeklyCommand);

program.parse(process.argv);

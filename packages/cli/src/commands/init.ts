import { Command } from "commander";
import axios from "axios";
import { saveConfig } from "../lib/config.js";
import { printSuccess, printError } from "../lib/printer.js";

const SERVER_URL = "http://localhost:9001";

export const initCommand = new Command("init")
  .description("Initialize standup CLI and create your account")
  .requiredOption("-n, --name <name>", "Your name")
  .action(async (options) => {
    try {
      const response = await axios.post(`${SERVER_URL}/api/auth/init`, {
        name: options.name,
      });

      const { apiKey } = response.data;

      saveConfig({ apiKey, serverUrl: SERVER_URL });

      printSuccess(`Initialized as ${options.name}`);
      console.log(`\n🔑 Your API key: ${apiKey}`);
      console.log(
        "This will not be shown again. It is saved in ~/.standup-cli/config.json\n",
      );
    } catch (err: any) {
      printError(err?.response?.data?.error ?? "Init failed");
    }
  });

import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".standup-cli"); // /Users/yourname/.standup-cli
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export interface Config {
  apiKey: string;
  serverUrl: string;
}

export const saveConfig = (config: Config): void => {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
};

export const loadConfig = (): Config => {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error("standupbot is not initialized. Run: standup init");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
};

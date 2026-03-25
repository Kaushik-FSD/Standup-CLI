import axios from "axios";
import { loadConfig } from "./config.js";

export const createHttpClient = () => {
  const config = loadConfig();

  return axios.create({
    baseURL: config.serverUrl,
    headers: {
      "x-api-key": config.apiKey,
      // "Content-Type": "application/json",
    },
  });
};

import type { Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";

loadEnvironment();

const port = Number(process.env.PORT ?? 3001);
const app = createApp({ environment: getRuntimeEnvironment() });

export function startServer(): Server {
  return app.listen(port, () => {
    console.log(`MCP permission checklist API listening on port ${port}`);
  });
}

startServer();

function getRuntimeEnvironment(): string {
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }

  const entryPath = fileURLToPath(import.meta.url);
  return entryPath.includes(`${path.sep}dist${path.sep}`) ? "production" : "development";
}

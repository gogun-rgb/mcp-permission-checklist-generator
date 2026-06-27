import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { checklistRouter } from "./routes/checklists.js";
import { getRuntimePaths } from "./config/paths.js";
import {
  addRenderExternalOrigin,
  isCorsOriginAllowed,
  parseAllowedOrigins
} from "./services/corsConfig.js";

export interface CreateAppOptions {
  allowedOrigins?: ReadonlySet<string>;
  clientDistPath?: string;
  environment?: string;
  trustProxy?: boolean;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const environment = options.environment ?? process.env.NODE_ENV ?? "development";
  const isProduction = environment === "production";
  const allowedOrigins =
    options.allowedOrigins ??
    addRenderExternalOrigin(
      parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
      process.env.RENDER_EXTERNAL_HOSTNAME
    );
  const trustProxy = options.trustProxy ?? process.env.TRUST_PROXY === "true";
  const clientDistPath = options.clientDistPath ?? getRuntimePaths().clientDistPath;

  app.disable("x-powered-by");
  if (trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false
    })
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (isCorsOriginAllowed(origin, allowedOrigins)) {
          callback(null, true);
          return;
        }

        callback(new Error("CORS origin is not allowed"));
      }
    })
  );
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.use("/api/checklists", checklistRouter);

  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "요청한 API를 찾을 수 없습니다." });
  });

  if (isProduction) {
    app.use(express.static(clientDistPath));
    app.get("*", (_request, response) => {
      response.sendFile(path.join(clientDistPath, "index.html"));
    });
  } else {
    app.use((_request, response) => {
      response.status(404).json({ error: "요청한 API를 찾을 수 없습니다." });
    });
  }

  app.use(
    (
      error: Error,
      _request: express.Request,
      response: express.Response,
      next: express.NextFunction
    ) => {
      void next;
      const message =
        isProduction ? "서버에서 요청을 처리하지 못했습니다." : error.message;

      response.status(500).json({ error: message });
    }
  );

  return app;
}

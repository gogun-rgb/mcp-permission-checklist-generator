import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { IncomingHttpHeaders } from "node:http";
import path from "node:path";
import { checklistRouter } from "./routes/checklists.js";
import { getRuntimePaths } from "./config/paths.js";
import {
  addRenderExternalOrigin,
  CorsOriginError,
  isCorsOriginAllowed,
  isCorsOriginError,
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
  const apiCors = cors((request, optionsCallback) => {
    const requestOrigin = getRequestOrigin(request);

    optionsCallback(null, {
      origin(origin, originCallback) {
        if (isCorsOriginAllowed(origin, allowedOrigins, requestOrigin)) {
          originCallback(null, true);
          return;
        }

        originCallback(new CorsOriginError());
      }
    });
  });

  app.disable("x-powered-by");
  if (trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false
    })
  );

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.use("/api", apiCors);
  app.use("/api", express.json({ limit: "32kb" }));
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
      if (isCorsOriginError(error)) {
        response.status(403).json({ error: "허용되지 않은 요청 출처입니다." });
        return;
      }

      const message =
        isProduction ? "서버에서 요청을 처리하지 못했습니다." : error.message;

      response.status(500).json({ error: message });
    }
  );

  return app;
}

function getRequestOrigin(request: {
  headers: IncomingHttpHeaders;
  protocol?: string;
}): string | undefined {
  const host = getHeaderValue(request.headers.host);

  if (!host) {
    return undefined;
  }

  const forwardedProtocol = getHeaderValue(request.headers["x-forwarded-proto"])
    ?.split(",")[0]
    ?.trim();
  const protocol = request.protocol || forwardedProtocol || "http";

  return `${protocol}://${host}`;
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

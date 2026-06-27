import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { checklistRouter } from "./routes/checklists";
import { isCorsOriginAllowed, parseAllowedOrigins } from "./services/corsConfig";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "server", ".env") });

const app = express();
const port = Number(process.env.PORT ?? 3001);
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
const trustProxy = process.env.TRUST_PROXY === "true";

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

app.use((_request, response) => {
  response.status(404).json({ error: "요청한 API를 찾을 수 없습니다." });
});

app.use(
  (
    error: Error,
    _request: express.Request,
    response: express.Response,
    next: express.NextFunction
  ) => {
    void next;
    const message =
      process.env.NODE_ENV === "production"
        ? "서버에서 요청을 처리하지 못했습니다."
        : error.message;

    response.status(500).json({ error: message });
  }
);

app.listen(port, () => {
  console.log(`MCP permission checklist API listening on port ${port}`);
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Server } from "node:http";
import { buildApiUrl } from "../client/src/utils/api";
import { checklistToMarkdown } from "../client/src/utils/formatters";
import { createApp } from "../server/src/app";
import { getEnvironmentPaths } from "../server/src/config/env";
import { getRuntimePaths } from "../server/src/config/paths";
import { generateChecklist } from "../server/src/services/checklistService";
import {
  addRenderExternalOrigin,
  isCorsOriginAllowed,
  parseAllowedOrigins
} from "../server/src/services/corsConfig";
import {
  buildOpenAiPayload,
  mergeEnhancement,
  parseEnhancement
} from "../server/src/services/openaiService";
import { createRateLimitTracker } from "../server/src/services/rateLimit";
import { createInMemoryRateLimiter } from "../server/src/services/rateLimit";
import {
  createRuleBasedChecklist,
  getTemplates
} from "../server/src/services/riskEngine";
import { validateChecklistRequest } from "../server/src/services/validation";
import type {
  ChecklistRequest,
  McpToolType,
  ScopeType
} from "@mcp-permission-checklist-generator/shared";

const originalOpenAiApiKey = process.env.OPENAI_API_KEY;

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  if (originalOpenAiApiKey) {
    process.env.OPENAI_API_KEY = originalOpenAiApiKey;
  } else {
    delete process.env.OPENAI_API_KEY;
  }
});

function makeRequest(
  toolType: McpToolType,
  permissionIds: string[],
  scopeType: ScopeType
): ChecklistRequest {
  return {
    toolType,
    toolName: `${toolType} MCP`,
    purpose: "테스트",
    permissionIds,
    scope: {
      type: scopeType,
      description: scopeType
    },
    credentials: ["none"],
    automation: "approve_every_time",
    extraContext: ""
  };
}

describe("rule-based MCP permission risk engine", () => {
  it("keeps GitHub read-only with a specific repository at LOW or MEDIUM", () => {
    const result = createRuleBasedChecklist(
      makeRequest(
        "github",
        ["github.read.repo_info", "github.read.code"],
        "specific_repository"
      )
    );

    expect(["LOW", "MEDIUM"]).toContain(result.overallRisk.level);
    expect(result.riskModelVersion).toBe("1.0.0");
    expect(result.analysisMode).toBe("RULE_ONLY");
  });

  it("rates GitHub Push plus PR merge as HIGH", () => {
    const result = createRuleBasedChecklist(
      makeRequest(
        "github",
        ["github.write.push", "github.write.pr_merge"],
        "specific_repository"
      )
    );

    expect(result.overallRisk.level).toBe("HIGH");
  });

  it("keeps Filesystem project-folder reads LOW", () => {
    const result = createRuleBasedChecklist(
      makeRequest(
        "filesystem",
        ["filesystem.read.list", "filesystem.read.content"],
        "specific_folder"
      )
    );

    expect(result.overallRisk.level).toBe("LOW");
  });

  it("rates Filesystem full drive plus deletion as CRITICAL", () => {
    const result = createRuleBasedChecklist(
      makeRequest(
        "filesystem",
        ["filesystem.write.file_delete"],
        "full_filesystem"
      )
    );

    expect(result.overallRisk.level).toBe("CRITICAL");
  });

  it("keeps Browser public reading LOW", () => {
    const result = createRuleBasedChecklist(
      makeRequest(
        "browser",
        ["browser.read.open_page", "browser.read.page_text"],
        "specific_domain"
      )
    );

    expect(result.overallRisk.level).toBe("LOW");
  });

  it("rates Browser login session plus form submit and upload as HIGH or CRITICAL", () => {
    const request = makeRequest(
      "browser",
      [
        "browser.sensitive.logged_in_session",
        "browser.interact.form_submit",
        "browser.interact.upload"
      ],
      "all_websites"
    );
    request.credentials = ["login_session"];

    const result = createRuleBasedChecklist(request);

    expect(["HIGH", "CRITICAL"]).toContain(result.overallRisk.level);
  });

  it("rates Secrets access as CRITICAL", () => {
    const result = createRuleBasedChecklist(
      makeRequest("github", ["github.sensitive.secrets"], "specific_repository")
    );

    expect(result.overallRisk.level).toBe("CRITICAL");
  });

  it("never returns a risk score above 100", () => {
    const templates = getTemplates();
    const allFilesystemPermissionIds = templates.filesystem.permissionGroups.flatMap((group) =>
      group.permissions.map((permission) => permission.id)
    );

    const result = createRuleBasedChecklist(
      makeRequest("filesystem", allFilesystemPermissionIds, "full_filesystem")
    );

    expect(result.overallRisk.score).toBeLessThanOrEqual(100);
  });

  it("returns rule-based results when OpenAI enhancement fails", async () => {
    const result = await generateChecklist(
      makeRequest("browser", ["browser.read.public_search"], "specific_domain"),
      async () => {
        throw new Error("OpenAI unavailable");
      }
    );

    expect(result.tool.type).toBe("browser");
    expect(result.permissions).toHaveLength(1);
    expect(result.overallRisk.score).toBeGreaterThanOrEqual(0);
    expect(result.analysisMode).toBe("RULE_ONLY");
  });

  it("uses RULE_ONLY when no OpenAI API key is configured", async () => {
    const result = await generateChecklist(
      makeRequest("github", ["github.read.repo_info"], "specific_repository")
    );

    expect(result.analysisMode).toBe("RULE_ONLY");
    expect(result.riskModelVersion).toBe("1.0.0");
  });

  it("uses RULE_WITH_AI_EXPLANATION only when an allowed AI enhancement is applied", () => {
    const baseResult = createRuleBasedChecklist(
      makeRequest(
        "github",
        ["github.write.push", "github.write.pr_merge"],
        "specific_repository"
      )
    );
    const enhancement = parseEnhancement(
      JSON.stringify({
        summary: "초보자에게 보여줄 짧은 설명입니다.",
        overallRisk: { level: "LOW", score: 0 },
        permissions: []
      })
    );

    expect(enhancement).not.toBeNull();
    const result = mergeEnhancement(baseResult, enhancement!);

    expect(result.analysisMode).toBe("RULE_WITH_AI_EXPLANATION");
    expect(result.overallRisk.level).toBe(baseResult.overallRisk.level);
    expect(result.overallRisk.score).toBe(baseResult.overallRisk.score);
    expect(result.permissions).toEqual(baseResult.permissions);
  });

  it("ignores invalid or irrelevant AI JSON", () => {
    expect(parseEnhancement("{not json")).toBeNull();
    expect(
      parseEnhancement(JSON.stringify({ overallRisk: { level: "LOW", score: 0 } }))
    ).toBeNull();
  });

  it("truncates very long AI sentences before merging", () => {
    const enhancement = parseEnhancement(
      JSON.stringify({
        summary: "가".repeat(500),
        warnings: ["나".repeat(500)]
      })
    );

    expect(enhancement?.summary).toHaveLength(180);
    expect(enhancement?.warnings?.[0]).toHaveLength(180);
  });

  it("normalizes none away when credentials include another credential", () => {
    const mixedRequest = makeRequest("github", ["github.read.repo_info"], "specific_repository");
    mixedRequest.credentials = ["none", "github_token"];
    const tokenRequest = makeRequest("github", ["github.read.repo_info"], "specific_repository");
    tokenRequest.credentials = ["github_token"];

    const mixedResult = createRuleBasedChecklist(mixedRequest);
    const tokenResult = createRuleBasedChecklist(tokenRequest);

    expect(mixedResult.overallRisk.score).toBe(tokenResult.overallRisk.score);
  });

  it("raises all repositories plus write permission to CRITICAL", () => {
    const result = createRuleBasedChecklist(
      makeRequest("github", ["github.write.file_modify"], "all_repositories")
    );

    expect(result.overallRisk.level).toBe("CRITICAL");
  });

  it("raises auto execution plus executable permission to CRITICAL", () => {
    const request = makeRequest(
      "filesystem",
      ["filesystem.sensitive.script_run"],
      "specific_folder"
    );
    request.automation = "auto_execute_all";

    const result = createRuleBasedChecklist(request);

    expect(result.overallRisk.level).toBe("CRITICAL");
  });

  it("raises cookies plus network transfer to CRITICAL", () => {
    const request = makeRequest("browser", ["browser.read.open_page"], "specific_domain");
    request.credentials = ["cookies"];

    const result = createRuleBasedChecklist(request);

    expect(result.overallRisk.level).toBe("CRITICAL");
  });

  it("rejects unknown permission IDs instead of silently lowering risk", () => {
    const validation = validateChecklistRequest({
      toolType: "github",
      toolName: "GitHub MCP",
      purpose: "test",
      permissionIds: ["github.write.puhs"],
      scope: {
        type: "specific_repository",
        description: "specific_repository"
      },
      credentials: ["none"],
      automation: "approve_every_time"
    });

    expect(validation.ok).toBe(false);
    expect(validation.error).toContain("지원하지 않는 권한 ID");
  });

  it("redacts user-derived secret text before building the OpenAI payload", () => {
    const githubPatPrefix = ["github", "pat"].join("_") + "_";
    const request = makeRequest(
      "browser",
      ["browser.read.public_search"],
      "specific_domain"
    );
    request.toolName = "Bearer abcdefghijklmnopqrstuvwxyz";
    request.purpose = "password is hunter2";
    request.scope.description = "sessionid=abcdef123456789";
    request.extraContext = `${githubPatPrefix}abcdefghijklmnopqrstuvwxyz`;

    const result = createRuleBasedChecklist(request);
    const payload = JSON.stringify(buildOpenAiPayload(result, request));

    expect(payload).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(payload).not.toContain("hunter2");
    expect(payload).not.toContain("abcdef123456789");
    expect(payload).toContain("Bearer ****");
    expect(payload).toContain("password ****");
    expect(payload).toContain("sessionid=****");
    expect(payload).toContain(`${githubPatPrefix}****`);
  });

  it("allows configured CORS origins and rejects unknown origins", () => {
    const allowedOrigins = parseAllowedOrigins("https://app.example.com, http://localhost:5173");

    expect(isCorsOriginAllowed("https://app.example.com", allowedOrigins)).toBe(true);
    expect(isCorsOriginAllowed(undefined, allowedOrigins)).toBe(true);
    expect(
      isCorsOriginAllowed(
        "http://127.0.0.1:3002",
        allowedOrigins,
        "http://127.0.0.1:3002"
      )
    ).toBe(true);
    expect(isCorsOriginAllowed("https://evil.example.com", allowedOrigins)).toBe(false);
  });

  it("allows single-service local and Render origins without exposing secrets", () => {
    const allowedOrigins = addRenderExternalOrigin(
      parseAllowedOrigins(undefined),
      "mcp-permission-checklist-generator.onrender.com"
    );

    expect(isCorsOriginAllowed("http://localhost:3001", allowedOrigins)).toBe(true);
    expect(isCorsOriginAllowed("http://127.0.0.1:3001", allowedOrigins)).toBe(true);
    expect(
      isCorsOriginAllowed(
        "https://mcp-permission-checklist-generator.onrender.com",
        allowedOrigins
      )
    ).toBe(true);
  });

  it("builds API URLs from empty or absolute base URLs", () => {
    expect(buildApiUrl("", "/api/checklists/generate")).toBe("/api/checklists/generate");
    expect(buildApiUrl(undefined, "api/checklists/generate")).toBe("/api/checklists/generate");
    expect(buildApiUrl("https://api.example.com/", "/api/checklists/generate")).toBe(
      "https://api.example.com/api/checklists/generate"
    );
  });

  it("calculates the repository root env path from src and dist module URLs", () => {
    const repositoryRoot = process.cwd();
    const sourceModuleUrl = pathToFileURL(
      path.join(repositoryRoot, "server", "src", "config", "env.ts")
    ).href;
    const distModuleUrl = pathToFileURL(
      path.join(repositoryRoot, "server", "dist", "config", "env.js")
    ).href;

    expect(getEnvironmentPaths(sourceModuleUrl).rootEnvPath).toBe(
      path.join(repositoryRoot, ".env")
    );
    expect(getEnvironmentPaths(distModuleUrl).rootEnvPath).toBe(
      path.join(repositoryRoot, ".env")
    );
  });

  it("calculates client dist path from src and dist module URLs", () => {
    const repositoryRoot = process.cwd();
    const sourceModuleUrl = pathToFileURL(
      path.join(repositoryRoot, "server", "src", "config", "paths.ts")
    ).href;
    const distModuleUrl = pathToFileURL(
      path.join(repositoryRoot, "server", "dist", "config", "paths.js")
    ).href;
    const expectedClientDist = path.join(repositoryRoot, "client", "dist");

    expect(getRuntimePaths(sourceModuleUrl).clientDistPath).toBe(expectedClientDist);
    expect(getRuntimePaths(distModuleUrl).clientDistPath).toBe(expectedClientDist);
  });

  it("does not pass server-only OpenAI keys through client config code", () => {
    const clientFiles = [
      path.join(process.cwd(), "client", "src", "App.tsx"),
      path.join(process.cwd(), "client", "src", "utils", "api.ts"),
      path.join(process.cwd(), "client", "vite.config.ts")
    ];

    for (const file of clientFiles) {
      expect(fs.readFileSync(file, "utf8")).not.toContain("OPENAI_API_KEY");
    }
  });

  it("limits repeated requests and recovers after the window", () => {
    let now = 0;
    const tracker = createRateLimitTracker({
      windowMs: 1_000,
      maxRequests: 2,
      now: () => now
    });

    expect(tracker.check("ip:a").allowed).toBe(true);
    expect(tracker.check("ip:a").allowed).toBe(true);
    expect(tracker.check("ip:a").allowed).toBe(false);
    expect(tracker.check("ip:b").allowed).toBe(true);

    now = 1_001;

    expect(tracker.check("ip:a").allowed).toBe(true);
  });

  it("prunes expired rate limit buckets and keeps active buckets", () => {
    let now = 0;
    const tracker = createRateLimitTracker({
      windowMs: 100,
      maxRequests: 1,
      cleanupIntervalMs: 50,
      now: () => now
    });

    tracker.check("ip:a");
    tracker.check("ip:b");
    tracker.check("ip:c");
    expect(tracker.size()).toBe(3);

    now = 50;
    expect(tracker.pruneExpired()).toBe(0);
    expect(tracker.size()).toBe(3);

    now = 101;
    expect(tracker.pruneExpired()).toBe(3);
    expect(tracker.size()).toBe(0);
    expect(tracker.check("ip:a").allowed).toBe(true);
  });

  it("limits rate limit bucket growth by removing the earliest reset buckets", () => {
    let now = 0;
    const tracker = createRateLimitTracker({
      windowMs: 1_000,
      maxRequests: 2,
      maxBuckets: 2,
      cleanupIntervalMs: 10_000,
      now: () => now
    });

    tracker.check("ip:a");
    now = 10;
    tracker.check("ip:b");
    now = 20;
    tracker.check("ip:c");

    expect(tracker.size()).toBe(2);
    expect(tracker.check("ip:b").allowed).toBe(true);
    expect(tracker.check("ip:b").allowed).toBe(false);
  });

  it("keeps rate limit response headers when requests are rejected", () => {
    let now = 0;
    const limiter = createInMemoryRateLimiter({
      windowMs: 1_000,
      maxRequests: 1,
      now: () => now
    });
    const request = { ip: "127.0.0.1", socket: {} };
    const firstResponse = createMockResponse();
    let nextCalled = false;

    limiter(request as never, firstResponse as never, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(firstResponse.headers.get("RateLimit-Remaining")).toBe("0");
    expect(firstResponse.headers.get("RateLimit-Reset")).toBe("1");

    const secondResponse = createMockResponse();
    limiter(request as never, secondResponse as never, () => {
      throw new Error("next should not be called");
    });

    expect(secondResponse.statusCode).toBe(429);
    expect(secondResponse.headers.get("Retry-After")).toBe("1");
    expect(secondResponse.headers.get("RateLimit-Remaining")).toBe("0");
    expect(secondResponse.body).toEqual({
      error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요."
    });

    now = 1_001;
    const recoveredResponse = createMockResponse();
    let recovered = false;
    limiter(request as never, recoveredResponse as never, () => {
      recovered = true;
    });

    expect(recovered).toBe(true);
  });

  it("includes risk model metadata in JSON and Markdown output", () => {
    const result = createRuleBasedChecklist(
      makeRequest("github", ["github.read.repo_info"], "specific_repository")
    );
    const json = JSON.stringify(result);
    const markdown = checklistToMarkdown(result);

    expect(json).toContain("riskModelVersion");
    expect(json).toContain("analysisMode");
    expect(markdown).toContain("위험 모델 버전: 1.0.0");
    expect(markdown).toContain("분석 모드: RULE_ONLY");
  });
});

describe("production Express app", () => {
  it("returns health JSON, serves static HTML and assets, keeps API JSON 404, and handles checklist API", async () => {
    const { clientDistPath, cleanup } = createStaticFixture();

    try {
      await withTestServer(clientDistPath, async (baseUrl) => {
        const sameOrigin = new URL(baseUrl).origin;
        const allowedExternalOrigin = "http://localhost:3002";
        const blockedOrigin = "https://evil.example";

        const healthResponse = await fetch(`${baseUrl}/health`, {
          headers: { Origin: blockedOrigin }
        });
        expect(healthResponse.status).toBe(200);
        expect(healthResponse.headers.get("content-type")).toContain("application/json");
        expect(await healthResponse.json()).toEqual({ ok: true });

        const rootResponse = await fetch(`${baseUrl}/`);
        expect(rootResponse.status).toBe(200);
        expect(rootResponse.headers.get("content-type")).toContain("text/html");
        const rootHtml = await rootResponse.text();
        expect(rootHtml).toContain("MCP test shell");

        const scriptSources = extractScriptSources(rootHtml);
        const stylesheetHrefs = extractStylesheetHrefs(rootHtml);
        expect(scriptSources).toEqual(["/assets/app.js"]);
        expect(stylesheetHrefs).toEqual(["/assets/app.css"]);

        for (const scriptSource of scriptSources) {
          const scriptResponse = await fetch(new URL(scriptSource, baseUrl), {
            headers: { Origin: allowedExternalOrigin }
          });
          const scriptBody = await scriptResponse.text();

          expect(scriptResponse.status).toBe(200);
          expect(scriptResponse.headers.get("content-type")).toMatch(/javascript/);
          expect(scriptBody).toContain("console.log");
          expect(scriptBody.trim().startsWith("{")).toBe(false);
          expect(scriptBody).not.toContain("MCP test shell");
        }

        for (const stylesheetHref of stylesheetHrefs) {
          const stylesheetResponse = await fetch(new URL(stylesheetHref, baseUrl), {
            headers: { Origin: allowedExternalOrigin }
          });
          const stylesheetBody = await stylesheetResponse.text();

          expect(stylesheetResponse.status).toBe(200);
          expect(stylesheetResponse.headers.get("content-type")).toContain("text/css");
          expect(stylesheetBody).toContain("color: #111827");
          expect(stylesheetBody.trim().startsWith("{")).toBe(false);
          expect(stylesheetBody).not.toContain("MCP test shell");
        }

        const spaResponse = await fetch(`${baseUrl}/settings/security`);
        expect(spaResponse.status).toBe(200);
        expect(spaResponse.headers.get("content-type")).toContain("text/html");
        expect(await spaResponse.text()).toContain("MCP test shell");

        const apiMissingResponse = await fetch(`${baseUrl}/api/missing`, {
          headers: { Origin: allowedExternalOrigin }
        });
        expect(apiMissingResponse.status).toBe(404);
        expect(apiMissingResponse.headers.get("content-type")).toContain("application/json");
        expect(await apiMissingResponse.json()).toEqual({
          error: "요청한 API를 찾을 수 없습니다."
        });

        const sameOriginApiMissingResponse = await fetch(`${baseUrl}/api/missing`, {
          headers: { Origin: sameOrigin }
        });
        expect(sameOriginApiMissingResponse.status).toBe(404);
        expect(sameOriginApiMissingResponse.headers.get("content-type")).toContain(
          "application/json"
        );
        expect(await sameOriginApiMissingResponse.json()).toEqual({
          error: "요청한 API를 찾을 수 없습니다."
        });

        const blockedApiResponse = await fetch(`${baseUrl}/api/missing`, {
          headers: { Origin: blockedOrigin }
        });
        expect(blockedApiResponse.status).toBe(403);
        expect(blockedApiResponse.headers.get("content-type")).toContain("application/json");
        expect(await blockedApiResponse.json()).toEqual({
          error: "허용되지 않은 요청 출처입니다."
        });

        const checklistResponse = await fetch(`${baseUrl}/api/checklists/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: sameOrigin
          },
          body: JSON.stringify(
            makeRequest("github", ["github.read.repo_info"], "specific_repository")
          )
        });
        const checklist = await checklistResponse.json();

        expect(checklistResponse.status).toBe(200);
        expect(checklist.analysisMode).toBe("RULE_ONLY");
        expect(checklist.riskModelVersion).toBe("1.0.0");
      });
    } finally {
      cleanup();
    }
  });
});

function createMockResponse() {
  const response = {
    headers: new Map<string, string>(),
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers.set(name, String(value));
      return this;
    },
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  };

  return response;
}

function createStaticFixture() {
  const clientDistPath = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-client-dist-"));
  fs.mkdirSync(path.join(clientDistPath, "assets"));
  fs.writeFileSync(
    path.join(clientDistPath, "index.html"),
    [
      "<!doctype html>",
      "<html>",
      "<head>",
      "<link rel=\"stylesheet\" href=\"/assets/app.css\">",
      "</head>",
      "<body>",
      "<div id=\"root\">MCP test shell</div>",
      "<script type=\"module\" src=\"/assets/app.js\"></script>",
      "</body>",
      "</html>"
    ].join(""),
    "utf8"
  );
  fs.writeFileSync(path.join(clientDistPath, "assets", "app.js"), "console.log('ok');", "utf8");
  fs.writeFileSync(
    path.join(clientDistPath, "assets", "app.css"),
    "body { color: #111827; }",
    "utf8"
  );

  return {
    clientDistPath,
    cleanup() {
      fs.rmSync(clientDistPath, { recursive: true, force: true });
    }
  };
}

async function withTestServer(
  clientDistPath: string,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = createApp({
    environment: "production",
    clientDistPath,
    allowedOrigins: new Set(["http://127.0.0.1", "http://localhost:3002"])
  });
  const server: Server = app.listen(0);

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to start test server");
    }

    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

function extractScriptSources(html: string): string[] {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(
    (match) => match[1]
  );
}

function extractStylesheetHrefs(html: string): string[] {
  return [
    ...html.matchAll(
      /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/gi
    )
  ].map((match) => match[1]);
}

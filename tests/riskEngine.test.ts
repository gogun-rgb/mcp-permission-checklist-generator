import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checklistToMarkdown } from "../client/src/utils/formatters";
import { generateChecklist } from "../server/src/services/checklistService";
import { isCorsOriginAllowed, parseAllowedOrigins } from "../server/src/services/corsConfig";
import {
  buildOpenAiPayload,
  mergeEnhancement,
  parseEnhancement
} from "../server/src/services/openaiService";
import { createRateLimitTracker } from "../server/src/services/rateLimit";
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
    expect(isCorsOriginAllowed("https://evil.example.com", allowedOrigins)).toBe(false);
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

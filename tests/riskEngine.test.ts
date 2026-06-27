import { describe, expect, it } from "vitest";
import { generateChecklist } from "../server/src/services/checklistService";
import { buildOpenAiPayload } from "../server/src/services/openaiService";
import {
  createRuleBasedChecklist,
  getTemplates
} from "../server/src/services/riskEngine";
import { validateChecklistRequest } from "../server/src/services/validation";
import type {
  ChecklistRequest,
  McpToolType,
  ScopeType
} from "../server/src/types/checklist";

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
});

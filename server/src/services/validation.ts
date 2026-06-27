import type {
  AutomationMode,
  ChecklistRequest,
  CredentialType,
  McpTemplateMap,
  McpToolType,
  ScopeType
} from "../types/checklist";
import templatesJson from "../templates/mcpTemplates.json";
import { containsSensitiveText } from "./redaction";

const toolTypes: McpToolType[] = ["github", "filesystem", "browser", "custom"];
const scopeTypes: ScopeType[] = [
  "specific_repository",
  "all_repositories",
  "specific_folder",
  "full_filesystem",
  "specific_domain",
  "all_websites",
  "custom"
];
const credentialTypes: CredentialType[] = [
  "api_token",
  "github_token",
  "cookies",
  "login_session",
  "none"
];
const automationModes: AutomationMode[] = [
  "approve_every_time",
  "approve_risky_only",
  "auto_execute_all"
];

const templates = templatesJson as McpTemplateMap;

export interface ValidationResult {
  ok: boolean;
  value?: ChecklistRequest;
  error?: string;
}

export function validateChecklistRequest(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return fail("요청 본문이 올바른 JSON 객체가 아닙니다.");
  }

  const toolType = readEnum(input.toolType, toolTypes);
  if (!toolType) {
    return fail("지원하지 않는 MCP 종류입니다.");
  }

  const toolName = readText(input.toolName, 80) || `${toolType} MCP`;
  const purpose = readText(input.purpose, 140);
  if (!purpose) {
    return fail("사용 목적을 입력하세요.");
  }

  const permissionIds = readStringArray(input.permissionIds, 80, 120);
  if (permissionIds.length === 0) {
    return fail("최소 하나 이상의 권한을 선택하세요.");
  }

  const validPermissionIds = new Set(
    templates[toolType].permissionGroups.flatMap((group) =>
      group.permissions.map((permission) => permission.id)
    )
  );
  const unknownPermissionIds = permissionIds.filter((id) => !validPermissionIds.has(id));
  if (unknownPermissionIds.length > 0) {
    return fail(`지원하지 않는 권한 ID가 포함되어 있습니다: ${unknownPermissionIds.join(", ")}`);
  }

  const scopeInput = isRecord(input.scope) ? input.scope : {};
  const scopeType = readEnum(scopeInput.type, scopeTypes);
  if (!scopeType) {
    return fail("접근 범위가 올바르지 않습니다.");
  }

  const scopeDescription = readText(scopeInput.description, 140) || "직접 입력한 범위";
  const credentials = readEnumArray(input.credentials, credentialTypes, 8);
  const automation = readEnum(input.automation, automationModes);
  if (!automation) {
    return fail("자동 실행 여부가 올바르지 않습니다.");
  }

  const extraContext = readText(input.extraContext, 1000);
  const joinedText = [toolName, purpose, scopeDescription, extraContext].join(" ");
  if (containsSensitiveText(joinedText)) {
    return fail("요청에 실제 토큰, 비밀번호, 비밀값처럼 보이는 문자열이 포함되어 있습니다.");
  }

  return {
    ok: true,
    value: {
      toolType,
      toolName,
      purpose,
      permissionIds,
      scope: {
        type: scopeType,
        description: scopeDescription
      },
      credentials: credentials.length > 0 ? credentials : ["none"],
      automation,
      extraContext
    }
  };
}

function fail(error: string): ValidationResult {
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return stripControlCharacters(value).trim().slice(0, maxLength);
}

function readStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => readText(item, maxLength))
        .filter(Boolean)
    )
  ).slice(0, maxItems);
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return allowed.includes(value as T) ? (value as T) : undefined;
}

function readEnumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  maxItems: number
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.map((item) => readEnum(item, allowed)).filter((item): item is T => Boolean(item)))
  ).slice(0, maxItems);
}

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
}

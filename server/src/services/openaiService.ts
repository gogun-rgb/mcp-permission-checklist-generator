import OpenAI from "openai";
import type {
  AiChecklistEnhancement,
  ChecklistRequest,
  ChecklistResult
} from "@mcp-permission-checklist-generator/shared";
import { redactSensitiveText } from "./redaction.js";

const defaultModel = "gpt-4.1-mini";

export async function enhanceWithOpenAI(
  result: ChecklistResult,
  request: ChecklistRequest
): Promise<ChecklistResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return result;
  }

  const client = new OpenAI({
    apiKey,
    timeout: 8_000,
    maxRetries: 0
  });

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || defaultModel,
    temperature: 0.2,
    max_tokens: 700,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write concise Korean security UX guidance for beginners. Return only JSON with optional keys: summary, warnings, minimumPrivilegeRecommendations, approvalStepDescriptions. Do not request or echo secrets."
      },
      {
        role: "user",
        content: JSON.stringify(buildOpenAiPayload(result, request))
      }
    ]
  });

  const content = response.choices[0]?.message?.content;
  const enhancement = parseEnhancement(content);

  if (!enhancement) {
    return result;
  }

  return mergeEnhancement(result, enhancement);
}

export function buildOpenAiPayload(result: ChecklistResult, request: ChecklistRequest) {
  return {
    tool: {
      name: redactSensitiveText(result.tool.name),
      type: result.tool.type,
      purpose: redactSensitiveText(result.tool.purpose)
    },
    scope: {
      description: redactSensitiveText(result.scope.description),
      isRestricted: result.scope.isRestricted
    },
    overallRisk: result.overallRisk,
    permissions: result.permissions.map((permission) => ({
      name: permission.name,
      category: permission.category,
      riskLevel: permission.riskLevel,
      approval: permission.recommendedApproval
    })),
    credentials: request.credentials,
    automation: request.automation,
    extraContext: redactSensitiveText(request.extraContext ?? "")
  };
}

export function mergeEnhancement(
  result: ChecklistResult,
  enhancement: AiChecklistEnhancement
): ChecklistResult {
  const warnings = new Set(result.warnings);
  const recommendations = new Set(result.minimumPrivilegeRecommendations);

  for (const warning of enhancement.warnings ?? []) {
    warnings.add(warning);
  }

  for (const recommendation of enhancement.minimumPrivilegeRecommendations ?? []) {
    recommendations.add(recommendation);
  }

  return {
    ...result,
    analysisMode: "RULE_WITH_AI_EXPLANATION",
    overallRisk: {
      ...result.overallRisk,
      summary: enhancement.summary || result.overallRisk.summary
    },
    approvalSteps: result.approvalSteps.map((step) => ({
      ...step,
      description:
        enhancement.approvalStepDescriptions?.[step.order] ?? step.description
    })),
    warnings: Array.from(warnings).slice(0, 8),
    minimumPrivilegeRecommendations: Array.from(recommendations).slice(0, 10)
  };
}

export function parseEnhancement(
  content: string | null | undefined
): AiChecklistEnhancement | null {
  if (!content) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(content);

    if (!isRecord(parsed)) {
      return null;
    }

    const enhancement = {
      summary: readOptionalText(parsed.summary, 180),
      warnings: readTextArray(parsed.warnings, 4, 180),
      minimumPrivilegeRecommendations: readTextArray(
        parsed.minimumPrivilegeRecommendations,
        4,
        180
      ),
      approvalStepDescriptions: readApprovalDescriptions(parsed.approvalStepDescriptions)
    };

    if (
      !enhancement.summary &&
      !enhancement.warnings &&
      !enhancement.minimumPrivilegeRecommendations &&
      !enhancement.approvalStepDescriptions
    ) {
      return null;
    }

    return enhancement;
  } catch {
    return null;
  }
}

function readApprovalDescriptions(value: unknown): Record<number, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([key, description]) => [Number(key), readOptionalText(description, 180)] as const)
    .filter(([key, description]) => Number.isInteger(key) && Boolean(description));

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries) as Record<number, string>;
}

function readTextArray(value: unknown, maxItems: number, maxLength: number): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value
    .map((item) => readOptionalText(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);

  return values.length > 0 ? values : undefined;
}

function readOptionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const text = stripControlCharacters(redactSensitiveText(value))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return text || undefined;
}

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import OpenAI from "openai";
import type {
  AiChecklistEnhancement,
  ChecklistRequest,
  ChecklistResult
} from "../types/checklist";

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
        content: JSON.stringify({
          tool: result.tool,
          scope: result.scope,
          overallRisk: result.overallRisk,
          permissions: result.permissions.map((permission) => ({
            name: permission.name,
            category: permission.category,
            riskLevel: permission.riskLevel,
            approval: permission.recommendedApproval
          })),
          credentials: request.credentials,
          automation: request.automation,
          extraContext: scrubSensitiveText(request.extraContext ?? "")
        })
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

function mergeEnhancement(
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

function parseEnhancement(content: string | null | undefined): AiChecklistEnhancement | null {
  if (!content) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(content);

    if (!isRecord(parsed)) {
      return null;
    }

    return {
      summary: readOptionalText(parsed.summary, 180),
      warnings: readTextArray(parsed.warnings, 4, 180),
      minimumPrivilegeRecommendations: readTextArray(
        parsed.minimumPrivilegeRecommendations,
        4,
        180
      ),
      approvalStepDescriptions: readApprovalDescriptions(parsed.approvalStepDescriptions)
    };
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

  const text = stripControlCharacters(scrubSensitiveText(value))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return text || undefined;
}

function scrubSensitiveText(value: string): string {
  return value
    .replace(/sk-[a-zA-Z0-9_-]{8,}/g, "sk-****")
    .replace(/ghp_[a-zA-Z0-9_]{8,}/g, "ghp_****")
    .replace(/github_pat_[a-zA-Z0-9_]{8,}/g, "github_pat_****")
    .replace(/(password|secret|token)\s*=\s*[^\s]+/gi, "$1=****");
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

import { enhanceWithOpenAI } from "./openaiService.js";
import { createRuleBasedChecklist } from "./riskEngine.js";
import type {
  ChecklistRequest,
  ChecklistResult
} from "@mcp-permission-checklist-generator/shared";

type ChecklistEnhancer = (
  result: ChecklistResult,
  request: ChecklistRequest
) => Promise<ChecklistResult>;

export async function generateChecklist(
  request: ChecklistRequest,
  enhancer: ChecklistEnhancer = enhanceWithOpenAI
): Promise<ChecklistResult> {
  const ruleBasedResult = createRuleBasedChecklist(request);

  try {
    return await enhancer(ruleBasedResult, request);
  } catch {
    return ruleBasedResult;
  }
}

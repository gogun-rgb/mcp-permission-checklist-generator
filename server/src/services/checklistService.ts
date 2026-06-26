import { enhanceWithOpenAI } from "./openaiService";
import { createRuleBasedChecklist } from "./riskEngine";
import type { ChecklistRequest, ChecklistResult } from "../types/checklist";

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

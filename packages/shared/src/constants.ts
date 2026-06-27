import type { AnalysisMode } from "./checklist-types";

export const RISK_MODEL_VERSION = "1.0.0";

export const ANALYSIS_MODE_LABELS: Record<AnalysisMode, string> = {
  RULE_ONLY: "규칙 기반 분석",
  RULE_WITH_AI_EXPLANATION: "AI 설명 보강 적용"
};

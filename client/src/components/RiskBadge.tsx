import type { RiskLevel } from "../types/checklist";
import { riskLabels } from "../utils/formatters";

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
}

export function RiskBadge({ level, score }: RiskBadgeProps) {
  return (
    <span className={`risk-badge risk-${level.toLowerCase()}`}>
      {riskLabels[level]}
      {typeof score === "number" ? ` · ${score}` : ""}
    </span>
  );
}

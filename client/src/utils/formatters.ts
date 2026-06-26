import type {
  ApprovalType,
  ChecklistResult,
  PermissionCategory,
  RiskLevel
} from "../types/checklist";

export const riskLabels: Record<RiskLevel, string> = {
  LOW: "LOW 낮음",
  MEDIUM: "MEDIUM 보통",
  HIGH: "HIGH 높음",
  CRITICAL: "CRITICAL 매우 높음"
};

export const approvalLabels: Record<ApprovalType, string> = {
  NO_APPROVAL: "승인 불필요",
  SESSION_APPROVAL: "세션 1회 승인",
  EACH_ACTION_APPROVAL: "매 작업 승인",
  BLOCK_BY_DEFAULT: "기본 차단"
};

export const categoryLabels: Record<PermissionCategory, string> = {
  read: "읽기",
  write: "쓰기",
  delete: "삭제",
  execute: "실행",
  credential: "인증정보",
  network: "네트워크"
};

export function checklistToMarkdown(result: ChecklistResult): string {
  const permissionRows = result.permissions
    .map(
      (permission) =>
        `| ${escapeMarkdown(permission.name)} | ${categoryLabels[permission.category]} | ${permission.riskLevel} ${permission.riskScore} | ${approvalLabels[permission.recommendedApproval]} | ${escapeMarkdown(permission.saferAlternative)} |`
    )
    .join("\n");

  const approvalRows = result.approvalSteps
    .map(
      (step) =>
        `${step.order}. **${escapeMarkdown(step.action)}** - ${escapeMarkdown(step.description)}`
    )
    .join("\n");

  const logRows = result.recommendedLogs
    .map(
      (log) =>
        `| ${escapeMarkdown(log.field)} | ${escapeMarkdown(log.description)} | ${log.required ? "예" : "아니오"} | ${log.sensitive ? "예" : "아니오"} |`
    )
    .join("\n");

  return `# MCP 권한 점검표

## 기본 정보

- MCP 이름: ${escapeMarkdown(result.tool.name)}
- MCP 종류: ${result.tool.type}
- 사용 목적: ${escapeMarkdown(result.tool.purpose)}
- 접근 범위: ${escapeMarkdown(result.scope.description)}
- 생성 시각: ${result.generatedAt}

## 전체 위험도

- 위험도: **${result.overallRisk.level}**
- 점수: **${result.overallRisk.score}/100**
- 요약: ${escapeMarkdown(result.overallRisk.summary)}

## 핵심 경고

${result.warnings.map((warning) => `- ${escapeMarkdown(warning)}`).join("\n")}

## 권한별 분석

| 권한 | 범주 | 위험도 | 추천 승인 | 더 안전한 대안 |
| --- | --- | --- | --- | --- |
${permissionRows}

## 필요한 사용자 승인

${approvalRows}

## 추천 로그 항목

| 필드 | 설명 | 필수 | 민감 |
| --- | --- | --- | --- |
${logRows}

## 최소 권한 설정

${result.minimumPrivilegeRecommendations
  .map((recommendation) => `- ${escapeMarkdown(recommendation)}`)
  .join("\n")}

## 연결 전 체크리스트

${result.preConnectionChecklist
  .map((item) => `- [ ] ${escapeMarkdown(item.label)}${item.critical ? " *(중요)*" : ""}`)
  .join("\n")}
`;
}

export function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

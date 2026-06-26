import templatesJson from "../templates/mcpTemplates.json";
import type {
  ApprovalStep,
  ApprovalType,
  AutomationMode,
  ChecklistRequest,
  ChecklistResult,
  CredentialType,
  McpTemplate,
  McpTemplateMap,
  PermissionAnalysis,
  RecommendedLog,
  RiskLevel,
  ScopeType,
  TemplatePermission
} from "../types/checklist";

const templates = templatesJson as McpTemplateMap;

const riskLevelOrder: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3
};

const approvalLabels: Record<ApprovalType, string> = {
  NO_APPROVAL: "승인 불필요",
  SESSION_APPROVAL: "세션 1회 승인",
  EACH_ACTION_APPROVAL: "매 작업 승인",
  BLOCK_BY_DEFAULT: "기본 차단"
};

const scopeRules: Record<
  ScopeType,
  { label: string; restricted: boolean; score: number; warning?: string }
> = {
  specific_repository: {
    label: "특정 저장소",
    restricted: true,
    score: -10
  },
  all_repositories: {
    label: "모든 저장소",
    restricted: false,
    score: 35,
    warning: "모든 저장소 접근은 불필요한 저장소까지 노출할 수 있습니다."
  },
  specific_folder: {
    label: "특정 폴더",
    restricted: true,
    score: -10
  },
  full_filesystem: {
    label: "전체 파일시스템",
    restricted: false,
    score: 45,
    warning: "전체 파일시스템 접근은 개인 파일과 비밀정보까지 포함할 수 있습니다."
  },
  specific_domain: {
    label: "특정 도메인",
    restricted: true,
    score: -10
  },
  all_websites: {
    label: "모든 웹사이트",
    restricted: false,
    score: 20,
    warning: "모든 웹사이트 접근은 피싱 사이트나 의도하지 않은 사이트에서도 동작할 수 있습니다."
  },
  custom: {
    label: "직접 입력한 범위",
    restricted: false,
    score: 0
  }
};

const credentialRules: Record<
  CredentialType,
  { label: string; score: number; warning?: string }
> = {
  api_token: {
    label: "API 토큰",
    score: 15,
    warning: "API 토큰 원문은 로그와 AI 요청에 포함하면 안 됩니다."
  },
  github_token: {
    label: "GitHub 토큰",
    score: 20,
    warning: "GitHub 토큰은 저장소 권한을 대신 행사할 수 있으므로 마스킹해야 합니다."
  },
  cookies: {
    label: "쿠키",
    score: 30,
    warning: "쿠키는 로그인 상태를 증명하므로 원문 접근과 저장을 차단하세요."
  },
  login_session: {
    label: "로그인 세션",
    score: 30,
    warning: "로그인 세션 사용 시 사용자 명의로 작업이 실행될 수 있습니다."
  },
  none: {
    label: "없음",
    score: 0
  }
};

const automationRules: Record<
  AutomationMode,
  { label: string; score: number; warning?: string }
> = {
  approve_every_time: {
    label: "사용자가 매번 승인",
    score: -10
  },
  approve_risky_only: {
    label: "위험 작업만 승인",
    score: 0
  },
  auto_execute_all: {
    label: "모든 작업 자동 실행",
    score: 25,
    warning: "모든 작업 자동 실행은 삭제, 배포, 외부 전송 사고를 키울 수 있습니다."
  }
};

const recommendedLogs: RecommendedLog[] = [
  {
    field: "timestamp",
    description: "작업이 요청된 정확한 시각",
    required: true,
    sensitive: false
  },
  {
    field: "sessionId",
    description: "사용자 승인 흐름을 추적하기 위한 세션 식별자",
    required: true,
    sensitive: false
  },
  {
    field: "mcpServerName",
    description: "작업을 수행한 MCP 서버 이름",
    required: true,
    sensitive: false
  },
  {
    field: "toolType",
    description: "github, filesystem, browser 같은 MCP 유형",
    required: true,
    sensitive: false
  },
  {
    field: "requestedAction",
    description: "사용자가 요청한 작업 요약",
    required: true,
    sensitive: false
  },
  {
    field: "targetResource",
    description: "저장소, 폴더, URL 등 작업 대상",
    required: true,
    sensitive: false
  },
  {
    field: "permissionUsed",
    description: "작업에 실제로 사용된 권한",
    required: true,
    sensitive: false
  },
  {
    field: "approvalType",
    description: "적용된 승인 방식",
    required: true,
    sensitive: false
  },
  {
    field: "approvalResult",
    description: "승인, 거절, 시간 초과 결과",
    required: true,
    sensitive: false
  },
  {
    field: "operationResult",
    description: "작업 성공, 실패, 취소 결과",
    required: true,
    sensitive: false
  },
  {
    field: "changedFiles",
    description: "변경된 파일 목록. 파일 내용 원문은 저장하지 않습니다.",
    required: true,
    sensitive: false
  },
  {
    field: "beforeHash",
    description: "변경 전 파일 또는 커밋 해시",
    required: true,
    sensitive: false
  },
  {
    field: "afterHash",
    description: "변경 후 파일 또는 커밋 해시",
    required: true,
    sensitive: false
  },
  {
    field: "errorMessage",
    description: "사용자에게 보여줄 수 있는 정제된 오류 메시지",
    required: true,
    sensitive: false
  },
  {
    field: "rollbackAvailable",
    description: "되돌리기 가능한지 여부",
    required: true,
    sensitive: false
  }
];

export function getTemplates(): McpTemplateMap {
  return templates;
}

export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 75) {
    return "CRITICAL";
  }

  if (score >= 50) {
    return "HIGH";
  }

  if (score >= 25) {
    return "MEDIUM";
  }

  return "LOW";
}

export function createRuleBasedChecklist(request: ChecklistRequest): ChecklistResult {
  const template = getTemplate(request.toolType);
  const permissions = selectPermissions(template, request.permissionIds);
  const permissionAnalyses = permissions.map(toPermissionAnalysis);
  const scopeRule = scopeRules[request.scope.type];
  const credentialList = normalizeCredentials(request.credentials);
  const hasCredentialUse = credentialList.some((credential) => credential !== "none");
  const hasWrite = permissions.some((permission) =>
    ["write", "delete", "execute", "network"].includes(permission.category)
  );
  const hasDelete = permissions.some((permission) => permission.category === "delete");
  const hasExecute = permissions.some((permission) => permission.category === "execute");
  const hasCriticalPermission = permissions.some((permission) => permission.critical);
  const hasForceCriticalPermission = permissions.some((permission) => permission.forceCritical);
  const readOnly = isReadOnly(permissions);

  const permissionImpactScore = permissions.reduce(
    (total, permission) => total + permission.scoreImpact,
    0
  );
  const maxPermissionScore = permissions.reduce(
    (maxScore, permission) => Math.max(maxScore, permission.riskScore),
    0
  );
  let contextualScore = scopeRule.score;
  contextualScore += credentialList.reduce(
    (total, credential) => total + credentialRules[credential].score,
    0
  );
  contextualScore += automationRules[request.automation].score;

  if (readOnly) {
    contextualScore -= 15;
  }

  let score = Math.max(
    permissionImpactScore + contextualScore,
    maxPermissionScore + contextualScore
  );

  let forcedMinimum = hasCriticalPermission ? 50 : 0;
  let forceCritical = hasForceCriticalPermission;

  if (request.scope.type === "full_filesystem" && hasDelete) {
    forcedMinimum = Math.max(forcedMinimum, 75);
  }

  if (request.scope.type === "all_repositories" && hasWrite) {
    forcedMinimum = Math.max(forcedMinimum, 75);
  }

  if (request.automation === "auto_execute_all" && (hasDelete || hasExecute)) {
    forcedMinimum = Math.max(forcedMinimum, 75);
    forceCritical = true;
  }

  if (
    credentialList.includes("cookies") &&
    permissions.some((permission) => permission.category === "network")
  ) {
    forcedMinimum = Math.max(forcedMinimum, 75);
  }

  score = clamp(Math.max(score, forcedMinimum), 0, 100);
  const level = forceCritical ? "CRITICAL" : scoreToRiskLevel(score);
  const normalizedScore = forceCritical ? Math.max(score, 75) : score;

  const warnings = buildWarnings({
    permissions,
    scopeType: request.scope.type,
    credentialList,
    automation: request.automation,
    hasCredentialUse
  });

  const approvalSteps = buildApprovalSteps({
    permissions: permissionAnalyses,
    scopeType: request.scope.type,
    credentialList,
    automation: request.automation
  });

  return {
    tool: {
      name: request.toolName || template.defaultName,
      type: request.toolType,
      purpose: request.purpose
    },
    scope: {
      description: request.scope.description || scopeRule.label,
      isRestricted: scopeRule.restricted
    },
    overallRisk: {
      level,
      score: normalizedScore,
      summary: summarizeRisk(level, readOnly, hasWrite, hasCredentialUse, scopeRule.restricted)
    },
    permissions: permissionAnalyses,
    approvalSteps,
    recommendedLogs,
    minimumPrivilegeRecommendations: buildMinimumPrivilegeRecommendations(
      template,
      request.scope.type,
      permissions,
      credentialList
    ),
    preConnectionChecklist: buildPreConnectionChecklist(
      request.toolType,
      permissionAnalyses,
      request.scope.type,
      credentialList
    ),
    warnings,
    generatedAt: new Date().toISOString()
  };
}

function getTemplate(toolType: ChecklistRequest["toolType"]): McpTemplate {
  return templates[toolType] ?? templates.custom;
}

function flattenPermissions(template: McpTemplate): TemplatePermission[] {
  return template.permissionGroups.flatMap((group) => group.permissions);
}

function selectPermissions(
  template: McpTemplate,
  permissionIds: string[]
): TemplatePermission[] {
  const permissionMap = new Map(
    flattenPermissions(template).map((permission) => [permission.id, permission])
  );

  return permissionIds
    .map((id) => permissionMap.get(id))
    .filter((permission): permission is TemplatePermission => Boolean(permission));
}

function toPermissionAnalysis(permission: TemplatePermission): PermissionAnalysis {
  return {
    id: permission.id,
    name: permission.name,
    category: permission.category,
    riskLevel: scoreToRiskLevel(permission.riskScore),
    riskScore: clamp(permission.riskScore, 0, 100),
    reason: permission.reason,
    recommendedApproval: permission.recommendedApproval,
    saferAlternative: permission.saferAlternative
  };
}

function normalizeCredentials(credentials: CredentialType[]): CredentialType[] {
  const unique = Array.from(new Set(credentials));

  if (unique.length === 0 || unique.includes("none")) {
    return unique.length > 1 ? unique.filter((credential) => credential !== "none") : ["none"];
  }

  return unique;
}

function isReadOnly(permissions: TemplatePermission[]): boolean {
  return (
    permissions.length > 0 &&
    permissions.every((permission) =>
      permission.category === "read" || permission.id === "browser.read.public_search"
    )
  );
}

function buildWarnings(input: {
  permissions: TemplatePermission[];
  scopeType: ScopeType;
  credentialList: CredentialType[];
  automation: AutomationMode;
  hasCredentialUse: boolean;
}): string[] {
  const warnings = new Set<string>();

  for (const permission of input.permissions) {
    if (permission.recommendedApproval === "BLOCK_BY_DEFAULT") {
      warnings.add(`${permission.name} 권한은 기본 차단을 권장합니다.`);
    }

    if (permission.riskScore >= 75) {
      warnings.add(`${permission.name} 권한은 CRITICAL 또는 HIGH 수준으로 다뤄야 합니다.`);
    }
  }

  const scopeWarning = scopeRules[input.scopeType].warning;
  if (scopeWarning) {
    warnings.add(scopeWarning);
  }

  for (const credential of input.credentialList) {
    const warning = credentialRules[credential].warning;
    if (warning) {
      warnings.add(warning);
    }
  }

  const automationWarning = automationRules[input.automation].warning;
  if (automationWarning) {
    warnings.add(automationWarning);
  }

  if (input.hasCredentialUse) {
    warnings.add("토큰, 쿠키, 비밀번호 원문은 로그와 AI 요청에 포함하지 마세요.");
  }

  if (warnings.size === 0) {
    warnings.add("현재 선택은 낮은 위험에 가깝지만 접근 범위와 로그 마스킹은 확인하세요.");
  }

  return Array.from(warnings);
}

function buildApprovalSteps(input: {
  permissions: PermissionAnalysis[];
  scopeType: ScopeType;
  credentialList: CredentialType[];
  automation: AutomationMode;
}): ApprovalStep[] {
  const steps: Omit<ApprovalStep, "order">[] = [];
  const approvals = new Set(input.permissions.map((permission) => permission.recommendedApproval));

  if (approvals.has("BLOCK_BY_DEFAULT")) {
    steps.push({
      action: approvalLabels.BLOCK_BY_DEFAULT,
      required: true,
      description:
        "Secrets, SSH 키, 결제, 계정 설정처럼 피해가 큰 권한은 연결 단계에서 꺼두세요."
    });
  }

  if (approvals.has("EACH_ACTION_APPROVAL")) {
    steps.push({
      action: approvalLabels.EACH_ACTION_APPROVAL,
      required: true,
      description:
        "삭제, Push, PR 병합, 폼 제출, 파일 업로드 전에는 대상과 변경 내용을 매번 확인하세요."
    });
  }

  if (approvals.has("SESSION_APPROVAL")) {
    steps.push({
      action: approvalLabels.SESSION_APPROVAL,
      required: true,
      description:
        "제한된 쓰기나 스크린샷처럼 복구 가능한 작업은 현재 세션에서 한 번 승인하도록 설정하세요."
    });
  }

  if (!scopeRules[input.scopeType].restricted) {
    steps.push({
      action: "접근 범위 축소 확인",
      required: true,
      description: "모든 저장소, 전체 파일시스템, 모든 웹사이트 대신 allowlist를 설정하세요."
    });
  }

  if (input.credentialList.some((credential) => credential !== "none")) {
    steps.push({
      action: "인증정보 마스킹 확인",
      required: true,
      description: "토큰, 쿠키, 비밀번호 원문이 로그와 AI 요청에 들어가지 않는지 확인하세요."
    });
  }

  if (input.automation === "auto_execute_all") {
    steps.push({
      action: "자동 실행 제한",
      required: true,
      description: "위험 작업은 자동 실행에서 제외하고 사용자 승인 흐름을 추가하세요."
    });
  }

  if (steps.length === 0) {
    steps.push({
      action: "읽기 전용 범위 확인",
      required: false,
      description: "읽기 작업이라도 특정 저장소, 폴더, 도메인으로 제한되어 있는지 확인하세요."
    });
  }

  return steps.map((step, index) => ({
    order: index + 1,
    ...step
  }));
}

function buildMinimumPrivilegeRecommendations(
  template: McpTemplate,
  scopeType: ScopeType,
  permissions: TemplatePermission[],
  credentialList: CredentialType[]
): string[] {
  const recommendations = new Set(template.principles);
  const hasWrite = permissions.some((permission) => permission.category === "write");
  const hasDelete = permissions.some((permission) => permission.category === "delete");
  const hasCredential = credentialList.some((credential) => credential !== "none");

  if (!scopeRules[scopeType].restricted) {
    recommendations.add("접근 범위를 특정 저장소, 특정 폴더, 특정 도메인으로 좁히세요.");
  }

  if (hasWrite) {
    recommendations.add("쓰기 권한은 테스트 브랜치나 임시 폴더에서 먼저 사용하세요.");
  }

  if (hasDelete) {
    recommendations.add("삭제 작업은 대상 목록, 백업 여부, 롤백 방법을 확인한 뒤 실행하세요.");
  }

  if (hasCredential) {
    recommendations.add("인증정보는 원문 저장 없이 마지막 4자리만 마스킹해 표시하세요.");
  }

  recommendations.add("작업 전후 diff 또는 결과 요약을 남겨 사용자가 쉽게 되돌릴 수 있게 하세요.");

  return Array.from(recommendations);
}

function buildPreConnectionChecklist(
  toolType: ChecklistRequest["toolType"],
  permissions: PermissionAnalysis[],
  scopeType: ScopeType,
  credentialList: CredentialType[]
) {
  const hasDelete = permissions.some((permission) => permission.category === "delete");
  const hasCredential = credentialList.some((credential) => credential !== "none");
  const hasEachAction = permissions.some(
    (permission) => permission.recommendedApproval === "EACH_ACTION_APPROVAL"
  );

  const checklist = [
    {
      id: "scope-restricted",
      label: "접근 범위가 특정 저장소, 폴더, 도메인으로 제한되어 있는가?",
      checked: false,
      critical: !scopeRules[scopeType].restricted
    },
    {
      id: "credential-redaction",
      label: "토큰, 쿠키, 비밀번호 원문이 로그와 AI 요청에 포함되지 않는가?",
      checked: false,
      critical: hasCredential
    },
    {
      id: "approval-dangerous-actions",
      label: "삭제, Push, 병합, 폼 제출, 파일 업로드 전에 사용자 승인을 받는가?",
      checked: false,
      critical: hasDelete || hasEachAction
    },
    {
      id: "rollback",
      label: "작업 실패 또는 실수에 대비한 롤백 방법이 준비되어 있는가?",
      checked: false,
      critical: hasDelete
    }
  ];

  if (toolType === "github") {
    checklist.push({
      id: "github-main-protection",
      label: "main 브랜치 직접 Push가 금지되어 있는가?",
      checked: false,
      critical: permissions.some((permission) => permission.id === "github.write.push")
    });
  }

  if (toolType === "filesystem") {
    checklist.push({
      id: "filesystem-denylist",
      label: ".env, .git, SSH 키, 시스템 폴더가 기본 제외되어 있는가?",
      checked: false,
      critical: true
    });
  }

  if (toolType === "browser") {
    checklist.push({
      id: "browser-domain-allowlist",
      label: "허용 도메인 목록이 설정되어 있고 결제·계정 변경 화면은 차단되어 있는가?",
      checked: false,
      critical: !scopeRules[scopeType].restricted
    });
  }

  return checklist;
}

function summarizeRisk(
  level: RiskLevel,
  readOnly: boolean,
  hasWrite: boolean,
  hasCredentialUse: boolean,
  restrictedScope: boolean
): string {
  if (level === "CRITICAL") {
    return "비밀정보, 전체 범위, 승인 없는 실행처럼 큰 피해로 이어질 수 있는 조합입니다.";
  }

  if (level === "HIGH") {
    return "파일 변경, 외부 전송, 로그인 세션 사용처럼 사용자 승인이 꼭 필요한 조합입니다.";
  }

  if (level === "MEDIUM") {
    return "제한된 쓰기나 민감 화면 노출 가능성이 있어 범위와 로그를 확인해야 합니다.";
  }

  if (readOnly && restrictedScope && !hasCredentialUse) {
    return "읽기 중심이며 접근 범위가 제한되어 있어 낮은 위험으로 볼 수 있습니다.";
  }

  if (!hasWrite && !hasCredentialUse) {
    return "직접 변경은 없지만 접근 범위가 넓지 않은지 확인하세요.";
  }

  return "낮은 위험이지만 최소 권한과 승인 기록은 유지하세요.";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

export function compareRiskLevel(left: RiskLevel, right: RiskLevel): number {
  return riskLevelOrder[left] - riskLevelOrder[right];
}

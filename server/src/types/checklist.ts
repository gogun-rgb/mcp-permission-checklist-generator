export type McpToolType = "github" | "filesystem" | "browser" | "custom";

export type PermissionCategory =
  | "read"
  | "write"
  | "delete"
  | "execute"
  | "credential"
  | "network";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ApprovalType =
  | "NO_APPROVAL"
  | "SESSION_APPROVAL"
  | "EACH_ACTION_APPROVAL"
  | "BLOCK_BY_DEFAULT";

export type ScopeType =
  | "specific_repository"
  | "all_repositories"
  | "specific_folder"
  | "full_filesystem"
  | "specific_domain"
  | "all_websites"
  | "custom";

export type CredentialType =
  | "api_token"
  | "github_token"
  | "cookies"
  | "login_session"
  | "none";

export type AutomationMode =
  | "approve_every_time"
  | "approve_risky_only"
  | "auto_execute_all";

export interface TemplatePermission {
  id: string;
  name: string;
  category: PermissionCategory;
  riskScore: number;
  scoreImpact: number;
  reason: string;
  recommendedApproval: ApprovalType;
  saferAlternative: string;
  critical?: boolean;
  forceCritical?: boolean;
}

export interface PermissionGroup {
  label: string;
  permissions: TemplatePermission[];
}

export interface McpTemplate {
  type: McpToolType;
  displayName: string;
  defaultName: string;
  description: string;
  principles: string[];
  permissionGroups: PermissionGroup[];
}

export type McpTemplateMap = Record<McpToolType, McpTemplate>;

export interface ChecklistRequest {
  toolType: McpToolType;
  toolName: string;
  purpose: string;
  permissionIds: string[];
  scope: {
    type: ScopeType;
    description: string;
  };
  credentials: CredentialType[];
  automation: AutomationMode;
  extraContext?: string;
}

export interface PermissionAnalysis {
  id: string;
  name: string;
  category: PermissionCategory;
  riskLevel: RiskLevel;
  riskScore: number;
  reason: string;
  recommendedApproval: ApprovalType;
  saferAlternative: string;
}

export interface ApprovalStep {
  order: number;
  action: string;
  required: boolean;
  description: string;
}

export interface RecommendedLog {
  field: string;
  description: string;
  required: boolean;
  sensitive: boolean;
}

export interface PreConnectionChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  critical: boolean;
}

export interface ChecklistResult {
  tool: {
    name: string;
    type: McpToolType;
    purpose: string;
  };
  scope: {
    description: string;
    isRestricted: boolean;
  };
  overallRisk: {
    level: RiskLevel;
    score: number;
    summary: string;
  };
  permissions: PermissionAnalysis[];
  approvalSteps: ApprovalStep[];
  recommendedLogs: RecommendedLog[];
  minimumPrivilegeRecommendations: string[];
  preConnectionChecklist: PreConnectionChecklistItem[];
  warnings: string[];
  generatedAt: string;
}

export interface AiChecklistEnhancement {
  summary?: string;
  warnings?: string[];
  minimumPrivilegeRecommendations?: string[];
  approvalStepDescriptions?: Record<number, string>;
}

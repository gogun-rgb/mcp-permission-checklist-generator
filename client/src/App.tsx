import {
  ClipboardCheck,
  RotateCcw,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import templatesJson from "./data/mcpTemplates.json";
import { PermissionSelector } from "./components/PermissionSelector";
import { ResultPanel } from "./components/ResultPanel";
import type {
  AutomationMode,
  ChecklistRequest,
  ChecklistResult,
  CredentialType,
  McpTemplateMap,
  McpToolType,
  ScopeType
} from "./types/checklist";
import "./styles.css";

const templates = templatesJson as McpTemplateMap;

interface FormState {
  toolType: McpToolType;
  toolName: string;
  purpose: string;
  permissionIds: string[];
  scopeType: ScopeType;
  credentials: CredentialType[];
  automation: AutomationMode;
  extraContext: string;
}

const toolTypes: McpToolType[] = ["github", "filesystem", "browser", "custom"];

const purposeOptions = [
  "코드 읽기",
  "파일 수정",
  "웹 검색",
  "이슈 작성",
  "테스트 자동화",
  "배포 보조",
  "직접 입력"
];

const scopeOptions: Array<{ value: ScopeType; label: string; tools: McpToolType[] }> = [
  { value: "specific_repository", label: "특정 저장소", tools: ["github", "custom"] },
  { value: "all_repositories", label: "모든 저장소", tools: ["github", "custom"] },
  { value: "specific_folder", label: "특정 폴더", tools: ["filesystem", "custom"] },
  { value: "full_filesystem", label: "전체 파일시스템", tools: ["filesystem", "custom"] },
  { value: "specific_domain", label: "특정 도메인", tools: ["browser", "custom"] },
  { value: "all_websites", label: "모든 웹사이트", tools: ["browser", "custom"] },
  { value: "custom", label: "직접 입력한 범위", tools: ["custom", "github", "filesystem", "browser"] }
];

const credentialOptions: Array<{ value: CredentialType; label: string }> = [
  { value: "none", label: "없음" },
  { value: "api_token", label: "API 토큰" },
  { value: "github_token", label: "GitHub 토큰" },
  { value: "cookies", label: "쿠키" },
  { value: "login_session", label: "로그인 세션" }
];

const automationOptions: Array<{ value: AutomationMode; label: string }> = [
  { value: "approve_every_time", label: "사용자가 매번 승인" },
  { value: "approve_risky_only", label: "위험 작업만 승인" },
  { value: "auto_execute_all", label: "모든 작업 자동 실행" }
];

const defaultPermissions: Record<McpToolType, string[]> = {
  github: ["github.read.repo_info", "github.read.code"],
  filesystem: ["filesystem.read.list", "filesystem.read.content"],
  browser: ["browser.read.open_page", "browser.read.page_text"],
  custom: ["custom.read.basic"]
};

const defaultScope: Record<McpToolType, ScopeType> = {
  github: "specific_repository",
  filesystem: "specific_folder",
  browser: "specific_domain",
  custom: "custom"
};

function createInitialForm(toolType: McpToolType = "github"): FormState {
  return {
    toolType,
    toolName: templates[toolType].defaultName,
    purpose: purposeOptions[0],
    permissionIds: defaultPermissions[toolType],
    scopeType: defaultScope[toolType],
    credentials: ["none"],
    automation: "approve_every_time",
    extraContext: ""
  };
}

export default function App() {
  const [form, setForm] = useState<FormState>(() => createInitialForm());
  const [result, setResult] = useState<ChecklistResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedTemplate = templates[form.toolType];
  const availableScopes = useMemo(
    () => scopeOptions.filter((option) => option.tools.includes(form.toolType)),
    [form.toolType]
  );

  const selectedScopeLabel =
    availableScopes.find((option) => option.value === form.scopeType)?.label ??
    "직접 입력한 범위";

  const handleToolTypeChange = (toolType: McpToolType) => {
    setForm(createInitialForm(toolType));
    setResult(null);
    setError("");
  };

  const handlePermissionToggle = (permissionId: string) => {
    setForm((current) => {
      const exists = current.permissionIds.includes(permissionId);
      return {
        ...current,
        permissionIds: exists
          ? current.permissionIds.filter((id) => id !== permissionId)
          : [...current.permissionIds, permissionId]
      };
    });
  };

  const handleCredentialToggle = (credential: CredentialType) => {
    setForm((current) => {
      if (credential === "none") {
        return { ...current, credentials: ["none"] };
      }

      const withoutNone = current.credentials.filter((item) => item !== "none");
      const exists = withoutNone.includes(credential);
      const next = exists
        ? withoutNone.filter((item) => item !== credential)
        : [...withoutNone, credential];

      return { ...current, credentials: next.length > 0 ? next : ["none"] };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setNotice("");

    const payload: ChecklistRequest = {
      toolType: form.toolType,
      toolName: form.toolName,
      purpose: form.purpose,
      permissionIds: form.permissionIds,
      scope: {
        type: form.scopeType,
        description: selectedScopeLabel
      },
      credentials: form.credentials,
      automation: form.automation,
      extraContext: form.extraContext
    };

    try {
      const response = await fetch("/api/checklists/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "점검표를 생성하지 못했습니다.");
      }

      const data = (await response.json()) as ChecklistResult;
      setResult(data);
      setNotice("권한 점검표를 생성했습니다.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setForm(createInitialForm());
    setResult(null);
    setError("");
    setNotice("");
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">MCP Permission Checklist Generator</p>
          <h1>MCP 권한 점검표 생성기</h1>
          <p>
            MCP를 연결하기 전에 권한부터 확인하세요. 읽기, 쓰기, 삭제,
            인증정보 접근이 어떤 위험을 만드는지 초보자도 바로 볼 수 있습니다.
          </p>
        </div>
        <div className="header-mark" aria-hidden="true">
          <ShieldCheck />
        </div>
      </header>

      <div className="layout">
        <form className="form-panel" onSubmit={handleSubmit}>
          <section className="form-section">
            <div className="section-title">
              <ClipboardCheck aria-hidden="true" />
              <h2>입력</h2>
            </div>

            <fieldset className="radio-group">
              <legend>MCP 종류</legend>
              <div className="segmented">
                {toolTypes.map((toolType) => (
                  <label key={toolType}>
                    <input
                      type="radio"
                      name="toolType"
                      value={toolType}
                      checked={form.toolType === toolType}
                      onChange={() => handleToolTypeChange(toolType)}
                    />
                    <span>{templates[toolType].displayName}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="field">
              <span>MCP 이름</span>
              <input
                type="text"
                value={form.toolName}
                maxLength={80}
                onChange={(event) =>
                  setForm((current) => ({ ...current, toolName: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>사용 목적</span>
              <select
                value={form.purpose}
                onChange={(event) =>
                  setForm((current) => ({ ...current, purpose: event.target.value }))
                }
              >
                {purposeOptions.map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {purpose}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="form-section">
            <div className="section-title">
              <ShieldCheck aria-hidden="true" />
              <h2>요청 권한</h2>
              <Tooltip text="권한은 MCP가 할 수 있는 행동의 범위입니다. 삭제, 실행, 인증정보 접근은 특히 신중히 봐야 합니다." />
            </div>
            <p className="template-description">{selectedTemplate.description}</p>
            <PermissionSelector
              template={selectedTemplate}
              selectedIds={form.permissionIds}
              onToggle={handlePermissionToggle}
            />
          </section>

          <section className="form-section">
            <div className="section-title">
              <Sparkles aria-hidden="true" />
              <h2>범위와 실행 방식</h2>
            </div>

            <label className="field">
              <span>접근 범위</span>
              <select
                value={form.scopeType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scopeType: event.target.value as ScopeType
                  }))
                }
              >
                {availableScopes.map((scope) => (
                  <option key={scope.value} value={scope.value}>
                    {scope.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="checkbox-fieldset">
              <legend>
                인증정보 사용 여부
                <Tooltip text="인증정보는 API 토큰, 쿠키, 로그인 세션처럼 사용자를 대신해 권한을 행사할 수 있는 정보입니다." />
              </legend>
              <div className="checkbox-grid compact">
                {credentialOptions.map((credential) => (
                  <label className="check-row" key={credential.value}>
                    <input
                      type="checkbox"
                      checked={form.credentials.includes(credential.value)}
                      onChange={() => handleCredentialToggle(credential.value)}
                    />
                    <span>{credential.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="radio-group">
              <legend>자동 실행 여부</legend>
              <div className="radio-stack">
                {automationOptions.map((option) => (
                  <label key={option.value}>
                    <input
                      type="radio"
                      name="automation"
                      checked={form.automation === option.value}
                      onChange={() =>
                        setForm((current) => ({ ...current, automation: option.value }))
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="field">
              <span>추가 설명</span>
              <textarea
                value={form.extraContext}
                maxLength={1000}
                rows={4}
                placeholder="예: 개인 저장소 하나에서 이슈 요약만 만들 예정입니다. 실제 토큰이나 쿠키 원문은 입력하지 마세요."
                onChange={(event) =>
                  setForm((current) => ({ ...current, extraContext: event.target.value }))
                }
              />
            </label>
          </section>

          {error ? <p className="message error-message">{error}</p> : null}
          {notice ? <p className="message success-message">{notice}</p> : null}

          <div className="button-row">
            <button type="submit" className="primary-button" disabled={isLoading}>
              <ShieldCheck size={18} aria-hidden="true" />
              {isLoading ? "생성 중..." : "권한 점검표 생성"}
            </button>
            <button type="button" className="secondary-button" onClick={resetForm}>
              <RotateCcw size={18} aria-hidden="true" />
              입력 초기화
            </button>
          </div>
        </form>

        <ResultPanel result={result} onNotify={setNotice} />
      </div>
    </main>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <button className="help-dot" type="button" aria-label={text} title={text}>
      ?
    </button>
  );
}

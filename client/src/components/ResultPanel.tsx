import { CheckCircle2, Copy, Download, ShieldAlert } from "lucide-react";
import {
  ANALYSIS_MODE_LABELS,
  type ChecklistResult
} from "@mcp-permission-checklist-generator/shared";
import {
  approvalLabels,
  categoryLabels,
  checklistToMarkdown,
  toPrettyJson
} from "../utils/formatters";
import { RiskBadge } from "./RiskBadge";

interface ResultPanelProps {
  result: ChecklistResult | null;
  onNotify: (message: string) => void;
}

export function ResultPanel({ result, onNotify }: ResultPanelProps) {
  if (!result) {
    return (
      <section className="empty-result" aria-label="결과 대기">
        <ShieldAlert aria-hidden="true" />
        <h2>권한을 선택하면 점검표가 여기에 표시됩니다.</h2>
        <p>
          API 키가 없어도 서버의 규칙 기반 엔진이 위험도, 승인 단계, 로그 항목을
          계산합니다.
        </p>
      </section>
    );
  }

  const copyMarkdown = () => {
    void copyText(checklistToMarkdown(result), "Markdown 점검표를 복사했습니다.", onNotify);
  };

  const copyJson = () => {
    void copyText(toPrettyJson(result), "JSON 결과를 복사했습니다.", onNotify);
  };

  const downloadJson = () => {
    const blob = new Blob([toPrettyJson(result)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mcp-permission-checklist-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    onNotify("JSON 파일을 다운로드했습니다.");
  };

  return (
    <section className="result-stack" aria-label="권한 점검표 결과">
      <div className="result-card result-summary">
        <div>
          <p className="section-kicker">전체 위험도</p>
          <h2>{result.tool.name}</h2>
          <p>{result.overallRisk.summary}</p>
          <div className="meta-badge-row" aria-label="분석 메타데이터">
            <span className="analysis-mode-badge">
              {ANALYSIS_MODE_LABELS[result.analysisMode]}
            </span>
            <span className="model-version-badge">
              위험 모델 {result.riskModelVersion}
            </span>
          </div>
          <p className="analysis-note">
            위험 점수와 등급은 항상 규칙 엔진이 결정하고, AI는 설명만 보강합니다.
          </p>
        </div>
        <RiskBadge level={result.overallRisk.level} score={result.overallRisk.score} />
      </div>

      <div className="action-row">
        <button type="button" className="secondary-button" onClick={copyMarkdown}>
          <Copy size={18} aria-hidden="true" />
          Markdown 복사
        </button>
        <button type="button" className="secondary-button" onClick={copyJson}>
          <Copy size={18} aria-hidden="true" />
          JSON 복사
        </button>
        <button type="button" className="secondary-button" onClick={downloadJson}>
          <Download size={18} aria-hidden="true" />
          JSON 다운로드
        </button>
      </div>

      <section className="result-card">
        <h3>핵심 경고</h3>
        <ul className="warning-list">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </section>

      <section className="result-card">
        <h3>권한별 위험 분석</h3>
        <div className="analysis-table" role="table" aria-label="권한별 위험 분석">
          <div className="analysis-header" role="row">
            <span>권한</span>
            <span>범주</span>
            <span>위험도</span>
            <span>승인</span>
            <span>대안</span>
          </div>
          {result.permissions.map((permission) => (
            <div className="analysis-row" role="row" key={permission.id}>
              <span>
                <strong>{permission.name}</strong>
                <small>{permission.reason}</small>
              </span>
              <span>{categoryLabels[permission.category]}</span>
              <span>
                <RiskBadge level={permission.riskLevel} score={permission.riskScore} />
              </span>
              <span>{approvalLabels[permission.recommendedApproval]}</span>
              <span>{permission.saferAlternative}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="result-card">
        <h3>필요한 사용자 승인</h3>
        <ol className="step-list">
          {result.approvalSteps.map((step) => (
            <li key={step.order}>
              <strong>{step.action}</strong>
              <span>{step.description}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="result-card">
        <h3>추천 로그 항목</h3>
        <div className="log-grid">
          {result.recommendedLogs.map((log) => (
            <div className="log-row" key={log.field}>
              <strong>{log.field}</strong>
              <span>{log.description}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="result-card">
        <h3>최소 권한 설정</h3>
        <ul className="plain-list">
          {result.minimumPrivilegeRecommendations.map((recommendation) => (
            <li key={recommendation}>{recommendation}</li>
          ))}
        </ul>
      </section>

      <section className="result-card">
        <h3>연결 전 체크리스트</h3>
        <ul className="checklist-list">
          {result.preConnectionChecklist.map((item) => (
            <li key={item.id} className={item.critical ? "critical-check" : ""}>
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

async function copyText(
  text: string,
  successMessage: string,
  onNotify: (message: string) => void
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    onNotify(successMessage);
  } catch {
    onNotify("브라우저가 클립보드 복사를 허용하지 않았습니다.");
  }
}

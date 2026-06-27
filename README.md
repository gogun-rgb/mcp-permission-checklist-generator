# MCP Permission Checklist Generator

MCP 권한 점검표 생성기는 GitHub, Filesystem, Browser MCP를 연결하기 전에 어떤 권한이 위험한지 확인하고, 승인 방식과 보안 로그 항목을 점검표로 만들어 주는 한국어 웹 애플리케이션입니다.

## 해결하려는 문제

MCP 서버를 처음 연결하는 사용자는 읽기, 쓰기, 삭제, 인증정보 접근 권한이 어떤 차이를 만드는지 판단하기 어렵습니다. 이 앱은 권한 조합을 규칙 기반으로 먼저 분석하고, OpenAI API 키가 설정되어 있으면 초보자용 설명을 선택적으로 보강합니다.

## 주요 기능

- GitHub MCP, Filesystem MCP, Browser MCP 권한 템플릿 제공
- 직접 입력용 일반 권한 템플릿 제공
- LOW, MEDIUM, HIGH, CRITICAL 위험도와 점수 계산
- 권한별 위험 사유, 승인 방식, 더 안전한 대안 제안
- 연결 전 체크리스트, 최소 권한 추천, 추천 로그 항목 생성
- Markdown 복사, JSON 복사, JSON 다운로드
- OpenAI API 키가 없어도 규칙 기반 분석 정상 동작
- 선택한 MCP 종류에 없는 권한 ID는 안전하게 거절
- OpenAI 보강 요청 전 사용자 입력의 토큰, 세션, 쿠키, 비밀번호 패턴 마스킹

## 설치 방법

```bash
npm install
```

PowerShell 실행 정책 때문에 `npm`이 막히면 Windows에서는 다음처럼 실행할 수 있습니다.

```bash
npm.cmd install
```

## 실행 방법

```bash
npm run dev
```

개발 서버는 프론트엔드와 백엔드를 동시에 실행합니다.

- 프론트엔드: `http://localhost:5173`
- 백엔드 API: `http://localhost:3001`

## 품질 검사

```bash
npm run lint
npm run test
npm run build
```

## OpenAI API 키 설정

OpenAI 보강 설명은 선택 사항입니다. API 키가 없어도 기본 점검표는 생성됩니다.

1. `.env.example`을 참고해 `server/.env` 또는 루트 `.env`를 만듭니다.
2. 값을 입력합니다.

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
PORT=3001
```

실제 `.env` 파일은 Git에 커밋하지 마세요.

## 환경변수

| 이름 | 설명 | 기본값 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 선택적 OpenAI API 키 | 없음 |
| `OPENAI_MODEL` | 설명 보강에 사용할 모델 | `gpt-4.1-mini` |
| `PORT` | Express 서버 포트 | `3001` |

## 위험도 계산 방식

앱은 먼저 JSON 템플릿과 규칙 기반 엔진으로 점수를 계산합니다.

- 읽기 전용은 낮은 점수로 시작합니다.
- 파일 삭제, Push, PR 병합, 폼 제출, 파일 업로드는 점수를 높입니다.
- Secrets, SSH 키, 결제, 비밀번호 입력은 CRITICAL로 분류합니다.
- 특정 저장소, 특정 폴더, 특정 도메인으로 제한하면 점수를 낮춥니다.
- 모든 작업 자동 실행이나 전체 파일시스템 접근은 점수를 크게 높입니다.

점수 구간은 다음과 같습니다.

| 점수 | 위험도 |
| --- | --- |
| 0-24 | LOW |
| 25-49 | MEDIUM |
| 50-74 | HIGH |
| 75-100 | CRITICAL |

## JSON 결과 예시

```json
{
  "tool": {
    "name": "GitHub MCP",
    "type": "github",
    "purpose": "코드 읽기"
  },
  "scope": {
    "description": "특정 저장소",
    "isRestricted": true
  },
  "overallRisk": {
    "level": "LOW",
    "score": 0,
    "summary": "읽기 중심이며 접근 범위가 제한되어 있습니다."
  },
  "permissions": [],
  "approvalSteps": [],
  "recommendedLogs": [],
  "minimumPrivilegeRecommendations": [],
  "preConnectionChecklist": [],
  "warnings": [],
  "generatedAt": "2026-06-26T00:00:00.000Z"
}
```

## 보안 주의사항

- OpenAI API 키는 서버 환경변수에서만 사용합니다.
- 브라우저 코드에는 API 키가 포함되지 않습니다.
- 토큰, 쿠키, 비밀번호 원문은 AI API로 보내지 않습니다.
- `Bearer ...`, `sessionid=...`, `github_pat_...`, `password is ...` 같은 민감정보 패턴은 OpenAI 요청 전에 마스킹합니다.
- 클라이언트나 직접 API 요청에서 지원하지 않는 권한 ID가 들어오면 분석 결과를 만들지 않고 오류로 거절합니다.
- 사용자 입력은 크기와 형식을 검증합니다.
- Express는 보안 헤더와 요청 크기 제한을 적용합니다.
- AI 응답은 스키마를 확인한 뒤 안전한 필드만 반영합니다.

## 현재 한계

- 실제 MCP 서버와 연결하지 않고 권한 점검표만 생성합니다.
- 조직별 보안 정책 템플릿은 아직 포함하지 않았습니다.
- AI 보강은 설명 문구에만 영향을 주며 위험도 판정의 기준은 규칙 엔진입니다.

## 추후 개선 사항

- Slack MCP
- Notion MCP
- Google Drive MCP
- 데이터베이스 MCP
- 사용자 정의 MCP JSON 가져오기
- MCP 설정 파일 자동 분석
- 조직용 정책 템플릿
- 권한 변경 이력 비교

## 기여 방법

1. 이 저장소를 fork합니다.
2. 새 브랜치를 만듭니다.
3. 테스트를 추가하거나 수정합니다.
4. `npm run lint`, `npm run test`, `npm run build`를 통과시킵니다.
5. Pull Request를 엽니다.

## 라이선스

MIT License

# MCP Permission Checklist Generator

MCP 연결 전에 권한 범위와 위험 작업을 분석하고, 최소권한·승인 단계·감사 로그를 생성하는 초보자용 보안 점검 도구입니다.

[![CI](https://github.com/gogun-rgb/mcp-permission-checklist-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/gogun-rgb/mcp-permission-checklist-generator/actions/workflows/ci.yml)

## 실제 실행 화면 또는 GIF

실제 실행 화면은 [docs/SCREENSHOT_GUIDE.md](docs/SCREENSHOT_GUIDE.md)에 적힌 입력값으로 재현할 수 있습니다. 아직 저장소에 실제 캡처 파일을 포함하지 않았으므로 README에는 깨진 이미지 링크를 넣지 않았습니다.

## 해결하려는 문제

MCP 서버를 처음 연결하는 사용자는 읽기, 쓰기, 삭제, 인증정보 접근 권한이 어떤 차이를 만드는지 판단하기 어렵습니다. 이 앱은 연결 전에 권한 조합을 규칙 기반으로 분석하고, 어떤 승인이 필요한지, 어떤 로그를 남겨야 하는지, 어떻게 더 작은 권한으로 시작할 수 있는지 보여줍니다.

이 프로젝트의 위험 점수는 공식 보안 인증 점수나 절대적인 안전 판정이 아닙니다. 권한의 파괴 가능성, 접근 범위, 인증정보 사용, 자동 실행 수준을 조합한 프로젝트 내부의 휴리스틱 위험 모델입니다.

## 작동 방식

1. 사용자가 MCP 종류, 권한, 접근 범위, 인증정보 사용 여부, 자동화 방식을 선택합니다.
2. 서버가 입력 형식, 길이, enum, 권한 ID allowlist를 검증합니다.
3. 규칙 엔진이 위험 점수와 등급을 결정합니다.
4. 최소권한 추천, 승인 단계, 추천 감사 로그 항목을 생성합니다.
5. OpenAI API 키가 있으면 사용자 입력을 마스킹한 뒤 한국어 설명만 선택적으로 보강합니다.
6. OpenAI 호출이 실패하거나 응답이 안전하지 않으면 규칙 기반 결과를 그대로 유지합니다.

## 핵심 기능

- GitHub, Filesystem, Browser, Custom MCP 권한 템플릿
- LOW, MEDIUM, HIGH, CRITICAL 위험도 분류
- 권한별 위험 사유, 점수, 추천 승인 방식, 더 안전한 대안
- 최소권한 추천, 승인 단계 추천, 추천 감사 로그 항목
- 연결 전 체크리스트
- Markdown 복사, JSON 복사, JSON 다운로드
- OpenAI API 키 없이도 동작하는 규칙 기반 분석
- 선택한 MCP 종류에 없는 권한 ID 거절
- OpenAI 전송 전 토큰, 쿠키, 세션, 비밀번호 패턴 마스킹
- `riskModelVersion`과 `analysisMode` 메타데이터
- Helmet, CORS allowlist, 요청 크기 제한, 생성 API rate limit

## 규칙 기반과 AI의 역할 분리

핵심 위험도는 항상 규칙 엔진이 결정합니다. OpenAI는 초보자가 이해하기 쉬운 한국어 설명을 보강하는 데만 사용됩니다.

- OpenAI는 위험 점수, 위험 등급, 권한 목록을 변경하지 못합니다.
- OpenAI 실패 시 규칙 기반 결과를 유지합니다.
- AI 응답 JSON이 잘못되거나 허용 필드가 없으면 무시합니다.
- 실제 조직에서는 내부 보안정책과 사람의 검토가 필요합니다.
- 이 앱은 실제 MCP 권한을 자동으로 부여하거나 취소하지 않습니다.

분석 모드는 결과에 다음 값으로 표시됩니다.

| 값 | 의미 |
| --- | --- |
| `RULE_ONLY` | 규칙 기반 분석만 적용 |
| `RULE_WITH_AI_EXPLANATION` | 규칙 기반 분석에 AI 설명 보강 적용 |

## 위험 모델 요약

위험 모델은 권한 자체 점수와 조합 점수를 함께 봅니다.

- `riskScore`: 개별 권한 자체의 위험도
- `scoreImpact`: 여러 권한을 함께 선택했을 때 누적되는 영향도
- 접근 범위, 인증정보 사용, 자동 실행 방식으로 contextual score를 더합니다.
- 읽기 전용이고 범위가 제한되어 있으면 점수를 낮춥니다.
- 전체 파일시스템 삭제, 모든 저장소 쓰기, 쿠키와 네트워크 전송, 자동 실행과 삭제/실행 조합은 최소 CRITICAL 구간으로 올라갈 수 있습니다.

자세한 계산식과 예시는 [docs/RISK_MODEL.md](docs/RISK_MODEL.md)를 참고하세요.

## 빠른 실행

```bash
npm install
npm run dev
```

PowerShell 실행 정책 때문에 `npm`이 막히면 Windows에서는 다음처럼 실행할 수 있습니다.

```bash
npm.cmd install
npm.cmd run dev
```

개발 서버:

- 프론트엔드: `http://localhost:5173`
- 백엔드 API: `http://localhost:3001`

## 환경변수

루트 `.env` 하나를 기본 source of truth로 사용합니다.

```bash
cp .env.example .env
```

Windows PowerShell에서는 다음 명령을 사용할 수 있습니다.

```powershell
Copy-Item .env.example .env
```

서버는 실행 위치와 관계없이 저장소 루트의 `.env`를 먼저 읽습니다. `server/.env`는 기존 사용자 호환을 위한 fallback이며, 두 파일에 같은 키가 있으면 루트 `.env` 값이 우선합니다.

| 이름 | 설명 | 기본값 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 서버 전용. 선택적 OpenAI API 키 | 없음 |
| `OPENAI_MODEL` | 서버 전용. 설명 보강에 사용할 모델 | `gpt-4.1-mini` |
| `PORT` | 서버 전용. Express 서버 포트 | `3001` |
| `ALLOWED_ORIGINS` | 서버 전용. 쉼표로 구분한 CORS 허용 origin | `http://localhost:5173,http://127.0.0.1:5173` |
| `CHECKLIST_RATE_LIMIT_PER_MINUTE` | 서버 전용. IP당 1분 생성 API 허용 횟수 | `10` |
| `TRUST_PROXY` | 서버 전용. 프록시 뒤에서 Express `trust proxy` 활성화 여부 | `false` |
| `VITE_API_BASE_URL` | Vite가 빌드 시 클라이언트에 포함하는 공개 API 주소 | 빈 값이면 Vite proxy 사용 |

`VITE_` 접두사가 붙은 값은 브라우저 번들에 포함될 수 있으므로 API 키, 토큰, 쿠키, 비밀번호 같은 비밀값을 넣으면 안 됩니다. API 키는 절대 프론트엔드 환경변수로 이동하지 마세요. 빈 origin은 같은 origin 요청, 서버 간 호출, curl 같은 비브라우저 요청을 위해 허용됩니다.

## 보안 설계

- OpenAI API 키는 서버 환경변수에서만 사용합니다.
- 브라우저 코드에는 API 키가 포함되지 않습니다.
- 사용자 입력은 길이, enum, 권한 ID allowlist로 검증합니다.
- `Bearer ...`, `sessionid=...`, `github_pat_...`, `password is ...` 같은 민감정보 패턴은 마스킹하거나 거절합니다.
- AI 응답은 허용된 설명 필드만 반영합니다.
- Express는 Helmet, CORS allowlist, JSON 요청 크기 제한, rate limit을 적용합니다.
- Rate limit은 단일 프로세스 메모리 기반이며 만료 bucket을 lazy cleanup하고 최대 bucket 수를 제한합니다.

자세한 내용은 [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md)를 참고하세요.

## 테스트

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

CI는 pull request와 `main` push에서 다음 명령을 실행합니다.

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

테스트는 OpenAI API 키 없이 통과하도록 구성되어 있습니다.

## 현재 제한

- 실제 MCP 서버와 연결하지 않고 권한 점검표만 생성합니다.
- 실제 조직 정책, 저장소 중요도, 내부 데이터 민감도는 자동으로 알 수 없습니다.
- 메모리 기반 rate limit은 단일 서버 프로세스 기준입니다. 여러 서버 인스턴스에서는 제한 상태가 공유되지 않으며, 대규모 배포에는 Redis 기반 store가 필요합니다.
- 민감정보 마스킹은 알려진 패턴 중심이며 모든 비밀값을 보장하지 않습니다.
- 실제 운영 도입 전에는 조직 보안정책과 사람의 검토가 필요합니다.

## 로드맵

- Slack, Notion, Google Drive, Database MCP 템플릿
- 사용자 정의 MCP JSON 가져오기
- MCP 설정 파일 자동 분석
- 조직용 정책 템플릿
- 권한 변경 이력 비교
- 실제 실행 화면과 데모 영상 추가

## 라이선스

MIT License

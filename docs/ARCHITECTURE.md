# Architecture

MCP Permission Checklist Generator는 React/Vite 클라이언트와 Express API로 구성된 로컬 우선 웹 애플리케이션입니다. 실제 MCP 서버에 연결하거나 권한을 부여하지 않고, 사용자가 선택한 MCP 유형, 권한, 접근 범위, 인증정보 사용 여부, 자동화 방식을 분석해 점검표를 생성합니다.

## 구성 요소

| 영역 | 역할 |
| --- | --- |
| `client` | 입력 폼, 권한 템플릿 표시, 위험도 결과, Markdown/JSON 출력 |
| `server` | 요청 검증, 규칙 기반 위험 계산, 선택적 OpenAI 설명 보강, API 보호, production 정적 파일 제공 |
| `packages/shared` | MCP 템플릿, 공용 TypeScript 타입, 위험 모델 버전 상수 |
| `tests` | 규칙 엔진, 검증, 마스킹, AI 응답 제한, CORS, rate limit 검증 |

## 요청 흐름

1. 사용자가 클라이언트에서 MCP 종류와 권한을 선택합니다.
2. 클라이언트는 `/api/checklists/generate`로 JSON 요청을 보냅니다.
3. 서버는 입력 타입, 길이, enum 값, 권한 ID allowlist를 검증합니다.
4. 민감정보처럼 보이는 토큰, 쿠키, 세션, 비밀번호 패턴은 요청 단계에서 거절합니다.
5. 규칙 엔진이 위험 점수, 등급, 승인 단계, 최소권한 추천, 로그 항목을 생성합니다.
6. `OPENAI_API_KEY`가 있으면 사용자 입력을 마스킹한 뒤 설명 보강만 요청합니다.
7. AI 응답은 허용된 설명 필드만 반영하고 위험 점수, 등급, 권한 목록은 유지합니다.
8. 클라이언트는 결과를 화면, Markdown, JSON으로 제공합니다.

## 공유 패키지

`packages/shared`가 템플릿과 타입의 단일 source of truth입니다.

- `mcpTemplates.json`: GitHub, Filesystem, Browser, Custom MCP 권한 템플릿
- `checklist-types.ts`: 요청, 결과, 권한, 위험도 타입
- `constants.ts`: `RISK_MODEL_VERSION`, 분석 모드 라벨

클라이언트와 서버는 이 패키지를 import하므로 템플릿 불일치가 생기지 않습니다.

## OpenAI 보강 경계

OpenAI는 핵심 판정을 하지 않습니다. 서버는 규칙 기반 결과를 먼저 만들고, AI 응답에서는 다음 필드만 읽습니다.

- `summary`
- `warnings`
- `minimumPrivilegeRecommendations`
- `approvalStepDescriptions`

AI 응답에 `overallRisk`, `permissions`, `riskScore`, `riskLevel` 같은 필드가 포함되어도 무시됩니다.

## 배포 설정

루트 `.env` 하나를 공식 환경변수 파일로 사용합니다.

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

서버는 `server/src/config/env.ts`에서 `import.meta.url`과 `fileURLToPath`로 현재 파일 위치를 구한 뒤 저장소 루트를 계산합니다. 따라서 `npm run dev`, `npm run dev -w server`, production `dist` 실행처럼 작업 디렉터리가 달라져도 루트 `.env`를 먼저 읽습니다. `server/.env`는 하위 호환 fallback이며 같은 키는 루트 `.env`가 우선합니다.

개발 중에는 Vite proxy가 `/api` 요청을 `http://127.0.0.1:3001`로 전달합니다. Vite는 `client/vite.config.ts`의 `envDir` 설정으로 루트 `.env`를 읽습니다. 배포 시에는 `VITE_API_BASE_URL`로 API 서버 주소를 지정할 수 있고, 값이 비어 있으면 기존 상대 경로 `/api/checklists/generate`를 사용합니다. `VITE_` 접두사가 붙은 값은 브라우저에 노출될 수 있으므로 비밀값을 넣으면 안 됩니다. 서버는 `ALLOWED_ORIGINS`로 허용 origin을 관리합니다.

## 프로덕션 단일 서비스

`server/src/app.ts`는 Express 앱 생성을 담당하고, `server/src/index.ts`는 `app.listen()`만 실행합니다. 이 분리 덕분에 HTTP 통합 테스트에서 production 앱을 직접 생성할 수 있습니다.

production 모드에서는 Express가 `client/dist`를 함께 제공합니다.

| 경로 | 처리 |
| --- | --- |
| `/health` | Express health JSON |
| `/api/checklists/*` | Express API |
| `/api/*` | JSON 404 |
| `/assets/*` | Vite 정적 asset |
| 그 외 SPA 경로 | `client/dist/index.html` fallback |

`server/src/config/paths.ts`는 `import.meta.url`과 `fileURLToPath`로 저장소 루트를 계산해 `client/dist`를 찾습니다. 이 방식은 `src` 실행과 `dist` 실행 모두에서 같은 경로를 계산합니다.

## Docker

루트 `Dockerfile`은 multi-stage build를 사용합니다.

1. `npm ci`로 workspace 의존성을 설치합니다.
2. shared, client, server를 빌드합니다.
3. `npm prune --omit=dev`로 production 의존성만 남깁니다.
4. 최종 이미지에는 `server/dist`, `client/dist`, `packages/shared/dist`, production `node_modules`만 복사합니다.

컨테이너는 `NODE_ENV=production`과 `npm run start`로 실행됩니다.

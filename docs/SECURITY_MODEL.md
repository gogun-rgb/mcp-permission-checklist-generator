# Security Model

이 프로젝트는 MCP 연결 전에 권한 조합의 위험을 설명하는 보조 도구입니다. 공식 보안 인증, 취약점 스캐너, 조직 정책 엔진이 아니며 실제 권한을 자동으로 부여하거나 취소하지 않습니다.

## 비밀정보 보관

OpenAI API 키는 서버 환경변수에서만 읽습니다. 클라이언트 번들에는 API 키를 넣지 않으며, `VITE_API_BASE_URL`은 API 서버 주소만 지정합니다.

공식 환경변수 파일은 저장소 루트의 `.env`입니다.

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

서버는 루트 `.env`를 먼저 읽고, `server/.env`는 하위 호환 fallback으로만 읽습니다. 같은 키가 두 파일에 있으면 루트 `.env`가 우선합니다. `OPENAI_API_KEY`, `OPENAI_MODEL`, `PORT`, `ALLOWED_ORIGINS`, `CHECKLIST_RATE_LIMIT_PER_MINUTE`, `TRUST_PROXY`는 서버 전용입니다. `VITE_API_BASE_URL`은 Vite가 빌드 시 클라이언트에 포함하는 공개 API 주소입니다. `VITE_` 접두사가 붙은 값은 브라우저에 노출될 수 있으므로 비밀값을 넣으면 안 됩니다.

## 입력 검증

서버는 다음 항목을 검증합니다.

- 요청 본문이 JSON 객체인지 확인
- MCP 종류, 접근 범위, 인증정보, 자동화 방식 enum 검증
- 텍스트 길이 제한
- 선택한 MCP 종류에 존재하는 권한 ID인지 allowlist 검증
- 실제 토큰, 쿠키, 세션, 비밀번호처럼 보이는 문자열 거절

`none`과 다른 인증정보가 함께 들어오면 규칙 엔진에서 `none`을 제거하고 실제 인증정보만 위험 계산에 사용합니다.

## 민감정보 탐지와 마스킹

OpenAI 요청 전 사용자 입력과 AI 응답 텍스트에 대해 민감정보 패턴을 마스킹합니다. 예시는 다음과 같습니다.

- `Bearer ...`
- `sessionid=...`
- `github_pat_...`
- `password is ...`
- `api_key=...`

마스킹은 보조 안전장치입니다. 사용자는 실제 API 키, 쿠키, 토큰, 비밀번호를 입력하지 않아야 합니다.

## AI 응답 제한

AI 응답은 JSON으로 요청하지만, 서버는 응답을 신뢰하지 않습니다.

- 잘못된 JSON은 폐기하고 규칙 기반 결과 유지
- 허용 필드가 없는 JSON은 폐기
- 너무 긴 문장은 잘라서 반영
- 위험 점수, 등급, 권한 목록 변경 시도는 무시
- OpenAI timeout 또는 오류 발생 시 규칙 기반 결과 유지

## HTTP 보호

서버는 다음 보호를 적용합니다.

- Helmet 보안 헤더
- JSON 요청 크기 제한 `32kb`
- `ALLOWED_ORIGINS` 기반 CORS allowlist
- 빈 origin은 같은 origin 요청, 서버 간 호출, curl 같은 비브라우저 요청을 위해 허용
- 단일 서비스 production 실행을 위해 `localhost:3001`, `127.0.0.1:3001`, Render의 `RENDER_EXTERNAL_HOSTNAME` origin을 지원
- IP 기준 생성 API rate limit
- `TRUST_PROXY=true`일 때만 Express `trust proxy` 활성화

## Rate Limit

기본 정책은 생성 API 기준 IP당 1분 10회입니다. `CHECKLIST_RATE_LIMIT_PER_MINUTE`로 조정할 수 있습니다. 제한을 초과하면 HTTP 429와 한국어 오류 메시지를 반환합니다.

rate limit 상태는 단일 Node.js 프로세스의 메모리 `Map`에 저장됩니다. 요청 시점에 만료된 bucket을 lazy cleanup하고, 기본 최대 bucket 수는 10,000개로 제한해 서로 다른 IP가 한 번씩 요청해도 Map이 무한히 증가하지 않게 합니다. 여러 서버 인스턴스에서는 제한 상태가 공유되지 않으므로 실제 대규모 배포에서는 Redis 같은 외부 store가 필요합니다.

## Production Static Serving

production 모드에서 Express는 빌드된 React 앱을 정적 파일로 제공합니다. `/api`와 `/health`는 정적 fallback보다 먼저 처리되어 API 오류가 HTML로 바뀌지 않습니다. 존재하지 않는 `/api/*`는 JSON 404를 반환하고, 존재하지 않는 SPA 경로는 `index.html`로 fallback합니다.

Docker 이미지에는 `.env`, `server/.env`, Git metadata, coverage, local build cache를 포함하지 않습니다. `OPENAI_API_KEY`는 플랫폼 secret으로만 설정해야 합니다.

## 알려진 한계

- 휴리스틱 모델이므로 조직의 실제 보안 정책을 대체하지 않습니다.
- MCP 서버의 실제 권한 manifest를 자동으로 검증하지 않습니다.
- 메모리 기반 rate limit은 단일 서버 프로세스 기준입니다. 만료 bucket cleanup과 최대 bucket 수 제한은 있지만, 다중 인스턴스 배포에서는 Redis 같은 외부 저장소가 필요합니다.
- Docker/Render 설정은 단일 웹 서비스 배포를 돕지만, 실제 플랫폼 secret과 도메인 설정은 배포 환경에서 관리해야 합니다.
- 마스킹 규칙은 알려진 패턴 중심이며 모든 비밀값을 보장하지 않습니다.

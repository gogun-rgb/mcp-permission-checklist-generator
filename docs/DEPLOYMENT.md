# Deployment

이 프로젝트는 단일 Docker Web Service 배포를 기준으로 합니다. Express 서버가 React 정적 파일과 API를 함께 제공합니다.

## 현재 배포 주소

- Web: https://mcp-permission-checklist-generator.onrender.com
- Health: https://mcp-permission-checklist-generator.onrender.com/health

현재 공개 배포는 OpenAI API 키 없이 동작하며, 규칙 기반 분석 기능만 사용합니다. 따라서 OpenAI API 비용은 발생하지 않습니다.

## Render Web UI 배포

저장소 루트의 `render.yaml`은 Render Blueprint 배포용 설정입니다.

1. Render Dashboard에 로그인합니다.
2. **New**를 선택합니다.
3. **Blueprint**를 선택합니다.
4. GitHub 저장소 `gogun-rgb/mcp-permission-checklist-generator`를 연결합니다.
5. Blueprint 파일로 루트 `render.yaml`을 사용합니다.
6. 서비스 이름과 브랜치가 다음과 같은지 확인합니다.
   - service name: `mcp-permission-checklist-generator`
   - branch: `main`
   - runtime: Docker
   - health check path: `/health`
7. 환경변수를 확인합니다.
   - `NODE_ENV=production`
   - `OPENAI_MODEL=gpt-4.1-mini`
   - `TRUST_PROXY=true`
   - `CHECKLIST_RATE_LIMIT_PER_MINUTE=10`
   - `OPENAI_API_KEY`는 필요한 경우 Render secret으로만 입력
8. Blueprint를 적용하고 첫 배포가 완료될 때까지 기다립니다.
9. 배포 URL에서 다음을 확인합니다.
   - `/`
   - `/health`
   - `/api/checklists/generate`

`OPENAI_API_KEY`는 선택 사항입니다. 키가 없어도 규칙 기반 분석은 동작합니다.

## 로컬 production 검증

```bash
npm run build
npm run start
```

다른 터미널에서 확인합니다.

```bash
npm run smoke -- http://127.0.0.1:3001
```

## Docker 검증

Docker Desktop 또는 Docker daemon이 실행 중이어야 합니다.

```bash
docker build -t mcp-permission-checklist-generator .
docker run --rm -p 3001:3001 mcp-permission-checklist-generator
docker run --rm -p 3002:3001 mcp-permission-checklist-generator
```

Windows PowerShell 한 줄 예시:

```powershell
docker run --rm -p 3002:3001 mcp-permission-checklist-generator
```

외부 호스트 포트는 자유롭게 바꿀 수 있습니다. 정적 JS/CSS 파일은 CORS allowlist와 무관하게 같은 Express 서비스에서 제공되므로 포트를 바꿨다는 이유만으로 `ALLOWED_ORIGINS`를 추가하지 않아도 됩니다. 같은 origin의 `/api` 요청도 현재 요청의 host 기준으로 허용됩니다. `ALLOWED_ORIGINS`는 별도 프론트엔드 origin에서 `/api`를 호출할 때만 설정하세요.

## 배포 후 smoke test

현재 공개 배포 URL은 다음 명령으로 확인합니다.

```bash
npm run smoke -- https://mcp-permission-checklist-generator.onrender.com
```

검증 항목:

- HTTPS 접속
- `/` HTML 응답
- HTML에 포함된 JS/CSS asset 200 응답과 올바른 MIME 타입
- `/health` JSON 응답
- 체크리스트 API 규칙 기반 결과
- OpenAI API 키 없이 기본 분석 가능

# Deployment

이 프로젝트는 단일 Docker Web Service 배포를 기준으로 합니다. Express 서버가 React 정적 파일과 API를 함께 제공합니다.

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
docker run --rm -p 3001:3001 -e PORT=3001 -e NODE_ENV=production mcp-permission-checklist-generator
```

Windows PowerShell 한 줄 예시:

```powershell
docker run --rm -p 3001:3001 -e PORT=3001 -e NODE_ENV=production mcp-permission-checklist-generator
```

## 배포 후 smoke test

실제 배포 URL이 생기면 다음 명령으로 확인합니다.

```bash
npm run smoke -- https://your-render-url.onrender.com
```

검증 항목:

- HTTPS 접속
- `/` HTML 응답
- `/health` JSON 응답
- 체크리스트 API 규칙 기반 결과
- OpenAI API 키 없이 기본 분석 가능

# Screenshot Guide

현재 저장소에는 실제 실행 화면을 재생성하기 위한 가이드를 포함합니다. 새 스크린샷이나 데모 영상을 추가할 때는 실제 앱을 실행해 캡처하고, 합성 이미지나 가짜 결과를 만들지 마세요.

## 준비

```bash
npm install
npm run dev
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다.

## 캡처할 장면

### 1. GitHub 읽기 전용 LOW

- MCP 종류: GitHub MCP
- 권한: 저장소 정보 읽기, 코드 읽기
- 접근 범위: 특정 저장소
- 인증정보: 없음
- 자동 실행 여부: 사용자가 매번 승인
- 예상 결과: LOW 또는 MEDIUM, 규칙 기반 분석, 위험 모델 1.0.0

권장 파일명:

```text
docs/images/github-readonly-low.png
```

### 2. Push와 PR 병합 HIGH

- MCP 종류: GitHub MCP
- 권한: 코드 Push, Pull Request 병합
- 접근 범위: 특정 저장소
- 인증정보: 없음
- 자동 실행 여부: 사용자가 매번 승인
- 예상 결과: HIGH

권장 파일명:

```text
docs/images/github-push-merge-high.png
```

### 3. Secrets 접근 CRITICAL

- MCP 종류: GitHub MCP
- 권한: 저장소 Secrets 접근
- 접근 범위: 특정 저장소
- 인증정보: GitHub 토큰
- 자동 실행 여부: 위험 작업만 승인
- 예상 결과: CRITICAL, 기본 차단 승인 단계

권장 파일명:

```text
docs/images/github-secrets-critical.png
```

### 4. 최소권한, 승인 단계, 로그 항목

위 장면 중 하나에서 결과 패널의 다음 영역이 보이도록 캡처합니다.

- 최소 권한 설정
- 필요한 사용자 승인
- 추천 로그 항목
- 연결 전 체크리스트

권장 파일명:

```text
docs/images/checklist-details.png
```

### 5. JSON 또는 Markdown 출력

결과 생성 후 JSON 복사 또는 다운로드를 사용합니다. 저장한 JSON에 다음 필드가 있는지 확인합니다.

```json
{
  "riskModelVersion": "1.0.0",
  "analysisMode": "RULE_ONLY"
}
```

권장 파일명:

```text
docs/images/json-output.png
```

## 짧은 데모 영상 흐름

가능하면 `docs/demo/permission-flow.webm`으로 저장합니다.

```text
GitHub 읽기 전용 선택
→ LOW 분석
→ Push와 PR 병합 추가
→ HIGH 분석
→ Secrets 접근 추가
→ CRITICAL 분석
→ 최소권한 추천 확인
→ JSON 다운로드
```

README에 이미지나 영상 링크를 추가할 때는 파일이 실제로 존재하는지 먼저 확인하세요.

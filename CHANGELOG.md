# Changelog

## 1.1.0 - 2026-06-27

- 공용 `packages/shared` 패키지로 MCP 템플릿, 타입, 위험 모델 상수를 통합했습니다.
- 모든 점검 결과에 `riskModelVersion`과 `analysisMode`를 추가했습니다.
- OpenAI 보강이 실제 설명 필드에 반영된 경우에만 `RULE_WITH_AI_EXPLANATION`을 표시하도록 했습니다.
- 배포용 `ALLOWED_ORIGINS`, `VITE_API_BASE_URL`, `TRUST_PROXY` 설정을 추가했습니다.
- 생성 API에 IP 기준 메모리 rate limit을 추가했습니다.
- GitHub Actions CI를 추가했습니다.
- 위험 모델, 보안 모델, 아키텍처, 스크린샷 가이드를 문서화했습니다.
- 보안 및 신뢰성 테스트를 보강했습니다.

## 1.0.1 - 2026-06-27

- 선택한 MCP 종류에 존재하지 않는 권한 ID를 거절하도록 검증을 강화했습니다.
- OpenAI 보강 요청 전에 사용자 입력의 토큰, 세션, 쿠키, 비밀번호 패턴을 마스킹하도록 보강했습니다.
- 민감정보 마스킹과 잘못된 권한 ID 관련 테스트를 추가했습니다.

## 1.0.0 - 2026-06-26

- GitHub, Filesystem, Browser, Custom MCP 권한 템플릿을 추가했습니다.
- 규칙 기반 위험도 계산, 최소권한 추천, 승인 단계, 추천 로그 항목을 구현했습니다.
- Markdown 및 JSON 출력 기능을 추가했습니다.
- OpenAI API 키 없이도 규칙 기반 분석이 동작하도록 구현했습니다.

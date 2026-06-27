# Risk Model

MCP Permission Checklist Generator의 위험 모델은 프로젝트 내부 휴리스틱입니다. 공식 표준, 인증 점수, 절대적인 안전 판정이 아닙니다. 권한의 파괴 가능성, 접근 범위, 인증정보 사용, 자동 실행 수준을 조합해 연결 전 검토에 필요한 설명을 제공합니다.

## 버전

현재 위험 모델 버전은 `1.0.0`입니다. 규칙, 점수, 강제 등급 조건을 바꿀 때는 `packages/shared/src/constants.ts`의 `RISK_MODEL_VERSION`을 올리고 테스트와 문서를 함께 갱신해야 합니다.

## `riskScore`와 `scoreImpact`

| 값 | 의미 |
| --- | --- |
| `riskScore` | 개별 권한 자체의 위험도입니다. 권한별 배지와 최종 점수의 하한 후보로 사용됩니다. |
| `scoreImpact` | 여러 권한을 함께 선택했을 때 누적되는 영향도입니다. 권한 조합의 위험을 계산하는 데 사용됩니다. |

최종 계산은 두 경로 중 더 큰 값을 사용합니다.

```text
permissionImpactScore = 선택 권한의 scoreImpact 합계
maxPermissionScore = 선택 권한의 riskScore 최댓값
contextualScore = 접근 범위 가중치 + 인증정보 가중치 + 자동화 가중치

baseScore = max(
  permissionImpactScore + contextualScore,
  maxPermissionScore + contextualScore
)
```

읽기 전용 권한만 선택했고 범주가 제한되어 있으면 `contextualScore`에서 15점을 추가로 낮춥니다.

## 접근 범위 가중치

| 접근 범위 | 점수 |
| --- | ---: |
| 특정 저장소 | -10 |
| 모든 저장소 | 35 |
| 특정 폴더 | -10 |
| 전체 파일시스템 | 45 |
| 특정 도메인 | -10 |
| 모든 웹사이트 | 20 |
| 직접 입력한 범위 | 0 |

## 인증정보 가중치

| 인증정보 | 점수 |
| --- | ---: |
| 없음 | 0 |
| API 토큰 | 15 |
| GitHub 토큰 | 20 |
| 쿠키 | 30 |
| 로그인 세션 | 30 |

`none`과 다른 인증정보가 동시에 들어오면 `none`은 제거하고 실제 인증정보만 사용합니다.

## 자동화 방식 가중치

| 자동화 방식 | 점수 |
| --- | ---: |
| 사용자가 매번 승인 | -10 |
| 위험 작업만 승인 | 0 |
| 모든 작업 자동 실행 | 25 |

## 위험 구간

| 최종 점수 | 등급 |
| --- | --- |
| 0-24 | LOW |
| 25-49 | MEDIUM |
| 50-74 | HIGH |
| 75-100 | CRITICAL |

최종 점수는 `Math.round` 후 0부터 100 사이로 제한합니다.

## 강제 최소 위험도

다음 조건에서는 계산 점수가 낮더라도 최소 점수를 올립니다.

| 조건 | 최소 점수 |
| --- | ---: |
| `critical: true` 권한 포함 | 50 |
| 전체 파일시스템 범위와 삭제 권한 조합 | 75 |
| 모든 저장소 범위와 쓰기, 삭제, 실행, 네트워크 권한 조합 | 75 |
| 쿠키와 네트워크 권한 조합 | 75 |
| 모든 작업 자동 실행과 삭제 또는 실행 권한 조합 | 75 |

## 강제 CRITICAL 조건

권한 템플릿에 `forceCritical: true`가 있거나, 모든 작업 자동 실행과 삭제 또는 실행 권한이 결합되면 최종 등급은 CRITICAL입니다. 이 경우 점수도 최소 75점 이상으로 유지합니다.

## 승인 단계 생성

권한의 `recommendedApproval` 값을 모아 사용자 승인 단계를 생성합니다.

- `BLOCK_BY_DEFAULT`: Secrets, SSH 키, 결제, 계정 설정처럼 피해가 큰 권한은 기본 차단
- `EACH_ACTION_APPROVAL`: 삭제, Push, PR 병합, 폼 제출, 파일 업로드 전 매번 확인
- `SESSION_APPROVAL`: 제한된 쓰기나 스크린샷처럼 복구 가능한 작업은 세션 단위 승인
- 범위가 제한되지 않았으면 접근 범위 축소 확인 추가
- 인증정보를 쓰면 마스킹 확인 추가
- 모든 작업 자동 실행이면 자동 실행 제한 추가

## 최소권한 추천 생성

템플릿의 기본 원칙을 먼저 포함하고, 선택 조건에 따라 추천을 추가합니다.

- 범위가 제한되지 않으면 특정 저장소, 폴더, 도메인으로 좁히라고 제안
- 쓰기 권한이 있으면 테스트 브랜치나 임시 폴더에서 먼저 사용하라고 제안
- 삭제 권한이 있으면 백업과 롤백 확인을 제안
- 인증정보가 있으면 원문 저장 없이 마스킹하라고 제안
- 작업 전후 diff 또는 결과 요약을 남기라고 제안

## 예시 계산

### 1. GitHub 읽기 전용

입력:

- 권한: `github.read.repo_info`, `github.read.code`
- 범위: 특정 저장소
- 인증정보: 없음
- 자동화: 사용자가 매번 승인

계산:

```text
permissionImpactScore = 5 + 5 = 10
maxPermissionScore = 15
contextualScore = -10 + 0 - 10 - 15(readOnly) = -35
baseScore = max(10 - 35, 15 - 35) = -20
clampedScore = 0
level = LOW
```

### 2. GitHub Push와 PR 병합

입력:

- 권한: `github.write.push`, `github.write.pr_merge`
- 범위: 특정 저장소
- 인증정보: 없음
- 자동화: 사용자가 매번 승인

계산:

```text
permissionImpactScore = 25 + 35 = 60
maxPermissionScore = 70
contextualScore = -10 + 0 - 10 = -20
baseScore = max(60 - 20, 70 - 20) = 50
level = HIGH
```

### 3. 전체 파일시스템과 파일 삭제

입력:

- 권한: `filesystem.write.file_delete`
- 범위: 전체 파일시스템
- 인증정보: 없음
- 자동화: 사용자가 매번 승인

계산:

```text
permissionImpactScore = 30
maxPermissionScore = 70
contextualScore = 45 + 0 - 10 = 35
baseScore = max(30 + 35, 70 + 35) = 105
forcedMinimum = 75
clampedScore = 100
level = CRITICAL
```

## 알려진 한계

- 권한 이름과 범주를 템플릿에 의존하므로 실제 MCP 서버 manifest와 다를 수 있습니다.
- 조직별 중요 저장소, 배포 파이프라인, 내부 데이터 민감도는 자동으로 알 수 없습니다.
- 점수는 설명을 돕기 위한 상대적 기준이며 법적, 컴플라이언스, 인증 기준이 아닙니다.

## 규칙 변경 시 필요한 테스트

규칙을 바꾸면 다음 테스트를 함께 갱신해야 합니다.

- LOW, HIGH, CRITICAL 대표 입력
- 강제 최소 위험도 조건
- 강제 CRITICAL 조건
- `none`과 다른 인증정보의 정규화
- JSON과 Markdown 출력의 `riskModelVersion`, `analysisMode`
- AI가 점수, 등급, 권한 목록을 변경하지 못하는 조건

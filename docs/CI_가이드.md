# Llove CI 가이드

이 문서는 `.github/workflows/ci.yml` 로 구성된 GitHub Actions CI의 동작과,
실패 시 원인 파악 방법, 그리고 Branch Protection(CI 통과 전 머지 차단) 설정 방법을 설명한다.

> ⚠️ 이 문서는 **설명용**이다. 실제 GitHub 저장소 설정(Branch Protection 등)은
> 최고 관리자님이 직접 적용해야 한다. 코드/문서는 안내만 제공한다.

---

## 1. CI가 검사하는 항목

CI는 **빌드 없이 정적 검증만** 수행한다. (정적 웹앱 — 빌드 없음)

CI는 두 개의 잡으로 구성된다.

### 잡 1) `HTML / JS 기본 검증`
| 단계 | 스크립트/도구 | 검사 내용 | 실패 조건 |
|---|---|---|---|
| JavaScript 문법 검증 | `scripts/check-inline-js.mjs` (`node --check`) | index.html 인라인 `<script>`의 JS 문법 | 문법 오류(괄호 짝, 세미콜론 등) |
| HTML 구조 검증 | `htmlhint` + `.htmlhintrc` | 태그 짝(tag-pair), id 중복, DOCTYPE, title 등 | 닫히지 않은 태그, 중복 id, doctype 누락 등 |
| 배포 전 점검 | `scripts/check-deploy.mjs` | 진입점 존재, 병합 충돌 마커, 골격 태그, GROK 게이트 플래그 | 충돌 마커 잔존, 골격 태그 누락 등 |

### 잡 2) `기능 동작 테스트 (jsdom)`
| 단계 | 도구 | 검사 내용 | 실패 조건 |
|---|---|---|---|
| 기능 테스트 | `npm ci` → `npm test` (`tests/run-all.cjs`, jsdom) | 학습 모드 5방식·구어 교정 진입·커서 blur·음성 입력·글자 크기·복습 전용 화면·커스텀 테마 | 해당 UI 로직이 기대대로 동작하지 않음 |

> 기능 테스트는 `tests/` 폴더의 jsdom 시나리오로, 네트워크/Firebase 없이 인라인 스크립트를 실행해 DOM 결과를 단언한다.

### 실행 트리거
- **Pull Request 생성/갱신 시 자동 실행** (요구사항)
- `main` 및 `claude/**` 브랜치 push 시 실행
- Actions 탭에서 수동 실행(`workflow_dispatch`)도 가능

---

## 2. 로컬에서 CI와 동일하게 검증하기

PR을 올리기 전에 로컬에서 먼저 돌려 보면 실패를 빠르게 막을 수 있다.

```bash
# 1) JavaScript 문법 검증
node scripts/check-inline-js.mjs

# 2) HTML 구조 검증 (htmlhint — 최초 1회 자동 다운로드)
npx --yes htmlhint@1 --config .htmlhintrc index.html

# 3) 배포 전 기본 점검
node scripts/check-deploy.mjs
```

세 명령이 모두 통과하면 CI도 통과한다.

---

## 3. CI 실패 시 원인 파악 방법

1. PR 화면 하단의 **Checks** 또는 저장소 **Actions** 탭에서 실패한 실행을 연다.
2. 빨간 ❌ 표시가 있는 **단계 이름**을 보면 어떤 검증이 실패했는지 바로 알 수 있다.
   - 로그는 `::group::` 으로 접혀 있으니 해당 그룹을 펼친다.

### 자주 나오는 실패와 해결

| 증상(로그) | 원인 | 해결 |
|---|---|---|
| `js/파일명.js — 문법 오류` | JS 괄호/따옴표/세미콜론 짝 오류 | 표시된 js/ 파일을 수정 |
| `tag-pair` 위반 | `<div>` 등 태그가 닫히지 않음 | 해당 태그의 닫는 태그 보강 |
| `id-unique` 위반 | 같은 `id`가 두 번 사용됨 | 한쪽 id를 고유하게 변경 |
| `doctype-first` 위반 | 파일 맨 앞에 `<!DOCTYPE html>` 없음 | 최상단으로 이동 |
| `병합 충돌 마커 ... 남아 있다` | `<<<<<<<`/`=======`/`>>>>>>>` 잔존 | 충돌 마커 제거 후 재커밋 |

> 팁: 로그 메시지는 모두 한국어이며, JS 문법 오류는 **어느 js/ 파일인지**를 함께 출력한다.

---

## 4. Branch Protection — CI 통과 전 머지 차단 (설명)

CI가 실패하면 머지되지 않도록 막으려면 GitHub 저장소에서 보호 규칙을 설정한다.
**아래는 설정 방법 설명이며, 실제 적용은 최고 관리자님이 직접 수행한다.**

### 설정 절차 (GitHub 웹)
1. 저장소 → **Settings** → 왼쪽 **Branches**
2. **Branch protection rules** → **Add branch protection rule** (또는 Rulesets)
3. **Branch name pattern** 에 보호할 브랜치 입력 (예: `main`)
4. 다음 항목을 체크한다.
   - ✅ **Require a pull request before merging**
     - (선택) Require approvals — 리뷰 승인 인원 지정
   - ✅ **Require status checks to pass before merging**
     - **Require branches to be up to date before merging** 체크 권장
     - 검색창에서 상태 체크 **`HTML / JS 기본 검증`** 과 **`기능 동작 테스트 (jsdom)`**
       (= ci.yml의 두 job name) 을 모두 선택
       - ⚠️ 이 체크는 **CI가 최소 1회 실행된 뒤**에야 목록에 나타난다.
         PR을 한 번 올려 CI가 돌게 한 뒤 설정하면 된다.
   - (권장) ✅ **Do not allow bypassing the above settings** — 관리자도 우회 불가
5. **Create / Save changes**

### 적용 후 동작
- CI(`HTML / JS 기본 검증`)가 **실패하면 Merge 버튼이 비활성화**되어 머지가 차단된다.
- CI가 **통과(초록)** 해야만 머지가 가능해진다.

### Rulesets로 설정하는 경우(신규 방식)
- **Settings → Rules → Rulesets → New ruleset**
- Enforcement: **Active**, Target: `main`
- **Require status checks to pass** 추가 → `HTML / JS 기본 검증` 선택

---

## 5. 비용/제한

- 사용 러너: `ubuntu-latest` (퍼블릭 저장소는 무료, 프라이빗도 무료 한도 내)
- `concurrency` 설정으로 같은 PR에 새 커밋이 올라오면 이전 실행을 자동 취소해 사용량을 아낀다.
- 외부 유료 서비스/액션을 사용하지 않는다. (`actions/checkout`, `actions/setup-node`, `htmlhint`만 사용)

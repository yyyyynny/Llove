# CLAUDE.md — 코드네임: 언어

> Claude Code가 이 저장소에서 작업 시 반드시 먼저 읽는 파일.
> KNOWLEDGE v5.0 / SYSTEM v5.0과 함께 사용.
> 최고 관리자: 성재훈
> 최종 업데이트: 2026년 5월 25일 (정식 빌드1 착수 기준)

---

## 프로젝트 개요

한국어 어휘력·표현력 향상 웹앱. 단일 HTML 파일 구조.
현재 정식 빌드1 단계 (데모 종료). Firebase 실제 연동 + 기능 완성 진행 중.

---

## 파일 구조

```
/
├── 언어_데모_v3_8.html          # 최종 데모 파일 (0.16MB, 종료)
├── 언어_KNOWLEDGE_v5.md        # 전체 설계 문서 (최신)
├── 언어_SYSTEM_v5.md           # Claude 행동 지침 (최신)
├── 정령왕_통합_v2.json          # 예문 데이터 (52건)
└── CLAUDE.md                   # 이 파일
```

---

## 행동 규칙 (Claude Code 작업 시 필수 준수)

1. **호칭**: 최고 관리자님
2. **코드 주석**: 전부 한글
3. **커밋**: 승인 후 실행
4. **오류 분석**: 원인 먼저 보고 → 코드 작성
5. **확정 사항 임의 변경 금지** (KNOWLEDGE 참조)
6. **근거 없는 칭찬·불필요한 사과 금지**
7. **node --check 의무화** (JS 문법 검증)
8. **애니메이션**: fadeUp(수직)/slideIn(수평)만. 대각선·회전 완전 금지

---

## 정식 빌드1 구현 목표 (데모 단계 종료)

데모에서 하드코딩되어 있던 항목들 — 빌드1에서 실제 구현 대상:

| 항목 | 데모 상태 | 빌드1 목표 |
|---|---|---|
| 구글 계정 | `honggildong@gmail.com` 하드코딩 | Firebase Authentication 실제 연결 |
| 사용자 데이터 | 정적 `사용자` 객체 | Firestore 실시간 연동 |
| AI API | 미연결 (하드코딩 응답) | Grok 4.1 Fast 실제 호출 |
| 교차검증 | 미연결 | Grok 4.1 Fast 리즈닝 high (이의있음! 전용) |
| 토큰 시스템 | 미구현 | 실제 차감·복구·UI 전체 구현 |
| reasoning_note | 미구현 | 문제 생성 시 동시 생성, Firebase 저장 |
| 개발자 모드 봉인 | 간이 스냅샷 롤백 | 오버레이/실DB 분리 완전 구현 |
| 유의어 변별 출제 | 정적 데이터 2건 | 정령왕_통합_v2.json 52건 연동 |
| 특정 계정 특혜 | 미구현 | 실험용 부계 계정 특혜 로직 |

---

## 1순위 작업 목록 (버그 14건)

| # | 내용 | 핵심 원인 |
|---|---|---|
| 1 | 오늘의 한 문장 슬라이드 점프 | `.kc-slide` `position:absolute→relative` 전환 시 레이아웃 재계산 |
| 2 | 학습 설정 변경 무반응 | `afterNav`가 `학습설정` 값 무시하고 무조건 기본 렌더링 |
| 3 | 유의어 변별 선택한 1개만 표시 | 나머지 3개 설명 출력 로직 없음 |
| 4 | 질문하기 입력창 높이 고정 | `oninput` 자동 높이 조절 없음 |
| 5 | 글꼴 설정 UI 명칭 불일치 | 「폰트 설정」/「폰트 선택」 혼재 → 「글꼴」 통일 |
| 6 | 계정 삭제 탭 없음 | 미구현. 2중 확인 절차 포함 |
| 7 | 구글 계정 하드코딩 | `honggildong@gmail.com` → Firebase 연동 |
| 9 | sq2 재진입 시 학습 방식 초기화 | `afterNav`에서 `학습설정.sq2` 미참조 → 재진입 시 4지선다로 리셋됨 |
| A | FONTS CSS family명 불일치 | 눈누 CDN 전환 시 family명 전부 교체 필요 |
| B | 글꼴 모달 CSS 적용 로직 오류 | `openFontSelect()` style 조립 버그 |
| C | kc-dots 인디케이터 가려짐 | position 충돌 |
| D | fontTxt 초기값 하드코딩 | 「고운 바탕」→ 현재 기본 글꼴로 |
| E | 이의있음! 컨텍스트 미초기화 | `closeObj()` 시 general 복귀 없음 |

---

## 추가 작업 (Claude Code 단계)

- **눈누 CDN 폰트 전환** (base64 → @font-face CDN, HTML 11.6MB → 수백KB)
- **글꼴 샘플 2세트 번갈아가며**: 피차일반(음율) ↔ Betelgeuse(유우리)
- **GitHub Pages 배포 설정**
- **Firebase 연동** (Auth + Firestore)
- **계정 삭제 기능** (2중 확인)
- **AI 출제 분기 로직**: DB 40% / AI 60% 확률 결정 + DB 소진 시 팝업 → AI 강제 전환 (KNOWLEDGE 4섹션)
- **성장 상세 화면 (`sg`) 구현**: 소칭호 전체 로드맵 + EXP 진행 바 (KNOWLEDGE 17-1섹션)
- **토큰 UI 전체 구현**: 잔량 바 + 차감 내역 드롭다운 + [? 차감 안내] 팝업 (KNOWLEDGE 35섹션)

---

## 절대 고정 항목

- 바텀 네비 `#g-bnav`: `.screen` 밖 독립 위치 (z-index:200)
- 플래시카드 ①~⑥ 번호·레이블: 수정 금지
- Firebase 변수명: KNOWLEDGE 13섹션 한글 변수명
- localStorage 키: `plx_` 접두사
- API 키: Cloudflare Workers만 (프론트 노출 금지)

---

## 기술 스택

| 항목 | 내용 |
|---|---|
| 배포 | GitHub Pages |
| 인증 | Firebase Auth (구글 로그인 강제) |
| DB | Firestore + GitHub JSON |
| **메인 API** | **Grok 4.1 Fast 단일 (Cloudflare Workers 관리)** |
| **교차검증** | **Grok 4.1 Fast 리즈닝 high (이의있음! 전용)** |
| 서버리스 | Cloudflare Workers (API 키 관리 — Grok 포함) |
| 예문 데이터 | 정령왕_통합_v2.json (52건) |
| 폰트 | CDN 4종 + 눈누 CDN 6종 |
| 광고 | 카카오 애드핏 (보류) |

---

## 설계 참고

- KNOWLEDGE v5.0: 전체 설계 문서 (최신) — `언어_KNOWLEDGE_v5.md`
- SYSTEM v5.0: Claude 행동 지침 (최신) — `언어_SYSTEM_v5.md`
- 보류 항목: KNOWLEDGE 21섹션 — 임의 확정 금지
- Claude Code 작업 목록: KNOWLEDGE 31섹션 참조

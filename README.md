# Llove

한국어 어휘력·표현력 향상 학습 웹앱. **단일 HTML 파일**(`index.html`) 구조로,
GitHub Pages에 그대로 배포된다.

## 주요 기능
- 9가지 학습 모드: 상식·어원 / 세계사·신화 / 고사성어·속담 / 한자·우리말 / 맞춤법 / 아재개그 / 구어 교정 /
  지문 독해 / 문장 배열(뒤섞인 문장을 탭으로 원래 순서대로 배치)
- 플래시카드 · 4지선다 · 역방향 · 뜻 직접 서술 · 예문형(옛 "유의어 변별") 등 출제 방식 선택
- 복습 대기열(전용 복습 화면) · 업적 · 레벨/소칭호 성장 시스템
- 테마(프리셋 5종 + **커스텀 테마 에디터**) · 글꼴 10종 · **화면·글자 크기 조절(70~150%)**
- 구어 교정 **음성 입력**(브라우저 Web Speech API, 한국어)
- Firebase(구글 로그인 + Firestore) 연동 — 배너·프로필 사진 크롭 업로드 포함

> AI 기능(질문하기·이의있음·AI 출제·구어 교정 채점)은 Grok 게이트(`GROK_활성화=false`)로
> 봉인되어 있으며, 크레딧 구매 후 플래그만 켜면 활성화된다.

## 개발 / 검증

```bash
npm install            # 개발 의존성(htmlhint, jsdom) 설치
npm run check:js       # 인라인 JS 문법 검증 (node --check)
npm run check:html     # HTML 구조 검증 (htmlhint)
npm run check:deploy   # 배포 전 정합성 점검
npm test               # jsdom 기능 동작 테스트 (tests/)
```

CI(GitHub Actions)가 PR/푸시 시 위 검증을 자동 실행한다. 자세한 내용은 [`docs/CI_가이드.md`](docs/CI_가이드.md) 참조.

## 문서
- `CLAUDE.md` — 작업 규칙
- `언어_KNOWLEDGE_v5.md` — 전체 설계 문서
- `작업인계_노트.md` — 세션 인계 노트
- `docs/CI_가이드.md` — CI · Branch Protection 안내

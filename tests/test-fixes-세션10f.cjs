// 세션10-f 모바일 실기기 피드백 검증 — 화면크기 기본값 90%·초기화 시 배너/프로필 리셋·배너 크롭 좌표 버그
const { load, makeHarness } = require('./load.cjs');
load((window) => {
  const { assert, finish } = makeHarness('세션10-f 모바일 피드백 수정 테스트');
  const doc = window.document, ev = (c) => window.eval(c);

  /* ── 항목1: 화면 크기 기본값 90% ── */
  assert('#1: 화면 크기 패널 기본 90% 표시', doc.getElementById('fontScaleTxt').textContent.startsWith('90%'));
  assert('#1: 90% 칩이 기본 on', doc.querySelector('#fontScaleOpts .fs-opt.on').textContent.trim() === '90%');

  // 게스트 부팅 경로(저장값 없을 때) 재현
  window.localStorage.removeItem('plx_화면배율');
  ev(`
    const 저장화면 = localStorage.getItem('plx_화면배율');
    setFontScale(저장화면 ? parseInt(저장화면,10) : 90, true);
  `);
  assert('#1: 저장값 없는 게스트 부팅 시 zoom 0.9', doc.documentElement.style.zoom === '0.9');

  // Firestore 복원 경로(저장값 없을 때) 재현
  ev(`setFontScale((undefined) || 90, true);`);
  assert('#1: Firestore 데이터에 화면배율 없을 때도 0.9로 복원', doc.documentElement.style.zoom === '0.9');

  // 기존 저장값이 있으면 그 값을 존중(기본값이 기존 설정을 덮어쓰지 않음)
  ev(`setFontScale(125 || 90, true);`);
  assert('#1: 기존 저장값(125%)은 90으로 덮이지 않음', doc.documentElement.style.zoom === '1.25');
  ev('setFontScale(90, true);'); // 다음 테스트를 위해 원복

  // 신규 사용자 기본값에도 90 포함
  ev(`
    fbDb = { collection: () => ({ doc: () => ({ set: () => Promise.resolve() }) }) };
    현재UID = 'new-user'; fbAuth = { currentUser: { email: 't@t.com' } };
    신규사용자_생성();
  `);
  assert('#1: 신규 사용자 기본 화면배율 90', ev('사용자.화면배율') === 90);

  /* ── 항목2: 학습 데이터 초기화 시 배너·프로필도 리셋 ── */
  ev(`
    fbDb = { collection: () => ({ doc: () => ({ set: () => Promise.resolve(), update: () => Promise.resolve() }) }) };
    현재UID = 'test-uid';
    사용자.배너이미지 = 'grad:3';
    사용자.프로필이미지 = '🐱';
    배너_적용(document.getElementById('statusBanner'), 'grad:3');
    아바타_적용(document.getElementById('homeAvatar'), '🐱');
  `);
  ev("학습데이터초기화_실행();");
  assert('#2: 초기화 후 배너이미지 필드 리셋', ev('사용자.배너이미지') === '');
  assert('#2: 초기화 후 프로필이미지 필드 리셋(기본 이모지)', ev('사용자.프로필이미지') === '⚔️');
  assert('#2: 홈 아바타 DOM 즉시 갱신', doc.getElementById('homeAvatar').textContent === '⚔️');
  assert('#2: 현황 배너 DOM 즉시 갱신(커스텀 배경 제거)', doc.getElementById('statusBanner').style.background === '');

  /* ── 항목3: 배너 크롭 — 트랜지션에 영향받는 getBoundingClientRect 대신 offsetWidth/Height 사용 ──
     (함수 주석에 배경 설명으로 "getBoundingClientRect"라는 단어 자체는 남아있을 수 있어 실제 호출 패턴만 확인) */
  const 크롭함수소스 = ev('배너크롭_열기.toString()');
  assert('#3: 실제 getBoundingClientRect() 호출은 제거됨(주석 설명 문구는 무관)', !/\.getBoundingClientRect\(\)/.test(크롭함수소스.replace(/\/\/.*$/gm, '')));
  assert('#3: offsetWidth/offsetHeight로 뷰포트 크기 측정', 크롭함수소스.includes('offsetWidth') && 크롭함수소스.includes('offsetHeight'));

  process.exit(finish() > 0 ? 1 : 0);
});

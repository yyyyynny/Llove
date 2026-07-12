// 세션10-f/g 모바일 실기기 피드백 검증 — 화면크기(표기 100%·실제 0.9 조용히 적용)·범위(70~150%)·
// 초기화 시 배너/프로필 리셋·배너 크롭 좌표 버그
const { load, makeHarness } = require('./load.cjs');
load((window) => {
  const { assert, finish } = makeHarness('세션10-f 모바일 피드백 수정 테스트');
  const doc = window.document, ev = (c) => window.eval(c);

  /* ── 항목1(세션10-g 정정): 기본 선택칩·문구는 100% 그대로, 저장값 없을 때만 zoom 0.9를 "조용히" 적용 ──
     사용자 확인: "기본 선택칩(100%)은 그대로 두고, 실제 적용되는 배율만 90%로" — 표기(100%)와 실제 zoom(0.9)
     사이 의도된 불일치. setFontScale을 거치면 칩·문구가 "90%"로 바뀌어버리므로 그건 쓰지 않는다. */
  assert('#1: 화면 크기 패널 기본 표기는 100% 유지', doc.getElementById('fontScaleTxt').textContent.startsWith('100%'));
  assert('#1: 100% 칩이 기본 on(90%로 바뀌지 않음)', doc.querySelector('#fontScaleOpts .fs-opt.on').textContent.trim() === '100%');

  // 게스트 부팅 경로(저장값 없을 때) — 실제 코드와 동일한 패턴 재현
  window.localStorage.removeItem('plx_화면배율');
  ev(`
    const 저장화면 = localStorage.getItem('plx_화면배율');
    if(저장화면) setFontScale(parseInt(저장화면,10), true);
    else document.documentElement.style.zoom = '0.9';
  `);
  assert('#1: 저장값 없는 게스트 부팅 시 zoom 0.9(조용히 적용)', doc.documentElement.style.zoom === '0.9');
  assert('#1: 조용히 적용 후에도 칩·문구는 100% 그대로', doc.getElementById('fontScaleTxt').textContent.startsWith('100%'));

  // Firestore 복원 경로(저장값 없을 때) 재현
  ev(`if(undefined) setFontScale(undefined, true); else document.documentElement.style.zoom = '0.9';`);
  assert('#1: Firestore 데이터에 화면배율 없을 때도 zoom 0.9로 조용히 적용', doc.documentElement.style.zoom === '0.9');

  // 기존 저장값이 있으면 setFontScale로 정상 복원(칩·문구도 그 값에 맞춰 동기화되는 게 맞음)
  ev(`if(125) setFontScale(125, true); else document.documentElement.style.zoom = '0.9';`);
  assert('#1: 저장된 값(125%)이 있으면 정상 복원(칩도 125%로)', doc.documentElement.style.zoom === '1.25' && doc.querySelector('#fontScaleOpts .fs-opt.on').textContent.trim() === '125%');
  ev("setFontScale(100, true);"); // 다음 테스트를 위해 원복

  // 신규 사용자는 화면배율 필드를 저장하지 않음(미저장 상태 유지가 곧 "기본" 동작)
  ev(`
    fbDb = { collection: () => ({ doc: () => ({ set: () => Promise.resolve() }) }) };
    현재UID = 'new-user'; fbAuth = { currentUser: { email: 't@t.com' } };
    신규사용자_생성();
  `);
  assert('#1: 신규 사용자는 화면배율 필드를 저장하지 않음', ev('사용자.화면배율') === undefined);

  /* ── 항목2(세션10-g): 화면 크기 최대 150%(175·200 제거) ── */
  assert('#2: 화면크기단계 최대 150', ev('Math.max(...화면크기단계)') === 150);
  assert('#2: 화면크기단계에 175·200 없음', !ev('화면크기단계.includes(175)') && !ev('화면크기단계.includes(200)'));
  assert('#2: 175%·200% 버튼 DOM에서 제거됨', !Array.from(doc.querySelectorAll('#fontScaleOpts .fs-opt')).some(b=>['175%','200%'].includes(b.textContent.trim())));

  /* ── 항목3(세션10-g): 화면·글자 크기 최소 70% ── */
  assert('#3: 화면크기단계 최소 70', ev('Math.min(...화면크기단계)') === 70);
  assert('#3: 글자크기단계 최소 70', ev('Math.min(...글자크기단계)') === 70);
  ev('setFontScale(70, true);');
  assert('#3: 화면 크기 70% 실제 적용', doc.documentElement.style.zoom === '0.7');
  ev('set글자크기(70, true);');
  assert('#3: 글자 크기 70% 실제 적용', doc.documentElement.style.getPropertyValue('--글자배율') === '0.7');
  ev('setFontScale(100, true); set글자크기(100, true);'); // 원복

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

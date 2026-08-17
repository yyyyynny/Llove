// 세션10-n — 키보드 접근성: onclick 만 달린 조작 요소를 Tab/Enter 로 쓸 수 있는지
// (감사에서 확인된 결함: 학습 모드 카드·퀴즈 선택지가 role/tabindex 없는 div 라
//  키보드만 쓰는 사용자는 앱의 핵심 기능을 아예 시작할 수 없었다)
const { load, makeHarness } = require('./load.cjs');

load((win) => {
  const { assert, finish } = makeHarness('세션10-n 키보드 접근성 테스트');
  const d = win.document, ev = (c) => win.eval(c);

  /* ── 정적 요소: 학습 모드 카드가 Tab 순서에 있는가 ── */
  const 모드카드 = [...d.querySelectorAll('.mc[onclick]')];
  assert(`학습 모드 카드를 찾았다 (${모드카드.length}개)`, 모드카드.length >= 9, `${모드카드.length}개`);
  assert('학습 모드 카드 전부 role="button" + tabindex="0"',
    모드카드.every(e => e.getAttribute('role') === 'button' && e.getAttribute('tabindex') === '0'),
    모드카드.filter(e => e.getAttribute('tabindex') !== '0').length + '개 누락');

  /* ── 제외 대상: 조작 요소가 아닌 것에 Tab 순서를 주지 않았는가 ── */
  const 배경 = [...d.querySelectorAll('.ov-bg[onclick], .modal-bg[onclick], .ask-bg[onclick], .obj-bg[onclick], .ach-detail-bg[onclick]')];
  assert(`배경 클릭 닫기 ${배경.length}개는 Tab 순서에서 제외`,
    배경.length > 0 && 배경.every(e => !e.hasAttribute('tabindex')));
  const 전파차단 = [...d.querySelectorAll('[onclick]')]
    .filter(e => /^\s*event\.stopPropagation\(\)\s*;?\s*$/.test(e.getAttribute('onclick') || ''));
  assert(`전파 차단 껍데기 ${전파차단.length}개는 Tab 순서에서 제외`,
    전파차단.length > 0 && 전파차단.every(e => !e.hasAttribute('tabindex')));

  /* ── Enter/Space 가 실제로 클릭으로 이어지는가 ── */
  ev('window.__kb = 0; window.__kbTest = () => { window.__kb++; };');
  const 누르기 = (el, key) => el.dispatchEvent(new win.KeyboardEvent('keydown', { key, bubbles: true }));

  const 대상 = d.createElement('div');
  대상.setAttribute('onclick', 'window.__kbTest()');
  d.body.appendChild(대상);
  ev('키보드접근_보강(document)');
  assert('나중에 추가된 요소도 보강된다', 대상.getAttribute('tabindex') === '0');

  누르기(대상, 'Enter');
  assert('Enter 가 클릭으로 전달된다', ev('window.__kb') === 1, 'count=' + ev('window.__kb'));
  누르기(대상, ' ');
  assert('Space 도 클릭으로 전달된다', ev('window.__kb') === 2, 'count=' + ev('window.__kb'));
  누르기(대상, 'a');
  assert('관계없는 키는 클릭을 일으키지 않는다', ev('window.__kb') === 2, 'count=' + ev('window.__kb'));

  /* ── ⚠️ 중복 채점 방지: 마우스로 못 누르는 상태면 키보드로도 안 눌려야 ──
     .aopt.disabled 등은 pointer-events:none 으로 비활성되는데 el.click() 은 그걸 무시한다.
     가드가 없으면 채점이 끝난 선택지를 Enter 로 다시 눌러 정답 처리가 중복된다. */
  const 비활성 = d.createElement('div');
  비활성.className = 'aopt disabled';
  비활성.setAttribute('onclick', 'window.__kbTest()');
  d.body.appendChild(비활성);
  ev('키보드접근_보강(document)');
  const 이전 = ev('window.__kb');
  누르기(비활성, 'Enter');
  assert('pointer-events:none 인 선택지는 Enter 로 눌리지 않는다(중복 채점 방지)',
    ev('window.__kb') === 이전, `${이전} → ${ev('window.__kb')}`);

  process.exit(finish() > 0 ? 1 : 0);
});

// 세션10-h — 모바일에서 Shift+Enter가 불편해 Enter 전송/줄바꿈을 기기별로 분기
const { load, makeHarness } = require('./load.cjs');
load((window) => {
  const { assert, finish } = makeHarness('세션10-h 모바일 Enter 전송 예외 테스트');
  const doc = window.document, ev = (c) => window.eval(c);

  function keypress(el, shiftKey){
    const e = new window.KeyboardEvent('keypress', { key: 'Enter', shiftKey: !!shiftKey, cancelable: true, bubbles: true });
    el.dispatchEvent(e);
    return e;
  }

  const inp = doc.getElementById('askInp');

  /* ── PC(정밀 포인터) 환경: 기존 동작 유지 ── */
  ev(`
    window.matchMedia = (q) => ({ matches: false, media: q });
    window.__sendCalled = 0; window.__origSendAsk = sendAsk;
    sendAsk = () => { window.__sendCalled++; };
  `);
  let e = keypress(inp, false);
  assert('PC: Enter(Shift 없음) → 전송 호출 + 기본동작 취소', ev('window.__sendCalled') === 1 && e.defaultPrevented);

  ev('window.__sendCalled = 0;');
  e = keypress(inp, true);
  assert('PC: Shift+Enter → 전송 안 됨(줄바꿈 허용)', ev('window.__sendCalled') === 0 && !e.defaultPrevented);

  /* ── 모바일(터치 우선) 환경: Enter가 줄바꿈, 전송 안 됨 ── */
  ev(`window.matchMedia = (q) => ({ matches: true, media: q });`);
  ev('window.__sendCalled = 0;');
  e = keypress(inp, false);
  assert('모바일: Enter(Shift 없음)도 전송 안 됨(줄바꿈 허용)', ev('window.__sendCalled') === 0 && !e.defaultPrevented);

  ev('window.__sendCalled = 0;');
  e = keypress(inp, true);
  assert('모바일: Shift+Enter도 당연히 전송 안 됨', ev('window.__sendCalled') === 0 && !e.defaultPrevented);

  assert('모바일_입력환경() 판정 함수 정상 동작', ev('모바일_입력환경()') === true);

  // 전송 버튼은 기기와 무관하게 항상 존재(모바일의 유일한 전송 수단)
  assert('전송 버튼 항상 존재', !!doc.querySelector('.ask-send'));

  ev('sendAsk = window.__origSendAsk;'); // 원복

  process.exit(finish() > 0 ? 1 : 0);
});

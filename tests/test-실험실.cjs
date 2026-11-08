// 실험실(js/grok.js의 실험실_목록·실험실_항목탭) 상태 표시 정합성 검증.
// ─────────────────────────────────────────────────────────────────────────
// 2026-11-08 관리자님 결정: 실험실은 「준비 중인 기능을 미리 보는 곳」이다.
// 이미 쓸 수 있는 기능(끝말잇기 — 홈 '잇' 포탈로 들어감)은 목록에서 뺀다.
// 일반 사용자에겐 '예정' 항목만, '실험' 항목은 개발자 모드에만 보인다.
const { load, makeHarness } = require('./load.cjs');

const { assert, finish } = makeHarness('실험실 상태 표시 정합성');

load((win) => {
  const ev = (code) => win.eval(code);
  const doc = win.document;

  // (1) 이미 쓸 수 있는 끝말잇기는 실험실에 없다(입구는 홈 포탈 하나)
  assert('실험실에 끝말잇기 항목이 없다', !ev("실험실_목록.some(x => x.이름 === '끝말잇기')"));
  assert('끝말잇기 입구(잇는_포탈탭)는 그대로 있다', typeof win.잇는_포탈탭 === 'function');

  // (2) '예정' 항목은 준비 중 안내로 막힌다(과잉 개방 방지)
  const 예정인덱스 = ev("실험실_목록.findIndex(x => x.상태 === '예정')");
  assert('"예정" 항목이 있다(테스트 전제)', 예정인덱스 >= 0);
  ev("사용자.개발자모드 = false;");
  ev(`실험실_열기(); 실험실_항목탭(${예정인덱스});`);
  assert('"예정" 항목은 준비 중 안내로 막힌다',
    doc.getElementById('infoDesc').innerHTML.includes('준비 중이에요'));

  // (3) 일반 사용자 목록엔 '예정'만 렌더된다('실험'은 개발자 모드만) — 모달 본문만 본다
  ev("실험실_열기();");
  const html = doc.getElementById('infoDesc').innerHTML;
  const 목록 = JSON.parse(ev("JSON.stringify(실험실_목록)"));
  assert('실험실 목록엔 "예정" 항목만 렌더된다',
    목록.every(x => html.includes(x.이름) === (x.상태 === '예정')), 목록.map(x=>x.상태).join(','));
  ev("사용자.개발자모드 = true; 실험실_열기();");
  assert('개발자 모드면 "실험" 항목도 보인다',
    목록.filter(x => x.상태 === '실험').every(x => doc.getElementById('infoDesc').innerHTML.includes(x.이름)));
  ev("사용자.개발자모드 = false;");

  process.exit(finish() > 0 ? 1 : 0);
});

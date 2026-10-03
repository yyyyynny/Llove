// 2026-10-03 UI 개선(인계 노트 13절, docs/UI감사_2026-10-03.md) — 고친 동작 회귀 검증
const { load, makeHarness } = require('./load.cjs');

load((window) => {
  const { assert, finish } = makeHarness('UI 개선 — 감사 지적 수정');
  const doc = window.document;
  const ev = (code) => window.eval(code);
  const 보임 = (id) => doc.getElementById(id).classList.contains('show');

  // U2: 레벨업과 업적이 한꺼번에 오면 겹치지 않고 하나씩, 업적 둘째 것도 잃지 않는다
  ev("레벨업팝업(5); 업적_팝업표시(ACH_DATA[0].items[0].key, 0, 10); 업적_팝업표시(ACH_DATA[0].items[1].key, 0, 20);");
  assert('U2: 처음엔 레벨업만 보인다', 보임('lvupOv') && !보임('achOv'));
  ev('closeLvUp()');
  assert('U2: 레벨업을 닫으면 첫 업적', 보임('achOv') && doc.getElementById('ppExp').textContent === '+10 EXP');
  ev('closeAchOv()');
  assert('U2: 둘째 업적도 이어서 보인다', 보임('achOv') && doc.getElementById('ppExp').textContent === '+20 EXP');
  ev('closeAchOv()');
  assert('U2: 다 닫으면 아무것도 안 보인다', !보임('achOv') && !보임('lvupOv'));

  // U3: 봉인 중 이의있음 — 열 때부터 제출이 막혀 있고, 제출을 시도해도 쓴 글이 남는다
  ev("사용자.보유토큰 = 100; openObj('general');");
  const 제출 = doc.getElementById('objSubmit');
  assert('U3: 봉인 중엔 열자마자 제출 버튼이 막혀 있다', 제출.disabled && 제출.textContent.includes('연동 후'), 제출.textContent);
  doc.getElementById('objInp').value = '근거가 틀렸습니다';
  ev('submitObj()');
  assert('U3: 제출 시도 후에도 쓴 글이 남는다', doc.getElementById('objInp').value === '근거가 틀렸습니다');
  ev('closeObj()');

  process.exit(finish() > 0 ? 1 : 0);
});

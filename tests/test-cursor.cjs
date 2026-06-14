// 항목4: 커서 깜빡임(입력 포커스 잔존) 수정 검증
const { load } = require('./load.cjs');
load((window) => {
  const results = [];
  const assert = (n, c, d) => results.push({ n, c: !!c, d: d || '' });
  const doc = window.document;
  const ev = (code) => window.eval(code);

  // 1) ask 패널 입력 포커스 후 closeAsk → blur 되어야 함
  const askInp = doc.getElementById('askInp');
  askInp.focus();
  assert('ask 입력 포커스됨(전제)', doc.activeElement === askInp);
  ev('closeAsk();');
  assert('closeAsk 후 입력 포커스 해제(커서 사라짐)', doc.activeElement !== askInp, `active=${doc.activeElement && doc.activeElement.id}`);

  // 2) 구어 입력 포커스 후 화면 전환(goNav) → blur
  const spk = doc.getElementById('spkInput');
  spk.focus();
  assert('구어 입력 포커스됨(전제)', doc.activeElement === spk);
  ev("goNav('sh', null);");
  assert('goNav 후 입력 포커스 해제', doc.activeElement !== spk, `active=${doc.activeElement && doc.activeElement.id}`);

  // 3) 이의있음 입력 포커스 후 closeObj → blur
  const objInp = doc.getElementById('objInp');
  objInp.focus();
  ev('closeObj();');
  assert('closeObj 후 입력 포커스 해제', doc.activeElement !== objInp);

  let fail = 0;
  console.log('\n=== 항목4 커서 깜빡임 수정 테스트 ===');
  for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  ('+r.d+')' : ''}`); if (!r.c) fail++; }
  console.log(`\n총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
  process.exit(fail > 0 ? 1 : 0);
});

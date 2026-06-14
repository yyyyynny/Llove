// 항목9: 글자 크기 조절(앱 배율) 동작·저장 검증
const { load } = require('./load.cjs');
load((window) => {
  const results = [];
  const assert = (n, c, d) => results.push({ n, c: !!c, d: d || '' });
  const doc = window.document;
  const ev = (code) => window.eval(code);
  const root = doc.documentElement;

  // 1) 150% 적용
  ev('setFontScale(150);');
  assert('150%: root zoom=1.5', root.style.zoom === '1.5', `zoom=${root.style.zoom}`);
  assert('150%: 표시 텍스트 갱신', doc.getElementById('fontScaleTxt').textContent === '150%');
  assert('150%: 칩 on 상태', doc.querySelector('#fontScaleOpts .fs-opt.on').textContent.trim() === '150%');
  assert('150%: localStorage 저장', window.localStorage.getItem('plx_글자배율') === '150');

  // 2) 80% 적용
  ev('setFontScale(80);');
  assert('80%: root zoom=0.8', root.style.zoom === '0.8', `zoom=${root.style.zoom}`);
  assert('80%: 표시 텍스트', doc.getElementById('fontScaleTxt').textContent === '80%');

  // 3) 비정상 값 → 100% 폴백
  ev('setFontScale(999);');
  assert('비정상 값은 100%로 폴백', doc.getElementById('fontScaleTxt').textContent === '100%');

  // 4) 저장값 복원 시뮬레이션
  window.localStorage.setItem('plx_글자배율', '125');
  ev("setFontScale(parseInt(localStorage.getItem('plx_글자배율'),10), true);");
  assert('복원: 125% 적용', root.style.zoom === '1.25' && doc.getElementById('fontScaleTxt').textContent === '125%', `zoom=${root.style.zoom}`);

  // 5) 8단계 전부 적용 가능
  let 단계OK = true;
  for (const p of [80,90,100,110,125,150,175,200]) { ev(`setFontScale(${p}, true);`); if (root.style.zoom !== String(p/100)) 단계OK = false; }
  assert('8단계(80~200%) 모두 정상 적용', 단계OK);

  let fail = 0;
  console.log('\n=== 항목9 글자 크기 조절 테스트 ===');
  for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  ('+r.d+')' : ''}`); if (!r.c) fail++; }
  console.log(`\n총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
  process.exit(fail > 0 ? 1 : 0);
});

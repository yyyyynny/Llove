// 세션5 버그1: 「화면 크기」(zoom)·「글자 크기」(--글자배율) 분리 동작·저장 검증
// (구 항목9 테스트를 새 이원 구조에 맞게 개편)
const { load } = require('./load.cjs');
load((window) => {
  const results = [];
  const assert = (n, c, d) => results.push({ n, c: !!c, d: d || '' });
  const doc = window.document;
  const ev = (code) => window.eval(code);
  const root = doc.documentElement;

  /* ── A. 화면 크기 (setFontScale = zoom) ── */
  ev('setFontScale(150);');
  assert('화면 150%: root zoom=1.5', root.style.zoom === '1.5', `zoom=${root.style.zoom}`);
  assert('화면 150%: 표시 텍스트 갱신', doc.getElementById('fontScaleTxt').textContent.startsWith('150%'));
  assert('화면 150%: 칩 on 상태', doc.querySelector('#fontScaleOpts .fs-opt.on').textContent.trim() === '150%');
  assert('화면 150%: plx_화면배율 저장', window.localStorage.getItem('plx_화면배율') === '150');

  ev('setFontScale(80);');
  assert('화면 80%: root zoom=0.8', root.style.zoom === '0.8', `zoom=${root.style.zoom}`);
  ev('setFontScale(999);');
  assert('화면 비정상 값 → 100% 폴백', doc.getElementById('fontScaleTxt').textContent.startsWith('100%'));

  // 저장값 복원 시뮬레이션 (초기 로드 경로와 동일)
  window.localStorage.setItem('plx_화면배율', '125');
  ev("setFontScale(parseInt(localStorage.getItem('plx_화면배율'),10), true);");
  assert('화면 복원: 125% 적용', root.style.zoom === '1.25', `zoom=${root.style.zoom}`);

  let 단계OK = true;
  // 세션10-g: 최소 70%·최대 150%로 범위 조정(175·200 제거, 70 추가)
  for (const p of [70,80,90,100,110,125,150]) { ev(`setFontScale(${p}, true);`); if (root.style.zoom !== String(p/100)) 단계OK = false; }
  assert('화면 7단계(70~150%) 모두 정상 적용', 단계OK);

  /* ── B. 글자 크기 (set글자크기 = --글자배율, zoom 불변) ── */
  ev('setFontScale(100, true);');  // 화면 100% 고정 후 글자만 조절
  ev('set글자크기(125);');
  assert('글자 125%: --글자배율=1.25', root.style.getPropertyValue('--글자배율') === '1.25', `배율=${root.style.getPropertyValue('--글자배율')}`);
  assert('글자 125%: 화면 zoom은 그대로 1', root.style.zoom === '1', `zoom=${root.style.zoom}`);
  assert('글자 125%: 표시 텍스트 갱신', doc.getElementById('textScaleTxt').textContent.startsWith('125%'));
  assert('글자 125%: 칩 on 상태', doc.querySelector('#textScaleOpts .fs-opt.on').textContent.trim() === '125%');
  assert('글자 125%: plx_글자배율 저장', window.localStorage.getItem('plx_글자배율') === '125');

  ev('set글자크기(999);');
  assert('글자 비정상 값 → 100% 폴백', root.style.getPropertyValue('--글자배율') === '1');

  window.localStorage.setItem('plx_글자배율', '150');
  ev("set글자크기(parseInt(localStorage.getItem('plx_글자배율'),10), true);");
  assert('글자 복원: 150% 적용', root.style.getPropertyValue('--글자배율') === '1.5');

  let 글자단계OK = true;
  // 세션10-g 항목3: 최소 70% 추가
  for (const p of [70,80,90,100,110,125,150]) { ev(`set글자크기(${p}, true);`); if (root.style.getPropertyValue('--글자배율') !== String(p/100)) 글자단계OK = false; }
  assert('글자 7단계(70~150%) 모두 정상 적용', 글자단계OK);

  let fail = 0;
  console.log('\n=== 세션5 화면/글자 크기 분리 테스트 (구 항목9) ===');
  for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  ('+r.d+')' : ''}`); if (!r.c) fail++; }
  console.log(`\n총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
  process.exit(fail > 0 ? 1 : 0);
});

// 세션10-m — 애니메이션 통일성 4건 + 접근성 1건(CSS 전용 항목 검증)
// (JS 동작 항목 (c)·(d)는 tests/test-wchain-플레이.cjs에서 검증 — 여기는 순수 CSS 텍스트 확인)
const fs = require('fs');
const path = require('path');
const { makeHarness } = require('./load.cjs');

const { assert, finish } = makeHarness('세션10-m 애니메이션 통일성·접근성 테스트');

const ROOT = path.join(__dirname, '..');
const LLOVE_CSS = fs.readFileSync(path.join(ROOT, 'Llove', 'style.css'), 'utf8');
const WCHAIN_HTML = fs.readFileSync(path.join(ROOT, 'wchain', 'index.html'), 'utf8');

/* (a) .syn-opt·.rc-opt 정답/오답 반응이 .aopt와 같은 키프레임을 쓰는지 */
assert('Llove style.css: .syn-opt.correct가 correctPop을 쓴다',
  /\.syn-opt\.correct\{[^}]*animation:correctPop/.test(LLOVE_CSS));
assert('Llove style.css: .syn-opt.wrong이 shakeLR을 쓴다',
  /\.syn-opt\.wrong\{[^}]*animation:shakeLR/.test(LLOVE_CSS));
assert('Llove style.css: .rc-opt.correct가 correctPop을 쓴다',
  /\.rc-opt\.correct\{[^}]*animation:correctPop/.test(LLOVE_CSS));
assert('Llove style.css: .rc-opt.wrong이 shakeLR을 쓴다',
  /\.rc-opt\.wrong\{[^}]*animation:shakeLR/.test(LLOVE_CSS));
assert('새 키프레임을 만들지 않고 기존 것만 재사용(정의는 여전히 한 번씩만)',
  (LLOVE_CSS.match(/@keyframes correctPop/g) || []).length === 1
  && (LLOVE_CSS.match(/@keyframes shakeLR/g) || []).length === 1);

/* (b) prefers-reduced-motion 전역 폴백 — Llove·wchain 양쪽 다(별도 스타일시트라 각자 필요) */
assert('Llove style.css에 prefers-reduced-motion 폴백이 있다',
  LLOVE_CSS.includes('prefers-reduced-motion: reduce'));
assert('wchain index.html 인라인 스타일에도 prefers-reduced-motion 폴백이 있다',
  WCHAIN_HTML.includes('prefers-reduced-motion: reduce'));

/* 사소한 정리 — 죽은 키프레임 제거, 낡은 주석 정정 */
assert('죽은 키프레임 scaleIn이 제거됨', !LLOVE_CSS.includes('@keyframes scaleIn'));
assert('낡은 "회전 완전 금지" 절대 문구가 애니메이션 섹션 주석에서 빠짐',
  !LLOVE_CSS.includes('애니메이션 (대각선·회전 금지)'));

/* (c)·(d)가 기대하는 CSS 재료가 wchain 쪽에 실제로 존재하는지(JS 동작 자체는 플레이 테스트에서 확인) */
assert('wchain에 shakeLR 키프레임과 .hud-val.hit이 있다',
  WCHAIN_HTML.includes('@keyframes shakeLR') && WCHAIN_HTML.includes('.hud-val.hit'));

process.exit(finish() > 0 ? 1 : 0);

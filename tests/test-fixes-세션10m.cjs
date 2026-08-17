// 세션10-m — 애니메이션 통일성 4건 + 접근성 1건(CSS 전용 항목 검증)
// (JS 동작 항목 (c)·(d)는 tests/test-wchain-플레이.cjs에서 검증 — 여기는 순수 CSS 텍스트 확인)
const fs = require('fs');
const path = require('path');
const { makeHarness } = require('./load.cjs');

const { assert, finish } = makeHarness('세션10-m 애니메이션 통일성·접근성 테스트');

const ROOT = path.join(__dirname, '..');
const LLOVE_CSS = fs.readFileSync(path.join(ROOT, 'Llove', 'style.css'), 'utf8');
const WCHAIN_HTML = fs.readFileSync(path.join(ROOT, 'wchain', 'index.html'), 'utf8');

/* (a) .syn-opt·.rc-opt 정답/오답 반응이 .aopt와 같은 결로 움직이는지 */
assert('Llove style.css: .syn-opt.correct가 정답 플래시를 쓴다',
  /\.syn-opt\.correct\{[^}]*animation:correctPop18/.test(LLOVE_CSS));
assert('Llove style.css: .syn-opt.wrong이 shakeLR을 쓴다',
  /\.syn-opt\.wrong\{[^}]*animation:shakeLR/.test(LLOVE_CSS));
assert('Llove style.css: .rc-opt.correct가 정답 플래시를 쓴다',
  /\.rc-opt\.correct\{[^}]*animation:correctPop18/.test(LLOVE_CSS));
assert('Llove style.css: .rc-opt.wrong이 shakeLR을 쓴다',
  /\.rc-opt\.wrong\{[^}]*animation:shakeLR/.test(LLOVE_CSS));
assert('shakeLR은 키프레임 하나만 유지(중복 정의 없음)',
  (LLOVE_CSS.match(/@keyframes shakeLR/g) || []).length === 1);

/* ⚠️ 회귀 방지 — 애니메이션 fill-mode:both가 정답 배경을 덮어쓰지 않는지.
   CSS 애니메이션은 일반 선언보다 우선하고 both면 끝값이 계속 남는다. 자체 배경 .18을 가진
   요소에 .08로 끝나는 correctPop을 걸면 세션10-o가 세운 대비가 영구히 무너진다(실제로 한 번
   그렇게 넣었다가 잡아낸 결함). 끝값이 요소의 쉬는 배경과 일치하는지 짝을 맞춰 검사한다. */
const 정답끝값 = (키프레임) => {
  // [\s\S]*? 로 중간 키프레임 블록의 닫는 중괄호를 넘어간다([^}]*는 첫 }에서 멈춰 실패).
  // 이름 뒤 \{ 가 있어 correctPop 패턴이 correctPop18을 잘못 집지 않는다.
  const m = LLOVE_CSS.match(new RegExp('@keyframes ' + 키프레임 + '\\{[\\s\\S]*?100%\\{background:([^}]*)\\}'));
  return m && m[1].trim();
};
assert('correctPop은 .08로 끝난다(.aopt는 자체 배경이 없어 이게 쉬는 값)',
  정답끝값('correctPop') === 'rgba(120,184,120,.08)', 정답끝값('correctPop'));
assert('correctPop18은 .18로 끝난다(자체 배경 .18을 가진 요소용)',
  정답끝값('correctPop18') === 'rgba(120,184,120,.18)', 정답끝값('correctPop18'));
for (const sel of ['\\.syn-opt\\.correct', '\\.rc-opt\\.correct', '#sq7Opts \\.aopt\\.correct']) {
  const 규칙 = LLOVE_CSS.match(new RegExp(sel + '\\{([^}]*)\\}'));
  const 본문 = 규칙 ? 규칙[1] : '';
  assert(`${sel.replace(/\\/g, '')}: 배경 .18과 애니메이션 끝값이 어긋나지 않는다`,
    본문.includes('rgba(120,184,120,.18)') && 본문.includes('correctPop18'),
    본문.slice(0, 90));
}
assert('자체 배경 .18을 가진 선택자에 .08로 끝나는 correctPop이 걸려 있지 않다',
  !/(\.syn-opt|\.rc-opt|#sq7Opts \.aopt)\.correct\{[^}]*animation:correctPop\s/.test(LLOVE_CSS));

/* (b) prefers-reduced-motion 전역 폴백 — Llove·wchain 양쪽 다(별도 스타일시트라 각자 필요) */
assert('Llove style.css에 prefers-reduced-motion 폴백이 있다',
  LLOVE_CSS.includes('prefers-reduced-motion: reduce'));
assert('wchain index.html 인라인 스타일에도 prefers-reduced-motion 폴백이 있다',
  WCHAIN_HTML.includes('prefers-reduced-motion: reduce'));

/* (c) 터치 hover 게이팅 — :hover 이동이 포인터 정밀 기기에만 걸리는지.
   터치는 탭 시 :hover 가 눌러붙어 카드가 들린 채 남는다(모바일 사용이 주라 실제로 계속 보였음). */
const 게이트 = '@media (hover: hover) and (pointer: fine)';
assert('Llove style.css에 포인터 게이팅 블록이 있다', LLOVE_CSS.includes(게이트));
assert('wchain index.html에도 포인터 게이팅 블록이 있다', WCHAIN_HTML.includes(게이트));

// 게이팅 블록 밖에 :hover + transform 이 남아 있으면 실패(=터치에서 또 눌러붙는다)
const 게이팅밖 = (css) => {
  const 본체 = css.split(게이트)[0];
  return [...본체.matchAll(/([^\n{}]*:hover[^{]*)\{([^}]*transform[^}]*)\}/g)]
    .map(m => m[1].trim());
};
const 남은L = 게이팅밖(LLOVE_CSS), 남은W = 게이팅밖(WCHAIN_HTML);
assert('Llove: 게이팅 밖에 남은 hover 이동이 없다', 남은L.length === 0, 남은L.join(' / '));
assert('wchain: 게이팅 밖에 남은 hover 이동이 없다', 남은W.length === 0, 남은W.join(' / '));

// 색·테두리 피드백은 게이팅 밖에 남겨 둔다(터치에서도 눌린 느낌이 나야 함)
assert('색 피드백은 터치에서도 유지된다(.mc:hover 테두리)',
  /\.mc:hover\{[^}]*border-color/.test(LLOVE_CSS));
assert('그림자 피드백도 유지된다(.btn-acc:hover)',
  /\.btn-acc:hover\{[^}]*box-shadow/.test(LLOVE_CSS));

/* (d) transition:all 금지 — 의도 안 한 속성(padding·max-height·font-size 등)까지
   GPU 밖에서 애니메이션한다. 각 규칙이 실제로 바꾸는 속성만 나열해야 한다. */
for (const [이름, css] of [['Llove/style.css', LLOVE_CSS], ['wchain/index.html', WCHAIN_HTML]]) {
  const 잔여 = [...css.matchAll(/([^\n{}]*)\{[^}]*transition:\s*all/g)].map(m => m[1].trim().slice(0, 40));
  assert(`${이름}: transition:all 이 남아 있지 않다`, 잔여.length === 0, 잔여.join(' / '));
}
// 의도된 레이아웃 전환은 명시적으로 남아 있어야(아코디언·온보딩 점)
assert('아코디언(.lset-panel)의 max-height 전환은 명시로 유지',
  /\.lset-panel\{[^}]*transition:max-height/.test(LLOVE_CSS));
assert('온보딩 점(.ob-dot)의 알약 확장(width)은 명시로 유지',
  /\.ob-dot\{[^}]*transition:width/.test(LLOVE_CSS));

/* 사소한 정리 — 죽은 키프레임 제거, 낡은 주석 정정 */
assert('죽은 키프레임 scaleIn이 제거됨', !LLOVE_CSS.includes('@keyframes scaleIn'));
assert('낡은 "회전 완전 금지" 절대 문구가 애니메이션 섹션 주석에서 빠짐',
  !LLOVE_CSS.includes('애니메이션 (대각선·회전 금지)'));

/* (c)·(d)가 기대하는 CSS 재료가 wchain 쪽에 실제로 존재하는지(JS 동작 자체는 플레이 테스트에서 확인) */
assert('wchain 헤더 주석도 현재 규칙 문구로 정정됨',
  !WCHAIN_HTML.includes("그 외 전부 fadeUp만 사용"));
assert('wchain에 shakeLR 키프레임과 .hud-val.hit이 있다',
  WCHAIN_HTML.includes('@keyframes shakeLR') && WCHAIN_HTML.includes('.hud-val.hit'));

process.exit(finish() > 0 ? 1 : 0);

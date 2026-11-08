// 11-08 애니메이션·전환 점검 — CSS 텍스트 규칙(길이 3단·무한 반복 목록·동작 줄이기·레이아웃 속성)과
// 화면 전환·홈 EXP 막대의 JS 동작(jsdom). 실제 체감(곡선·속도)은 브라우저에서 확인한다.
const fs = require('fs');
const path = require('path');
const { load, makeHarness } = require('./load.cjs');

const css = fs.readFileSync(path.join(__dirname, '..', 'Llove', 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');  // 주석 제외
const 초 = t => t.endsWith('ms') ? parseFloat(t) / 1000 : parseFloat(t);

load((win) => {
  const { assert, finish } = makeHarness('애니메이션·전환 점검 테스트');
  const d = win.document, ev = s => win.eval(s);

  /* ── 전환 길이는 3단(.15/.25/.4)과 visibility 지연용 0s만 ── */
  const 전환시간 = [...css.matchAll(/transition:([^;}]*)/g)].flatMap(m => m[1].match(/\d*\.?\d+m?s\b/g) || []);
  const 벗어남 = 전환시간.filter(t => !['.15s', '.25s', '.4s', '0s'].includes(t));
  assert(`transition 길이 ${전환시간.length}개가 3단 값만 쓴다`, 전환시간.length > 50 && 벗어남.length === 0, 벗어남.join(' '));

  /* ── 무한 반복은 진행 중 표시(녹음·생성 대기)와 창조주·주신 장식만 ── */
  const 허용 = ['.spk-mic-btn.rec .spk-mic-ico', '.vc-dot', '.status-sub-title.creator', '.sub-jushin'];
  const 무한 = [...css.matchAll(/([^{}]+)\{[^}]*animation:[^;}]*infinite/g)].map(m => m[1].trim());
  const 밖 = 무한.filter(s => !허용.includes(s));
  assert('무한 애니메이션이 지정 목록 밖에 없다', 무한.length > 0 && 밖.length === 0, 밖.join(' / '));

  /* ── 한 번 도는 애니메이션은 .4s 이하(읽어야 하는 +EXP와 화면 진입만 예외) ── */
  const 긴것 = [...css.matchAll(/animation:\s*([A-Za-z0-9]+)\s+([\d.]+m?s)([^;}]*)/g)]
    .filter(m => !/infinite/.test(m[3]) && !['expFloat', 'slideIn'].includes(m[1]) && 초(m[2]) > 0.4)
    .map(m => m[1] + ' ' + m[2]);
  assert('일회성 애니메이션이 .4s를 넘지 않는다', 긴것.length === 0, 긴것.join(' / '));

  /* ── 키프레임은 레이아웃 속성(width·height·top·left·margin·padding)을 움직이지 않는다 ── */
  const 레이아웃 = [...css.matchAll(/@keyframes (\S+?)\{((?:[^{}]*\{[^}]*\})*)\s*\}/g)]
    .filter(m => /(^|[{;])\s*(width|height|top|left|right|bottom|margin|padding)\s*:/.test(m[2])).map(m => m[1]);
  assert('키프레임이 transform·opacity·색만 움직인다', 레이아웃.length === 0, 레이아웃.join(' '));

  /* ── 순차 등장 총 길이(.fu 길이 + 최대 지연) ── */
  const fu = css.match(/\.fu\{animation:fadeUp ([\d.]+)s/);
  const 최대지연 = Math.max(...[...css.matchAll(/\.s\d+\{animation-delay:([\d.]+)s\}/g)].map(m => +m[1]));
  assert('순차 등장 총합 .6s 이하', fu && +fu[1] + 최대지연 <= 0.6, `${fu && fu[1]} + ${최대지연}`);
  assert('긴 목록 지연 상한은 동작 줄이기가 아닐 때만', /@media \(prefers-reduced-motion: no-preference\)\{\s*\.ach-item:nth-child\(n\+11\)[^}]*animation-delay:\.4s !important/.test(css));
  assert('재방문 화면의 목록은 다시 재생하지 않는다', /\.revisit \.tree-line,\.revisit \.ach-item,\.revisit \.rv-item\{animation:none\}/.test(css));
  assert('현황 트리는 animation:none이어도 보인다(투명 시작값을 키프레임에만)', !/\.tree-line\{[^}]*opacity:0/.test(css));

  /* ── 동작 줄이기: 전역 폴백 + +EXP는 이동 없이 옅어지기만 ── */
  const 줄임 = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/);
  assert('동작 줄이기 블록이 길이·지연을 0으로', 줄임 && /transition-duration: 0\.01ms !important/.test(줄임[1]) && /animation-delay: 0s !important/.test(줄임[1]));
  assert('동작 줄이기에서 +EXP는 opacity만', 줄임 && /@keyframes expFloat\{[^}]*\{opacity:1\}100%\{opacity:0\}\}/.test(줄임[1]) && !/expFloat\{[^\n]*transform/.test(줄임[1]));

  /* ── 열기 .25s·닫기 .15s ── */
  assert('오버레이 닫힘 .15s·열림 .25s', /\.modal-bg\{visibility:hidden;transition:opacity \.15s,visibility 0s \.15s\}/.test(css) && /\.modal-bg\.show\{visibility:visible;transition:opacity \.25s\}/.test(css));
  assert('모달 상자 열림 .25s 감속', /\.modal-bg\.show \.modal-bx\{transform:scale\(1\);transition:transform \.25s var\(--ease-out\)\}/.test(css));
  assert('토스트 사라짐 .15s·등장 .25s', /\.toast\{[^}]*transition:opacity \.15s,transform \.15s var\(--ease-out\)/.test(css) && /\.toast\.show\{[^}]*transition:opacity \.25s,transform \.25s var\(--ease-out\)/.test(css));
  assert('보이지 않던 퇴장 연출(slideOut·.leaving) 제거', !css.includes('@keyframes slideOut') && !css.includes('.screen.leaving'));

  /* ── JS: 진입 연출은 표시와 같은 순간에(rAF 사이 한 프레임 깜빡임 없음), 재방문 표시 ── */
  ev("goNav('sh',null)");
  const sh = d.getElementById('sh');
  assert('진입 클래스가 표시와 동시에 붙는다', sh.classList.contains('active') && sh.classList.contains('entering'));
  assert('첫 방문엔 revisit 아님', !sh.classList.contains('revisit'));

  /* ── 홈 EXP 막대: 값이 그대로면 다시 0부터 채우지 않는다 ── */
  ev('표시EXP=()=>Math.floor(expForLevel(표시레벨())/2)');
  ev("goNav('ss',null)"); ev("goNav('sh',null)");
  assert('다시 온 홈은 revisit', sh.classList.contains('revisit'));
  const bar = d.getElementById('homeExp');
  setTimeout(() => {
    const 첫폭 = bar.style.width;
    assert('EXP 막대가 값만큼 채워진다', parseFloat(첫폭) > 0, 첫폭);
    ev("goNav('ss',null)"); ev("goNav('sh',null)");
    assert('같은 값이면 홈 재방문에 0으로 되돌리지 않는다', bar.style.width === 첫폭 && !bar.classList.contains('instant'), bar.style.width);
    ev('표시EXP=()=>1'); ev("goNav('ss',null)"); ev("goNav('sh',null)");
    assert('줄어들 땐(레벨업) 거꾸로 빠지는 연출 없이', bar.classList.contains('instant'));
    setTimeout(() => {
      assert('줄어든 값이 반영된다', parseFloat(bar.style.width) < parseFloat(첫폭), bar.style.width);
      process.exit(finish() > 0 ? 1 : 0);
    }, 120);
  }, 120);
});

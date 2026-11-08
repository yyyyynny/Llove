// 11-08 PC 레이아웃·접근성 — jsdom은 레이아웃을 계산하지 못하므로 미디어 쿼리 규칙의 존재와
// 모달 속성 부여·포커스 이동/복귀·토스트 알림 속성만 확인한다(실화면 배치는 브라우저에서 확인)
const fs = require('fs');
const path = require('path');
const { load, makeHarness } = require('./load.cjs');

const css = fs.readFileSync(path.join(__dirname, '..', 'Llove', 'style.css'), 'utf8');

load((win) => {
  const { assert, finish } = makeHarness('PC 레이아웃·접근성 테스트');
  const d = win.document;

  /* ── CSS: 1024px 이상 세로 레일·화면 기둥, 1440px 이상 4열, 줄인 동작에서 지연 0 ── */
  const pc = css.match(/@media \(min-width:1024px\)\{([\s\S]*?)\n\}/);
  assert('1024px 이상 미디어 쿼리가 있다', !!pc);
  assert('네비가 왼쪽 세로 레일(88px)로 바뀐다', pc && /#g-bnav\{[^}]*width:88px[^}]*flex-direction:column/.test(pc[1]));
  assert('네비 영역 화면은 레일 오른쪽에서 시작한다', pc && /\.has-bnav\{left:88px/.test(pc[1]));
  assert('홈 모드 카드 3열', pc && /\.hs\{grid-template-columns:repeat\(3,1fr\)\}/.test(pc[1]));
  assert('1440px 이상 홈 4열', /@media \(min-width:1440px\)\{\s*\.hs\{grid-template-columns:repeat\(4,1fr\)\}/.test(css));
  const 줄임 = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/);
  assert('동작 줄이기에서 등장 지연을 0으로', 줄임 && /animation-delay: 0s !important/.test(줄임[1]));
  assert('동작 줄이기에서 장식용 무한 애니메이션 정지', 줄임 && /\.sub-jushin \{ animation: none !important; \}/.test(줄임[1]));

  /* ── 모달: role·aria-modal·제목 연결 ── */
  const 상자들 = [...d.querySelectorAll('.ov-bg, .modal-bg, .obj-bg, .ach-detail-bg')].map(e => e.firstElementChild)
    .concat(d.getElementById('askPanel'));
  assert(`모달 상자 ${상자들.length}개 전부 role=dialog·aria-modal`,
    상자들.length >= 10 && 상자들.every(e => e.getAttribute('role') === 'dialog' && e.getAttribute('aria-modal') === 'true'));
  const 정보 = d.querySelector('#infoBg > .modal-bx');
  assert('안내 모달은 제목(#infoTitle)과 연결된다', 정보.getAttribute('aria-labelledby') === 'infoTitle');

  /* ── 토스트 알림 속성 ── */
  const 토스트 = d.getElementById('toast');
  assert('토스트는 role=status·aria-live=polite', 토스트.getAttribute('role') === 'status' && 토스트.getAttribute('aria-live') === 'polite');

  /* ── 포커스: 열면 상자로, 닫으면 연 단추로 ── */
  const 단추 = d.createElement('button');
  d.body.appendChild(단추);
  단추.focus();
  win.eval("showInfoModal('', '시험', '내용')");
  setTimeout(() => {
    assert('모달이 열리면 포커스가 상자 안으로 옮겨진다', 정보.contains(d.activeElement), d.activeElement && d.activeElement.className);
    win.eval('closeInfoModal()');
    setTimeout(() => {
      assert('모달이 닫히면 연 단추로 포커스가 돌아온다', d.activeElement === 단추, d.activeElement && d.activeElement.tagName);
      process.exit(finish() > 0 ? 1 : 0);
    }, 0);
  }, 0);
});

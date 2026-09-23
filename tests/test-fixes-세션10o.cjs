// 세션10-o — 부팅 복원 단계가 서로 독립인지 (깨진 localStorage 값 한 개가 뒤 단계를 죽이지 않는가)
//
// 감사에서 확인된 결함: 종전에는 15개 복원이 하나의 try 안에 묶여 있어서, plx_학습설정 값 하나만
// 깨져도 뒤에 오는 랜덤 설정·글자 범위·배너·AI 지침·채팅 기록·아바타·음성 주소 복원이 통째로
// 조용히 건너뛰어졌다(catch 주석이 "localStorage 차단 환경 무시"라 원인도 안 보였다).
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { makeHarness } = require('./load.cjs');

const ROOT = path.join(__dirname, '..', 'Llove');

// load.cjs 와 같은 인라인화를 쓰되, 부팅 **전에** 깨진 값을 심을 수 있어야 해서 따로 띄운다.
function 부팅(심을것, 콜백){
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="style.css">/,
    () => '<style>\n' + fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8') + '\n</style>');
  html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g,
    (_, 상대) => '<script>\n' + fs.readFileSync(path.join(ROOT, 상대), 'utf8') + '\n</script>');

  const 주입 = `
    window.fetch = function(){ return Promise.reject(new Error('no-net-in-test')); };
    function _fbProxy(){ return new Proxy(function(){ return _fbProxy(); }, { get: function(){ return _fbProxy(); }, apply: function(){ return _fbProxy(); } }); }
    window.firebase = _fbProxy();
    try{ ${심을것} }catch(e){}
  `;
  const dom = new JSDOM(html.replace('<body', `<script>${주입}</script>\n<body`),
    { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/' });
  setTimeout(() => 콜백(dom.window), 500);
}

const { assert, finish } = makeHarness('세션10-o 부팅 복원 단계 독립성 테스트');

// plx_학습설정을 깨진 JSON 으로 심고, **그 뒤에 오는** 단계들이 정상 복원되는지 본다.
부팅(`
  localStorage.setItem('plx_학습설정', '{이건깨진JSON');
  localStorage.setItem('plx_AI지침', '내지침보존확인');
  localStorage.setItem('plx_글자범위', '전체');
`, (win) => {
  const ev = (c) => win.eval(c);

  assert('깨진 학습설정을 심어도 앱이 부팅된다', typeof ev('사용자') === 'object');

  // ↓ 학습설정 복원 뒤에 오는 단계들 — 종전 구조에서는 전부 건너뛰어졌다
  assert('학습설정 뒤의 "AI 지침" 단계가 복원된다',
    ev('사용자.AI지침') === '내지침보존확인', String(ev('사용자.AI지침')));
  // set글자범위()는 전역 변수가 아니라 documentElement.dataset.글자범위에 쓴다
  assert('학습설정 뒤의 "글자 범위" 단계가 복원된다',
    win.document.documentElement.dataset.글자범위 === '전체',
    String(win.document.documentElement.dataset.글자범위));
  assert('학습설정 뒤의 "랜덤 설정" 단계가 살아 있다', ev('typeof 랜덤설정') === 'object');

  // 실패한 단계는 조용히 넘어가지 않고 표면화돼야 한다
  assert('복원단계 헬퍼가 존재한다(단계별 독립 보호)', ev('typeof 복원단계') === 'function');

  // 학습설정 자체는 기본값을 유지해야(깨진 값이 덮어쓰지 못함)
  assert('깨진 값이 학습설정을 오염시키지 않는다', ev('typeof 학습설정') === 'object');

  process.exit(finish() > 0 ? 1 : 0);
});

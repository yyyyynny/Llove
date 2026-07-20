// index.html을 외부 의존성(fetch/firebase) 스텁과 함께 jsdom으로 로드하는 공용 로더.
// 네트워크/Firebase 없이 UI 로직만 검증한다.
//
// 재구조화 대응: index.html은 이제 style.css + js/*.js 를 외부 참조한다.
// jsdom은 외부 파일을 로드하지 않으므로(그리고 <script type="module">은 실행 불가),
// 로더가 참조 태그를 실제 파일 내용으로 인라인 재주입해 단일 HTML처럼 실행한다.
// (js/*.js 는 전역 스코프를 공유하는 클래식 스크립트라 인라인 주입이 원본과 동일 의미)
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// 저장소 재편(2026-07-19): 앱 본체가 Llove/ 하위로 이동 (루트 index.html은 관문 리다이렉트)
const ROOT = path.join(__dirname, '..', 'Llove');
const HTML_PATH = path.join(ROOT, 'index.html');

// 분할된 외부 참조를 인라인으로 되돌린 HTML을 만든다 (테스트 전용)
function 인라인화(html) {
  // 1) style.css → <style> 인라인 (커스텀 테마·글자 배율 테스트가 CSS 변수를 참조)
  html = html.replace(/<link rel="stylesheet" href="style.css">/, () => {
    const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    return '<style>\n' + css + '\n</style>';
  });
  // 2) <script src="js/…"></script> → 파일 내용 인라인 (순서 보존)
  html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, 상대경로) => {
    const js = fs.readFileSync(path.join(ROOT, 상대경로), 'utf8');
    return '<script>\n' + js + '\n</script>';
  });
  return html;
}

function load(cb) {
  const html = 인라인화(fs.readFileSync(HTML_PATH, 'utf8'));
  const stub = `
    window.fetch = function(){ return Promise.reject(new Error('no-net-in-test')); };
    function _fbProxy(){ return new Proxy(function(){ return _fbProxy(); }, { get: function(){ return _fbProxy(); }, apply: function(){ return _fbProxy(); } }); }
    window.firebase = _fbProxy();
  `;
  const injected = html.replace('<body', `<script>${stub}</script>\n<body`);
  const dom = new JSDOM(injected, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/' });
  setTimeout(() => cb(dom.window), 500);
}

// 테스트 결과 수집 헬퍼
function makeHarness(title) {
  const results = [];
  return {
    assert: (n, c, d) => results.push({ n, c: !!c, d: d || '' }),
    finish: () => {
      let fail = 0;
      console.log(`\n=== ${title} ===`);
      for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  (' + r.d + ')' : ''}`); if (!r.c) fail++; }
      console.log(`총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
      return fail;
    }
  };
}

module.exports = { load, makeHarness };

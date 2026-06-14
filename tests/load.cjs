// index.html을 외부 의존성(fetch/firebase) 스텁과 함께 jsdom으로 로드하는 공용 로더.
// 네트워크/Firebase 없이 인라인 스크립트를 실행해 UI 로직만 검증한다.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML_PATH = path.join(__dirname, '..', 'index.html');

function load(cb) {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
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

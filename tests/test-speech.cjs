// 항목8: 음성 입력(Web Speech API) 동작 검증
const { load } = require('./load.cjs');
load((window) => {
  const results = [];
  const assert = (n, c, d) => results.push({ n, c: !!c, d: d || '' });
  const doc = window.document;
  const ev = (code) => window.eval(code);

  // 1) UI 요소 존재 (미구현 자리표시 제거되고 실제 음성 UI 렌더)
  assert('마이크 버튼 존재', !!doc.getElementById('spkMicBtn'));
  assert('음성 인식 결과 영역 존재', !!doc.getElementById('spkVoiceTranscript'));
  assert('구(舊) 미구현 자리표시 제거됨', !doc.querySelector('#spkVoiceArea .spk-not-impl'));

  // 2) 미지원 브라우저 안내 (SpeechRecognition 미정의 상태)
  ev("delete window.SpeechRecognition; delete window.webkitSpeechRecognition; switchSpkMode('voice');");
  assert('미지원 시 안내 문구 노출', /지원하지 않습니다/.test(doc.getElementById('spkVoiceStatus').textContent));
  assert('미지원 시 마이크 버튼 비활성', doc.getElementById('spkMicBtn').disabled === true);

  // 3) 지원 브라우저 시뮬레이션 — 가짜 SpeechRecognition 주입
  ev(`
    window.__lastSR = null;
    window.webkitSpeechRecognition = function(){
      window.__lastSR = this;
      this.start = function(){ if(this.onstart) this.onstart(); };
      this.stop = function(){ if(this.onend) this.onend(); };
    };
    document.getElementById('spkMicBtn').disabled = false;
    switchSpkMode('voice');
  `);
  assert('지원 시 마이크 버튼 활성', doc.getElementById('spkMicBtn').disabled === false);

  // 토글 → 인식 시작 → 최종 결과 emit
  ev("음성인식_토글();");
  assert('인식 시작(녹음) 상태', ev("음성인식중") === true);
  ev(`
    var sr = window.__lastSR;
    sr.onresult({ resultIndex:0, results:[ Object.assign(['안녕하세요'].map(function(t){return {transcript:t};})[0] ? [{transcript:'반갑습니다'}] : [], { 0:{transcript:'반갑습니다'}, isFinal:true, length:1 }) ] });
  `);
  assert('최종 인식 텍스트가 spkInput에 반영', doc.getElementById('spkInput').value.includes('반갑습니다'), `value=${doc.getElementById('spkInput').value}`);
  assert('결과 영역에 텍스트 표시', /반갑습니다/.test(doc.getElementById('spkVoiceTranscript').textContent));

  // 종료
  ev("음성인식_중지();");
  assert('인식 종료 상태', ev("음성인식중") === false);

  let fail = 0;
  console.log('\n=== 항목8 음성 입력 테스트 ===');
  for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  ('+r.d+')' : ''}`); if (!r.c) fail++; }
  console.log(`\n총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
  process.exit(fail > 0 ? 1 : 0);
});

// Phase 7: Llove 사전(뜻풀이) 기능 검증
// - 봉인(국어원_활성화=false) 시 네트워크 호출 차단 / 질문하기 패널의 AI·사전 모드 전환 /
//   사전 모드 전송 시 .ask-msg.dict 버블 + CC BY-SA 출처 문구 렌더링을 jsdom으로 확인한다.
const { load } = require('./load.cjs');
load(async (window) => {
  const results = [];
  const assert = (n, c, d) => results.push({ n, c: !!c, d: d || '' });
  const doc = window.document;
  const ev = (code) => window.eval(code);

  // 1) 봉인 상태: 사전_단어조회가 fetch 없이 null 반환 (호출 자체 차단)
  ev("window.__fetchN = 0; window.fetch = function(){ window.__fetchN++; return Promise.reject(new Error('no-net')); };");
  assert('봉인 플래그 false', ev("국어원_활성화") === false);
  const 봉인결과 = await ev("사전_단어조회('사과')");
  assert('봉인 시 null 반환', 봉인결과 === null);
  assert('봉인 시 fetch 미호출', ev("window.__fetchN") === 0, `fetchN=${ev("window.__fetchN")}`);

  // 2) 질문하기 패널 모드 탭 — 기본 AI, 전환 시 UI·placeholder·상태 변수 동기화
  ev("openAsk();");
  assert('패널 열 때 기본 AI 모드', ev("사전모드") === false);
  assert('AI 탭 활성 표시', doc.getElementById('askTabAI').classList.contains('on'));
  assert('사전 탭 비활성 표시', !doc.getElementById('askTabDict').classList.contains('on'));
  ev("질문모드_전환('dict');");
  assert('사전 모드 전환 — 상태 변수', ev("사전모드") === true);
  assert('사전 탭 활성 표시', doc.getElementById('askTabDict').classList.contains('on'));
  assert('AI 탭 비활성 표시', !doc.getElementById('askTabAI').classList.contains('on'));
  assert('입력창 placeholder 변경', doc.getElementById('askInp').placeholder.includes('뜻'));

  // 3) 사전 모드 전송 — 게이트 off이므로 "준비 중" 안내, AI 챗과 다른 .ask-msg.dict 버블 사용
  doc.getElementById('askInp').value = '사과';
  await ev("sendAsk()");
  const bubbles = doc.querySelectorAll('#askBody .ask-msg.dict');
  assert('사전 모드 전송 → .ask-msg.dict 버블 생성', bubbles.length > 0, `개수=${bubbles.length}`);
  const 마지막버블 = bubbles[bubbles.length - 1];
  assert('게이트 off 안내 문구 포함', 마지막버블.innerHTML.includes('준비 중'));
  assert('AI 챗 버블(.ask-msg.ai)은 새로 생기지 않음(사전 모드가 AI 흐름을 안 탐)',
    doc.querySelectorAll('#askBody .ask-msg.ai').length === 1);  // 초기 인사말 1개만 유지

  // 4) 렌더링 함수 자체를 단위 테스트 — 국어원_활성화는 const라 jsdom에서 켤 수 없으므로
  //    (Grok/음성생성 게이트와 동일한 의도된 설계 — test-voice.cjs도 off 경로만 검증)
  //    게이트와 분리된 순수 렌더링 함수 사전결과_HTML()을 직접 호출해 성공 경로를 검증한다.
  const 성공HTML = ev("사전결과_HTML({ 뜻풀이: ['사과: 사과나무의 열매.'], 사전: 'opendict' })");
  assert('조회 성공 시 뜻풀이 렌더링', 성공HTML.includes('사과나무의 열매'));
  assert('조회 성공 시 CC BY-SA 출처 문구 렌더링', 성공HTML.includes('CC BY-SA 2.0 KR'));
  assert('출처 문구에 국립국어원 명시', 성공HTML.includes('국립국어원'));
  const 실패HTML = ev("사전결과_HTML(null)");
  assert('조회 실패(null) 시 안내 문구', 실패HTML.includes('찾을 수 없는'));

  // 5) 사전 모드 전송은 토큰을 전혀 소모하지 않는다(AI 챗 전용 로직과 완전 분리 확인)
  const 토큰전 = ev("사용자.보유토큰");
  doc.getElementById('askInp').value = '바나나';
  await ev("sendAsk()");
  assert('사전 모드는 토큰 미차감', ev("사용자.보유토큰") === 토큰전, `전=${토큰전} 후=${ev("사용자.보유토큰")}`);

  // 6) 패널을 다시 열면 AI 모드로 리셋(사전 모드가 남지 않음)
  ev("closeAsk(); openAsk();");
  assert('재오픈 시 AI 모드로 리셋', ev("사전모드") === false);

  let fail = 0;
  console.log('\n=== Phase 7 사전(뜻풀이) 기능 테스트 ===');
  for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  ('+r.d+')' : ''}`); if (!r.c) fail++; }
  console.log(`\n총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
  process.exit(fail > 0 ? 1 : 0);
});

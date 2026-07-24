// Phase 7: Llove 사전(뜻풀이) 기능 검증 (게이트 활성화 이후 — 2026-07-24 갱신)
// - 국어원_활성화=true 전환 후: fetch를 모킹해 실제 네트워크 없이 성공/실패 경로를 결정론적으로
//   검증한다(실제 Worker·opendict 호출은 실브라우저 E2E에서 별도 확인).
// - 질문하기 패널의 AI·사전 모드 전환, 사전 모드 전송 시 .ask-msg.dict 버블 + CC BY-SA 출처 문구
//   렌더링, 사전 모드가 토큰/AI 로직과 완전히 분리돼 있는지를 jsdom으로 확인한다.
const { load } = require('./load.cjs');
load(async (window) => {
  const results = [];
  const assert = (n, c, d) => results.push({ n, c: !!c, d: d || '' });
  const doc = window.document;
  const ev = (code) => window.eval(code);

  assert('게이트 활성화됨(국어원_활성화 === true)', ev("국어원_활성화") === true);
  assert('Worker 엔드포인트 설정됨(빈 문자열 아님)', ev("국어원_WORKERS_ENDPOINT").length > 0);

  // 1) 조회 성공 경로 — fetch를 모킹해 실제 Worker 응답 형태({존재,뜻풀이,사전})를 흉내낸다
  ev(`
    window.__fetchCalls = [];
    window.fetch = function(url, opts){
      window.__fetchCalls.push({ url, opts });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 존재: true, 뜻풀이: ['사물의 관련이나 일의 결과가 반드시 그렇게 될 수밖에 없음.'], 사전: 'opendict' })
      });
    };
  `);
  const 성공결과 = await ev("사전_단어조회('필연')");
  assert('조회 성공 시 뜻풀이 배열 반환', 성공결과 && Array.isArray(성공결과.뜻풀이) && 성공결과.뜻풀이.length === 1);
  assert('조회 성공 시 사전 출처 필드 반환', 성공결과 && 성공결과.사전 === 'opendict');
  assert('설정된 Worker 엔드포인트로 요청함', ev("window.__fetchCalls[0].url") === ev("국어원_WORKERS_ENDPOINT"));
  assert('요청 본문에 단어가 실림', ev("window.__fetchCalls[0].opts.body").includes('필연'));

  // 2) 조회 실패(네트워크 오류) 경로 — 안전 강등(null 반환), 앱 크래시 없음
  ev("window.fetch = function(){ return Promise.reject(new Error('network down')); };");
  const 실패결과 = await ev("사전_단어조회('테스트오류단어')");
  assert('네트워크 실패 시 null로 안전 강등', 실패결과 === null);

  // 3) 질문하기 패널 모드 탭 — 기본 AI, 전환 시 UI·placeholder·상태 변수 동기화
  ev("openAsk();");
  assert('패널 열 때 기본 AI 모드', ev("사전모드") === false);
  assert('AI 탭 활성 표시', doc.getElementById('askTabAI').classList.contains('on'));
  assert('사전 탭 비활성 표시', !doc.getElementById('askTabDict').classList.contains('on'));
  ev("질문모드_전환('dict');");
  assert('사전 모드 전환 — 상태 변수', ev("사전모드") === true);
  assert('사전 탭 활성 표시', doc.getElementById('askTabDict').classList.contains('on'));
  assert('AI 탭 비활성 표시', !doc.getElementById('askTabAI').classList.contains('on'));
  assert('입력창 placeholder 변경', doc.getElementById('askInp').placeholder.includes('뜻'));

  // 4) 사전 모드 전송(성공 경로) — 실제 화면 흐름(sendAsk→sendAsk_사전)으로 .ask-msg.dict 버블 +
  //    CC BY-SA 출처 문구까지 끝까지 렌더링되는지 확인
  ev(`
    window.fetch = function(){
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 존재: true, 뜻풀이: ['사과나무의 열매.'], 사전: 'opendict' })
      });
    };
  `);
  doc.getElementById('askInp').value = '사과';
  ev("sendAsk()");
  await new Promise(r => setTimeout(r, 30));  // sendAsk()는 async가 아니라 내부 await를 안 기다림 — 완료까지 대기
  const bubbles = doc.querySelectorAll('#askBody .ask-msg.dict');
  assert('사전 모드 전송 → .ask-msg.dict 버블 생성', bubbles.length > 0, `개수=${bubbles.length}`);
  const 성공버블 = bubbles[bubbles.length - 1];
  assert('뜻풀이 텍스트 렌더링', 성공버블.innerHTML.includes('사과나무의 열매'));
  assert('CC BY-SA 출처 문구 렌더링', 성공버블.innerHTML.includes('CC BY-SA 2.0 KR'));
  assert('AI 챗 버블(.ask-msg.ai)은 새로 생기지 않음(사전 모드가 AI 흐름을 안 탐)',
    doc.querySelectorAll('#askBody .ask-msg.ai').length === 1);  // 초기 인사말 1개만 유지

  // 5) 사전 모드 전송(실패 경로) — 네트워크 오류여도 "찾을 수 없는 단어" 안내로 안전 처리
  ev("window.fetch = function(){ return Promise.reject(new Error('network down')); };");
  doc.getElementById('askInp').value = '존재하지않는단어';
  ev("sendAsk()");
  await new Promise(r => setTimeout(r, 30));
  const 실패버블들 = doc.querySelectorAll('#askBody .ask-msg.dict');
  const 실패버블 = 실패버블들[실패버블들.length - 1];
  assert('네트워크 실패 시 "찾을 수 없는" 안내 렌더링', 실패버블.innerHTML.includes('찾을 수 없는'));

  // 6) 렌더링 함수 자체 단위 테스트(게이트·네트워크와 완전히 분리된 순수 함수)
  const 성공HTML = ev("사전결과_HTML({ 뜻풀이: ['사과: 사과나무의 열매.'], 사전: 'opendict' })");
  assert('사전결과_HTML: 뜻풀이 렌더링', 성공HTML.includes('사과나무의 열매'));
  assert('사전결과_HTML: CC BY-SA 출처 문구', 성공HTML.includes('CC BY-SA 2.0 KR'));
  assert('사전결과_HTML: 국립국어원 명시', 성공HTML.includes('국립국어원'));
  const 실패HTML = ev("사전결과_HTML(null)");
  assert('사전결과_HTML: 실패(null) 시 안내 문구', 실패HTML.includes('찾을 수 없는'));

  // 7) 사전 모드 전송은 토큰을 전혀 소모하지 않는다(AI 챗 전용 로직과 완전 분리 확인)
  ev(`
    window.fetch = function(){
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ 존재: false, 뜻풀이: [], 사전: 'opendict' }) });
    };
  `);
  const 토큰전 = ev("사용자.보유토큰");
  doc.getElementById('askInp').value = '바나나';
  ev("sendAsk()");
  await new Promise(r => setTimeout(r, 30));
  assert('사전 모드는 토큰 미차감', ev("사용자.보유토큰") === 토큰전, `전=${토큰전} 후=${ev("사용자.보유토큰")}`);

  // 8) 패널을 다시 열면 AI 모드로 리셋(사전 모드가 남지 않음)
  ev("closeAsk(); openAsk();");
  assert('재오픈 시 AI 모드로 리셋', ev("사전모드") === false);

  let fail = 0;
  console.log('\n=== Phase 7 사전(뜻풀이) 기능 테스트 (게이트 활성화) ===');
  for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  ('+r.d+')' : ''}`); if (!r.c) fail++; }
  console.log(`\n총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
  process.exit(fail > 0 ? 1 : 0);
});

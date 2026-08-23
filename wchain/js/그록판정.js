// '잇는' — 그록(xAI) 기반 단어 적절성 검증 (봉인 골격, 2026-08-22)
// Llove의 Grok 게이트(js/grok.js의 GROK_활성화)와 동일한 봉인 패턴이지만, 완전히 독립된
// 변수다(별도 <script> 스코프 — wchain은 Llove와 다른 화면). Llove 쪽을 승인 없이 켜지 말라는
// 규칙과 마찬가지로, 이 플래그도 최고 관리자님 승인 없이 true로 바꾸지 않는다.
//
// 역할: wchain/worker/우리말샘-worker.mjs(사전 존재 확인, "뜻 보기" 버튼이 씀)와는 다른 질문에
// 답한다 — "사전엔 있지만, 지금 이 판에서 쓰기엔 부당한 단어인가?"(희귀 전문용어·옛말·지명·
// 인명류 등, 후보 필터가 못 거른 경계 케이스). 자세한 배경은
// wchain/worker/단어적절성판정-README.md 참조.
//
// 클래식 스크립트, 국어원.js 뒤·서바이벌.js 앞에 로드(서바이벌.js의 버튼_적절성검증()이 씀).

// ⚠️ 적절성 검증 게이트 — 최고 관리자님 승인 없이 true로 변경 금지. xAI 크레딧 미구매 +
//    wchain/worker/단어적절성판정-worker.mjs 미배포 상태라 실호출 전면 봉인. false인 동안
//    적절성_검증()은 fetch 자체를 하지 않는다.
const 적절성검증_활성화 = false;

// wchain/worker/단어적절성판정-worker.mjs 배포 주소. 아직 미배포라 비어 있다 — 관리자님이
// Cloudflare에 배포한 뒤 이 값을 채울 것(wrangler.단어적절성판정.toml.example의 name 기준
// 예: 'https://itneun-word-appropriateness.<계정 서브도메인>.workers.dev/').
const 적절성검증_WORKERS_ENDPOINT = '';

// 단어 하나의 적절성을 그록에게 물어본다. 게이트 off·엔드포인트 미설정·오프라인·호출 실패는
// 전부 null을 반환해 호출부(서바이벌.js의 버튼_적절성검증)가 "검증 불가" 안내로 강등되게 한다.
async function 적절성_검증(word, 맥락){
  if(!적절성검증_활성화){
    console.warn('[적절성검증] 게이트 봉인(적절성검증_활성화=false) — 호출 차단');
    return null;
  }
  if(!적절성검증_WORKERS_ENDPOINT){
    console.error('[적절성검증] Workers 엔드포인트 미설정 — 호출 불가');
    return null;
  }
  // 국어원 조회와 동일한 이유(사전.js 참조)로 넉넉히 잡는다 — Grok 응답은 사전 조회보다도
  // 느릴 수 있다.
  const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const 타임아웃ID = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try{
    const res = await fetch(적절성검증_WORKERS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 단어: word, 맥락: 맥락 || '' }),
      ...(controller ? { signal: controller.signal } : {})
    });
    if(타임아웃ID) clearTimeout(타임아웃ID);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();   // { 적절: true|false, 이유: "..." }
    return { 적절: data.적절 !== false, 이유: String(data.이유 || '') };
  }catch(e){
    if(타임아웃ID) clearTimeout(타임아웃ID);
    console.error('[적절성검증] 호출 실패', e);
    return null;
  }
}

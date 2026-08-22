// '잇는' — 그록(xAI Grok) 단어 적절성 판정 Worker (봉인 골격, 2026-08-22)
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────────
// wchain/worker/우리말샘-worker.mjs는 "단어가 사전에 존재하는가"만 답한다. 국립국어원
// 우리말샘은 학예사가 반복 검수해서 올리는 데이터라 이 존재 여부 판정 자체는 신뢰할 만하다
// — 그래서 "이의있음" 버튼이 잡아낼 수 있는 진짜 오류(사전에 없는 단어를 AI가 냄)는 흔치 않다.
//
// 이 Worker는 그 자리를 대신하는 게 아니라 **다른 질문에 답한다**:
//   "사전엔 있지만, 지금 이 끝말잇기 판에서 쓰기엔 부당하다고 느껴지는 단어인가?"
// (예: 극히 희귀한 전문용어, 옛말, 지명·인명류 — 후보 필터가 걸러내는 유형과 겹치되,
//  필터가 못 거른 애매한 경계 케이스를 사람 대신 판단해 준다.) 즉 존재 검증(뜻 보기 버튼,
//  우리말샘 Worker)과 역할이 겹치지 않는다 — 하나는 사실 확인, 하나는 맥락 판단.
//
// ── 게이트 정책 ──────────────────────────────────────────────────────────
// 이 Worker 자체엔 on/off 플래그가 없다(우리말샘 Worker와 동일 원칙 — Worker는 상태 없는
// 프록시일 뿐). 실호출 여부는 클라이언트(wchain/js, 아직 미작성)의 독립 플래그가 결정한다.
// Llove의 GROK_활성화(js/grok.js)와는 별개의 변수를 wchain 쪽에 새로 두고, 기본값 false·
// 최고 관리자님 승인 없이 true 금지 정책을 동일하게 적용할 것 — 지금 이 Worker를 배포해도
// xAI 크레딧이 없으므로 실호출 시 502로 떨어진다(정상 — 크레딧 확보 전까지는 그래야 한다).
//
// ── 계약 ────────────────────────────────────────────────────────────────
//   요청  POST { 단어: "가마솥", 맥락: "가"→"가마솥" 식 직전 글자 or 빈 문자열 }
//   응답  { 적절: true|false, 이유: "한 줄 설명" }
//   실패 시 4xx/5xx만 반환 — 클라이언트는 res.ok 아니면 null로 강등해 안전망(우리말샘 존재
//   검증만으로 판정)을 탄다. 이 Worker가 죽어도 게임이 멈추면 안 된다.
//
// 인증키: Cloudflare 대시보드 Worker 설정 > Variables and Secrets에 XAI_API_KEY 등록 필요
// (아직 미등록 — 크레딧 구매 후 `npx wrangler secret put XAI_API_KEY` 또는 대시보드에서).
// (CLAUDE.md 원칙: "API 키는 Cloudflare Workers만, 프론트 노출 금지" — 이 파일에 키를 직접 적지 말 것.)

const XAI_API_주소 = 'https://api.x.ai/v1/chat/completions';
// ⚠️ 모델명은 배포 시점 xAI 라인업 확인 후 관리자님이 조정 — 2026-08-22 기준 표기.
const 그록_모델 = 'grok-4-fast';
// 존재 확인이 아니라 맥락 판단이라 정교함이 필요 — Llove 쪽 GROK_리즈닝레벨.이의있음(high)과
// 같은 근거(js/grok.js 참조). 판정 성격상 낮은 reasoning으로는 애매한 경계 케이스를 못 잡는다.
const 리즈닝_레벨 = 'high';

// ── CORS (우리말샘 Worker와 동일 원칙 — 같은 origin만 허용) ────────────────
const 허용_ORIGIN = new Set([
  'https://yyyyynny.github.io',
]);

function cors헤더(origin){
  const 허용됨 = 허용_ORIGIN.has(origin);
  return {
    'Access-Control-Allow-Origin': 허용됨 ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json응답(본문, status, origin){
  return new Response(JSON.stringify(본문), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors헤더(origin) },
  });
}

// ── 그록 판정 ───────────────────────────────────────────────────────────
// 사전 존재 여부가 아니라 "게임 맥락에서 온당한가"를 묻는다. JSON 강제를 위해
// response_format을 쓰되, 모델이 이를 무시할 가능성을 대비해 파싱 실패 시 안전하게
// { 적절: true }(판정 불가 시 AI 편을 들지 않고 그냥 통과 — 오탐으로 게임 흐름을 막지 않는다)로 폴백한다.
async function 단어_적절성_판정(env, 단어, 맥락){
  const 시스템프롬프트 =
    `너는 한국어 끝말잇기 게임의 공정성 심판이다. 사전에 존재하는 단어라도, 지나치게 희귀한 ` +
    `전문용어·옛말·지명·인명류처럼 일반 플레이어가 "부당하다"고 느낄 만한 단어인지 판단한다. ` +
    `애매하면 관대하게(적절:true) 판정한다 — 확실히 부당할 때만 false. ` +
    `반드시 JSON만 출력: {"적절": true|false, "이유": "한 줄, 한국어"}`;
  const res = await fetch(XAI_API_주소, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 그록_모델,
      reasoning_effort: 리즈닝_레벨,
      messages: [
        { role: 'system', content: 시스템프롬프트 },
        { role: 'user', content: `단어: "${단어}"${맥락 ? ` (직전 맥락: ${맥락})` : ''}` },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if(!res.ok) throw new Error('xAI HTTP ' + res.status);
  const data = await res.json();
  const 원문 = data?.choices?.[0]?.message?.content || '';
  try{
    const 파싱 = JSON.parse(원문);
    return { 적절: 파싱.적절 !== false, 이유: String(파싱.이유 || '') };
  }catch(e){
    // 모델이 JSON을 안 지켰을 때 — 판정 불가로 게임을 막지 않고 통과시킨다.
    return { 적절: true, 이유: '' };
  }
}

// ── 진입점 ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env){
    const origin = request.headers.get('Origin') || '';
    if(request.method === 'OPTIONS'){
      return new Response(null, { status: 204, headers: cors헤더(origin) });
    }
    if(!허용_ORIGIN.has(origin)){
      return json응답({ error: '허용되지 않은 origin' }, 403, origin);
    }
    if(request.method !== 'POST'){
      return json응답({ error: 'POST만 허용됩니다.' }, 405, origin);
    }
    if(!env.XAI_API_KEY){
      return json응답({ error: '서버 설정 오류: XAI_API_KEY 필요합니다.' }, 500, origin);
    }
    let payload;
    try{ payload = await request.json(); }
    catch(e){ return json응답({ error: '잘못된 JSON' }, 400, origin); }

    if(!payload || typeof payload.단어 !== 'string' || !payload.단어.trim()){
      return json응답({ error: '요청 형식이 올바르지 않습니다(단어 필요).' }, 400, origin);
    }
    try{
      const 결과 = await 단어_적절성_판정(env, payload.단어.trim(), payload.맥락 || '');
      return json응답(결과, 200, origin);
    }catch(e){
      return json응답({ error: 'xAI 호출 실패' }, 502, origin);
    }
  },
};

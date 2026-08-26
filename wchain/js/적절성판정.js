// '잇는' — 단어 적절성 검증 (봉인 골격, 2026-08-22 재작성)
// Llove의 Grok 게이트(js/grok.js의 GROK_활성화)와 동일한 봉인 패턴이지만, 완전히 독립된
// 변수다(별도 <script> 스코프 — wchain은 Llove와 다른 화면). Llove 쪽을 승인 없이 켜지 말라는
// 규칙과 마찬가지로, 이 플래그도 최고 관리자님 승인 없이 true로 바꾸지 않는다.
//
// ⚠️ 파일명이 종전 '그록판정.js'가 아닌 이유: 어떤 AI사를 쓸지 아직 미확정이라(2026-08-22
// 조사에서 후보가 계속 뒤집혔다 — grok-4-fast 단종, Gemini 2.5 셧다운 예정 등), 이름을
// 구현 수단이 아니라 기능에 맞춘다. Worker(단어적절성판정-worker.mjs)도 같은 이유로 이미
// 이름을 바꿨는데 이 파일만 옛 이름이 남아 있었다.
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

// 자유 텍스트 상한 — 프롬프트 인젝션 페이로드 크기를 줄이는 1차 방어다.
// ⚠️ 이것만으로 인젝션을 막을 수는 없다. 진짜 방어선은 "코드가 강제하는 경계"
//    (단어당 반박 1회 · 이의 예산 5회)이고, 그 한계는 Worker 파일 상단에 기록했다.
//    서버(Worker)도 같은 값으로 한 번 더 자른다 — 클라이언트 제한만 믿지 않는다.
const 반박보충_최대길이 = 100;

// 공통 POST — 게이트 off·엔드포인트 미설정·오프라인·호출 실패는 전부 null을 반환해
// 호출부(서바이벌.js)가 "검증 불가" 안내로 강등되게 한다(국어원.js와 같은 관례).
async function 적절성_POST(본문){
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
      body: JSON.stringify(본문),
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

// 1차 판정 — AI가 낸 단어가 이 판에서 쓰기에 온당한지 묻는다.
async function 적절성_검증(word, 맥락){
  return 적절성_POST({ 단어: word, 맥락: 맥락 || '' });
}

// 2차 교차검증 — 1차가 "적절"로 나왔을 때 사용자가 반박하면, **다른 제공사 모델**이
// 단발로 재판정한다(같은 대화를 이어가지 않는 게 핵심 — 압박이 쌓이지 않는다).
// 사유코드는 Worker의 반박사유표와 1:1로 맞춰야 한다(안 맞으면 Worker가 400).
const 반박_사유목록 = [
  { 코드: '희귀전문어', 라벨: '너무 희귀한 전문용어' },
  { 코드: '옛말',       라벨: '옛말이라 안 쓴다' },
  { 코드: '고유명사',   라벨: '지명·인명이다' },
  { 코드: '방언',       라벨: '방언이라 표준어가 아니다' },
  { 코드: '기타',       라벨: '기타(직접 입력)' },
];

async function 적절성_반박(word, 맥락, 사유코드, 보충){
  return 적절성_POST({
    단어: word,
    맥락: 맥락 || '',
    반박사유: 사유코드,
    반박보충: String(보충 || '').slice(0, 반박보충_최대길이),
  });
}

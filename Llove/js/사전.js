/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   국립국어원(우리말샘·표준국어대사전) 뜻풀이 조회 — Phase 7
   ─────────────────────────────────────────────
   Grok 게이트(GROK_활성화)와 동일한 봉인 패턴: Cloudflare Worker 프록시가 인증키를 보관하고,
   프론트·레포엔 키를 절대 두지 않는다(국립국어원 오픈API는 브라우저 직접 호출 시 CORS·키노출
   문제로 막힘). wchain/js/국어원.js와 이름은 같지만 서로 다른 앱(별도 <script> 스코프)의
   독립 상수라 무관하다 — wchain은 존재 여부(true/false)만 확인하지만, 여기서는 화면에 뜻풀이
   원문을 그대로 노출하므로 우리말샘·표준국어대사전의 CC BY-SA 2.0 KR 저작자 표시 의무가
   명확히 적용된다(js/채팅.js의 사전 모드 응답마다 출처 문구를 함께 렌더링).

   ⚠️ 국어원 게이트 — 최고 관리자님 승인 없이 true로 변경 금지. Cloudflare Worker 배포 + 인증키
      등록 전까지 실호출 전면 봉인. false인 동안 사전_단어조회()는 fetch 자체를 하지 않는다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const 국어원_활성화 = true;

// Cloudflare Workers 엔드포인트(국립국어원 API 프록시). wchain/js/국어원.js와 같은 Worker를
// 재사용할 수 있도록 설계(Worker 응답에 존재 여부·뜻풀이를 함께 담아 반환하면 wchain은 존재
// 여부만, Llove는 뜻풀이까지 사용). 관리자님이 Worker 배포 후 이 값을 채울 것.
const 국어원_WORKERS_ENDPOINT = 'https://urimalsaem-llove.hypoqwer.workers.dev/';

// Worker 응답을 뜻풀이그룹(동음이의어별 배열) 형태로 정규화한다. 2026-08-19 계약 확장 —
// 새 Worker는 { 존재, 뜻풀이그룹 }를 주지만, 아직 옛 Worker가 배포돼 있거나(뜻풀이그룹 필드
// 없음) 테스트가 구 계약({ 뜻풀이: [...] } 평면 배열)을 흉내 낼 수 있어 둘 다 받아들인다.
function 뜻풀이그룹_정규화(data){
  if(!data) return [];
  if(Array.isArray(data.뜻풀이그룹) && data.뜻풀이그룹.length) return data.뜻풀이그룹;
  if(Array.isArray(data.뜻풀이) && data.뜻풀이.length) return [{ 번호: 1, 뜻풀이: data.뜻풀이 }];
  return [];
}

const 사전_캐시_KEY = 'plx_사전캐시';
function 사전_캐시_로드(){
  try{ return JSON.parse(localStorage.getItem(사전_캐시_KEY) || '{}'); }
  catch(e){ return {}; }
}
function 사전_캐시_저장(캐시){
  try{ localStorage.setItem(사전_캐시_KEY, JSON.stringify(캐시)); }
  catch(e){ /* 용량 초과 등 무시 — 캐시는 있으면 좋고 없어도 그만 */ }
}

// 단어의 뜻풀이 온라인 조회. 게이트 off·엔드포인트 미설정·오프라인·호출 실패·사전에 없는 단어는
// 전부 null을 반환해 호출부(js/채팅.js)가 "찾을 수 없음" 안내로 자동 강등되게 한다.
async function 사전_단어조회(word){
  if(!국어원_활성화){
    console.warn('[사전] 게이트 봉인(국어원_활성화=false) — 호출 차단');
    return null;
  }
  if(!국어원_WORKERS_ENDPOINT){
    console.error('[사전] Workers 엔드포인트 미설정 — 호출 불가');
    return null;
  }
  const 캐시 = 사전_캐시_로드();
  if(Object.prototype.hasOwnProperty.call(캐시, word)) return 캐시[word];
  // ⚠️ 타임아웃 2초 → 8초로 상향(2026-08-22). Worker의 동음이의어 그룹화(순우리말이면 opendict
  // view API 추가 호출까지 포함)는 실측상 수 초가 걸릴 수 있다(wchain 쪽 국어원.js가 같은
  // 이유로 8초를 쓰는 것과 동일 근거 — 실측 기록 그쪽 참조). 2초로는 응답이 오기도 전에
  // 매번 "찾을 수 없음"으로 강등됐을 가능성이 크다.
  const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const 타임아웃ID = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try{
    const res = await fetch(국어원_WORKERS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 단어: word, 뜻풀이: true }),
      ...(controller ? { signal: controller.signal } : {})
    });
    if(타임아웃ID) clearTimeout(타임아웃ID);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const 그룹 = 뜻풀이그룹_정규화(data);
    const 결과 = 그룹.length ? { 뜻풀이그룹: 그룹, 사전: data.사전 || 'opendict' } : null;
    캐시[word] = 결과;
    사전_캐시_저장(캐시);
    return 결과;
  }catch(e){
    if(타임아웃ID) clearTimeout(타임아웃ID);
    console.error('[사전] 조회 실패/시간초과', e);
    return null;
  }
}

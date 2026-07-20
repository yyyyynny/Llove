// '잇는' — 국립국어원(표준국어대사전·우리말샘) API 연동 (Phase 5)
// Llove의 Grok 게이트(js/grok.js)와 동일한 패턴: Cloudflare Worker 프록시가 인증키를 보관하고,
// 프론트·레포엔 키를 절대 두지 않는다. 국립국어원 오픈API는 브라우저에서 직접 부르면 CORS·
// 키노출 문제로 막히므로 프록시가 반드시 필요하다(원본 게임의 APIConnector가 가리키던 그 API,
// https://opendict.korean.go.kr/api/search).
//
// 용도는 "사용자가 입력한 단어의 사전 등재 여부 검증" 한정이다. AI 상대의 다음 단어 생성은
// 여전히 로컬 사전(js/사전.js)에서만 고른다 — 사전 API는 "이 글자로 시작하는 단어 전부"를
// 나열해 주지 않아(단건 조회만 가능) AI 후보 풀 구성에 쓸 수 없기 때문(계획서 명시 제약).
//
// 클래식 스크립트, 사전.js·엔진.js 뒤 아무 데나(게임규칙.js보다 먼저) 로드.

// ⚠️ 국어원 게이트 — 최고 관리자님 승인 없이 true로 변경 금지 (Llove GROK_활성화와 동일 정책).
//    Cloudflare Worker 배포 + 인증키 등록 전까지 실호출 전면 봉인. false인 동안 국어원_단어조회()는
//    항상 로컬 사전 판정만 쓰고(호출부가 자동 강등) 네트워크 호출도, 캐시 소비도 하지 않는다.
const 국어원_활성화 = false;

// Cloudflare Workers 엔드포인트(국립국어원 API 프록시). 관리자님이 Worker 배포 후 이 값을 채울 것.
const 국어원_WORKERS_ENDPOINT = '';

const 국어원_캐시_KEY = 'plx_잇는_국어원캐시';
function 국어원_캐시_로드(){
  try{ return JSON.parse(localStorage.getItem(국어원_캐시_KEY) || '{}'); }
  catch(e){ return {}; }   // localStorage 차단 환경 무시
}
function 국어원_캐시_저장(캐시){
  try{ localStorage.setItem(국어원_캐시_KEY, JSON.stringify(캐시)); }
  catch(e){ /* 용량 초과 등 무시 — 캐시는 있으면 좋고 없어도 그만 */ }
}

// 단어의 사전 등재 여부 온라인 조회. 게이트 off·엔드포인트 미설정·오프라인·호출 실패 시 전부
// false를 반환해 호출부가 로컬 사전(DICTIONARY/HARD_DICT) 판정으로 자동 강등되게 한다.
async function 국어원_단어조회(word){
  if(!국어원_활성화){
    console.warn('[국어원] 게이트 봉인(국어원_활성화=false) — 호출 차단, 로컬 사전만 사용');
    return false;
  }
  if(!국어원_WORKERS_ENDPOINT){
    console.error('[국어원] Workers 엔드포인트 미설정 — 호출 불가');
    return false;
  }
  const 캐시 = 국어원_캐시_로드();
  if(Object.prototype.hasOwnProperty.call(캐시, word)) return 캐시[word];
  try{
    const res = await fetch(국어원_WORKERS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 단어: word })
    });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const 존재함 = !!(data && data.존재);
    캐시[word] = 존재함;
    국어원_캐시_저장(캐시);
    return 존재함;
  }catch(e){
    console.error('[국어원] 조회 실패 — 로컬 사전 판정 유지', e);
    return false;
  }
}

if (typeof module !== 'undefined') module.exports = { 국어원_단어조회, 국어원_캐시_KEY };

// '잇는' — 국립국어원(표준국어대사전·우리말샘) API 연동 (Phase 5)
// Llove의 Grok 게이트(js/grok.js)와 동일한 패턴: Cloudflare Worker 프록시가 인증키를 보관하고,
// 프론트·레포엔 키를 절대 두지 않는다. 국립국어원 오픈API는 브라우저에서 직접 부르면 CORS·
// 키노출 문제로 막히므로 프록시가 반드시 필요하다(원본 게임의 APIConnector가 가리키던 그 API,
// https://opendict.korean.go.kr/api/search).
//
// 용도: (1) 사용자가 입력한 단어의 사전 등재 여부 검증, (2) AI 상대의 다음 단어 후보 온라인
// 조회. (2)는 국어원 오픈API의 "고급 검색"(advanced=y&method=start|end)이 실제로 "이 글자로
// 시작/끝나는 단어 목록"을 돌려준다는 걸 2026-07-24에 실측으로 확인해 추가함(기본 검색은
// 부분일치라 이게 안 되는 줄 알았던 이전 판단은 오판 — Worker 쪽에서 고급 검색 파라미터로
// 호출). 게이트 off·API 실패 시엔 빈 배열을 반환해 호출부(js/게임규칙.js)가 로컬 사전만으로
// 안전하게 강등되게 한다(하이브리드: API 우선, 실패 시 로컬 — 관리자님 확정 방침).
//
// 클래식 스크립트, 사전.js·엔진.js 뒤 아무 데나(게임규칙.js보다 먼저) 로드.

// ⚠️ 국어원 게이트 — 최고 관리자님 승인 없이 true로 변경 금지 (Llove GROK_활성화와 동일 정책).
//    Cloudflare Worker 배포 + 인증키 등록 전까지 실호출 전면 봉인. false인 동안 국어원_단어조회()는
//    항상 로컬 사전 판정만 쓰고(호출부가 자동 강등) 네트워크 호출도, 캐시 소비도 하지 않는다.
const 국어원_활성화 = true;

// Cloudflare Workers 엔드포인트(국립국어원 API 프록시). 관리자님이 Worker 배포 후 이 값을 채울 것.
const 국어원_WORKERS_ENDPOINT = 'https://urimalsaem-llove.hypoqwer.workers.dev/';

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

const 국어원_후보캐시_KEY = 'plx_잇는_국어원후보캐시';
function 국어원_후보캐시_로드(){
  try{ return JSON.parse(localStorage.getItem(국어원_후보캐시_KEY) || '{}'); }
  catch(e){ return {}; }
}
function 국어원_후보캐시_저장(캐시){
  try{ localStorage.setItem(국어원_후보캐시_KEY, JSON.stringify(캐시)); }
  catch(e){ /* 용량 초과 등 무시 */ }
}

// 특정 글자로 시작(start)/끝나는(end) 실제 단어 후보 목록을 온라인으로 조회 — AI 다음 단어
// 생성용. 접사·구·복합표기(하이픈·공백·^ 포함 표기)는 Worker가 걸러서 보낸다. 게이트 off·
// 엔드포인트 미설정·오프라인·호출 실패 시 전부 빈 배열을 반환해 호출부(ai_generate_word_비동기,
// js/게임규칙.js)가 로컬 사전(DICTIONARY/HARD_DICT)만으로 안전하게 강등되게 한다.
// AI 턴마다 실호출이라(캐시 미스 시) 네트워크가 느리면 AI가 응답을 멈춘 것처럼 보일 수 있어
// 상한을 둔다(1.5초) — 넘으면 즉시 포기하고 로컬 사전으로 강등, 게임 흐름이 멈추지 않게 한다.
const 국어원_후보_타임아웃_MS = 1500;
async function 국어원_후보목록조회(글자, 방향){
  if(!국어원_활성화) return [];
  if(!국어원_WORKERS_ENDPOINT) return [];
  const 캐시키 = `${방향}:${글자}`;
  const 캐시 = 국어원_후보캐시_로드();
  if(Object.prototype.hasOwnProperty.call(캐시, 캐시키)) return 캐시[캐시키];
  const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const 타임아웃ID = controller ? setTimeout(() => controller.abort(), 국어원_후보_타임아웃_MS) : null;
  try{
    const res = await fetch(국어원_WORKERS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 글자: 글자, 방향: 방향 }),
      ...(controller ? { signal: controller.signal } : {})
    });
    if(타임아웃ID) clearTimeout(타임아웃ID);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const 목록 = Array.isArray(data.후보) ? data.후보 : [];
    캐시[캐시키] = 목록;
    국어원_후보캐시_저장(캐시);
    return 목록;
  }catch(e){
    if(타임아웃ID) clearTimeout(타임아웃ID);
    console.error('[국어원] 후보 목록 조회 실패/시간초과 — 로컬 사전 판정 유지', e);
    return [];
  }
}

if (typeof module !== 'undefined') module.exports = { 국어원_단어조회, 국어원_후보목록조회, 국어원_캐시_KEY };

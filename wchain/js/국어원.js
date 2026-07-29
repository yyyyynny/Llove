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

// 캐시 키에 버전을 붙인다(2026-07-27). 판정 결과(특히 "없는 단어"=false)가 영구 저장되는데,
// Worker나 판정 규칙이 바뀌어도 옛 결과가 그대로 남아 되돌릴 방법이 없었다. 규칙이 바뀔 때
// 이 숫자를 올리면 사용자 기기의 옛 캐시가 자연히 무시된다.
const 국어원_캐시_KEY = 'plx_잇는_국어원캐시_v2';
function 국어원_캐시_로드(){
  try{ return JSON.parse(localStorage.getItem(국어원_캐시_KEY) || '{}'); }
  catch(e){ return {}; }   // localStorage 차단 환경 무시
}
function 국어원_캐시_저장(캐시){
  try{ localStorage.setItem(국어원_캐시_KEY, JSON.stringify(캐시)); }
  catch(e){ /* 용량 초과 등 무시 — 캐시는 있으면 좋고 없어도 그만 */ }
}

// 공통 POST 헬퍼 — 타임아웃(AbortController) 포함. 게이트 off·엔드포인트 미설정 시 fetch 없이
// null, 실패·시간초과 시에도 null을 반환해 호출부가 로컬 판정으로 강등하게 한다.
//
// ⚠️ 타임아웃 값은 추정이 아니라 실측으로 정했다(2026-07-26). 관리자님이 실배포 사이트에서
// "국어"·"이름" 같은 흔한 단어가 "사전 확인 실패"로 거부되는 걸 제보 → Worker 왕복 시간을 직접
// 재보니 단어 조회 1.17~4.04초(국어 3.96s / 이름 4.04s), 후보 목록 3.92~5.44초(가 5.44s)였다.
// 그때 상한이 3초라 정상 응답(HTTP 200)이 도착하기 전에 우리가 끊어버리고 있었던 것 —
// 네트워크 장애가 아니라 우리 설정 문제였다. 실측 최댓값 + 모바일망 여유를 더해 재설정한다.
//  - 단어 검증: 사용자가 결과를 눈앞에서 기다리는 상황이라 "느려도 정확히"가 맞다 → 8초.
//  - 후보 목록: AI 턴마다 도는 호출이라 너무 길면 게임이 멈춘 듯 보인다 → 6초.
//    (구간 B의 난이도 계층화로 낮은 난이도에선 이 호출 자체가 사라져 체감 지연도 함께 줄었다.)
// 상한을 늘려도 실패는 여전히 날 수 있으므로, null("확인 자체를 못 함") 반환으로 호출부가
// 오판하지 않게 하는 안전망은 그대로 유지한다.
const 국어원_타임아웃_단어_MS = 8000;
const 국어원_타임아웃_후보_MS = 6000;
async function 국어원_POST(payload, 타임아웃_MS){
  if(!국어원_활성화) return null;
  if(!국어원_WORKERS_ENDPOINT) return null;
  const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const 타임아웃ID = controller ? setTimeout(() => controller.abort(), 타임아웃_MS) : null;
  try{
    const res = await fetch(국어원_WORKERS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      ...(controller ? { signal: controller.signal } : {})
    });
    if(타임아웃ID) clearTimeout(타임아웃ID);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }catch(e){
    if(타임아웃ID) clearTimeout(타임아웃ID);
    console.error('[국어원] 요청 실패/시간초과 — 로컬 판정으로 강등', e);
    return null;
  }
}

// 단어의 사전 등재 여부 온라인 조회. 반환값은 3가지: true(등재 확인)/false(미등재 확인)/
// null(게이트 off·미설정·오프라인·실패·시간초과 — "확인 자체를 못 함". 2026-07-25 이전엔 이 경우도
// false로 뭉뚱그려 반환해서, 실제로는 흔한 단어인데 네트워크가 느려서 확인을 못 했을 뿐인데도
// 호출부가 "사전에 없는 단어입니다"라고 오판하고 사용자에게 실수까지 매기는 문제가 있었음
// — 호출부(서바이벌.js)가 null을 별도로 처리해 이 오판을 없앤다).
/* ⚠️ 붙임표(-) 문제 — 2026-07-29 실측으로 확인한 치명적 오판 원인.
   ────────────────────────────────────────────────────────────────
   우리말샘은 **합성어 표제어에 붙임표를 넣어** 등재한다: `가마-솥`, `뽕-나무`, `눈-사람`.
   그런데 Worker가 이 붙임표를 제거하지 않고 정확 일치로 비교해서, 사용자가 붙여 쓴 정상
   단어가 전부 "사전에 없는 단어"가 됐다(관리자님 제보 — 가마솥·뽕나무·뽕잎 오답 처리).

   이 환경에서 Worker에 직접 질의해 확정:
     가마솥 → 존재 false  /  가마-솥 → 존재 true (뜻풀이 1건)
     뽕나무 → 존재 false  /  뽕-나무 → 존재 true (뜻풀이 2건)
     나무·학교·무지개 → true (합성어가 아니라 표제어에 붙임표가 없음)

   **근본 해결은 Worker가 붙임표를 지우고 비교하는 것**이고, 그건 관리자님 몫이다
   (Cloudflare Worker는 이 저장소 밖). 그때까지 클라이언트에서 붙임표 위치를 넣어 재시도한다.
   한국어 합성어는 매우 흔해서 이 폴백이 없으면 게임이 성립하지 않는다. */
function 붙임표_변형(word){
  // 한글 2~6글자만. 공백이 든 구(句)는 표제어 형식이 달라 대상 밖.
  if(!/^[가-힣]{2,6}$/.test(word)) return [];
  const 변형 = [];
  for(let i = 1; i < word.length; i++) 변형.push(word.slice(0, i) + '-' + word.slice(i));
  return 변형;
}

// 단어의 사전 등재 여부 온라인 조회. 반환값은 3가지: true(등재 확인)/false(미등재 확인)/
// null(게이트 off·미설정·오프라인·실패·시간초과 — "확인 자체를 못 함". 2026-07-25 이전엔 이 경우도
// false로 뭉뚱그려 반환해서, 실제로는 흔한 단어인데 네트워크가 느려서 확인을 못 했을 뿐인데도
// 호출부가 "사전에 없는 단어입니다"라고 오판하고 사용자에게 실수까지 매기는 문제가 있었음
// — 호출부(서바이벌.js)가 null을 별도로 처리해 이 오판을 없앤다).
async function 국어원_단어조회(word){
  const 캐시 = 국어원_캐시_로드();
  if(Object.prototype.hasOwnProperty.call(캐시, word)) return 캐시[word];

  const data = await 국어원_POST({ 단어: word }, 국어원_타임아웃_단어_MS);
  if(data === null) return null;   // 실패·시간초과는 캐시에 쓰지 않음(전이적 실패 오염 방지)
  if(data.존재){
    캐시[word] = true; 국어원_캐시_저장(캐시);
    return true;
  }

  // 붙여 쓴 형태로 못 찾았다 → 합성어일 수 있으니 붙임표를 끼워 다시 물어본다(위 주석 참조).
  // 위치를 모르므로 가능한 자리를 전부, **병렬로** 확인한다(직렬이면 왕복이 길이만큼 쌓인다).
  const 변형 = 붙임표_변형(word);
  if(변형.length){
    const 결과들 = await Promise.all(
      변형.map(v => 국어원_POST({ 단어: v }, 국어원_타임아웃_단어_MS)));
    if(결과들.some(d => d && d.존재)){
      캐시[word] = true; 국어원_캐시_저장(캐시);
      return true;
    }
    // 전부 네트워크 실패면 "없다"고 단정할 수 없다 — 확인 못 함으로 돌려보낸다.
    if(결과들.every(d => d === null)) return null;
  }

  캐시[word] = false;
  국어원_캐시_저장(캐시);
  return false;
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
// 생성용이자, 한방 판정(정말 이을 단어가 없는지) 확인용. 접사·구·복합표기(하이픈·공백·^ 포함
// 표기)는 Worker가 걸러서 보낸다.
//
// ⚠️ 2026-07-27 반환 규약 변경: 성공 시 배열(빈 배열일 수도 있음) / **실패·시간초과·게이트
// off·미설정 시 null**. 종전엔 둘 다 빈 배열이라 "정말 이을 단어가 없다"와 "확인을 못 했다"를
// 구분할 수 없었는데, 한방 판정은 이 둘을 반드시 구분해야 한다("확인 못 함"을 한방으로 단정하면
// 네트워크가 느린 것만으로 사용자가 실수를 뒤집어쓴다 — 국어원_단어조회의 null 관례와 동일).
// AI 후보용 호출부는 `?? []`로 정규화해 기존처럼 로컬 사전으로 안전하게 강등된다.
async function 국어원_후보목록조회(글자, 방향){
  if(!국어원_활성화) return null;
  const 캐시키 = `${방향}:${글자}`;
  const 캐시 = 국어원_후보캐시_로드();
  if(Object.prototype.hasOwnProperty.call(캐시, 캐시키)) return 캐시[캐시키];
  const data = await 국어원_POST({ 글자: 글자, 방향: 방향 }, 국어원_타임아웃_후보_MS);
  if(data === null) return null;    // 실패·시간초과 — 캐시에 쓰지 않음(전이적 실패 오염 방지)
  const 목록 = Array.isArray(data.후보) ? data.후보 : [];
  캐시[캐시키] = 목록;
  국어원_후보캐시_저장(캐시);
  return 목록;
}

if (typeof module !== 'undefined') module.exports = { 국어원_단어조회, 국어원_후보목록조회, 국어원_캐시_KEY };

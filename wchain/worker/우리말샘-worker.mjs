// '잇는' — 우리말샘(국립국어원 오픈API) 프록시 Worker
//
// wchain/Worker_수정요청.md에 정리된 결함(①붙임표 오판 ②후보 부족)을 반영한 구현.
// 2026-08-15 실배포로 검증 완료(가마솥·뽕나무 존재 확인, '사' 후보 107건·'기' 후보 89건).
// 배포 방법은 이 폴더의 README.md 참조.
//
// 클라이언트(wchain/js/국어원.js, Llove/js/사전.js)와의 계약 — 기존 필드는 바꾸지 말 것
// (바꾸면 클라이언트도 함께 고쳐야 함). 새 필드(뜻풀이그룹)는 2026-08-19에 추가:
//   요청  POST { 단어: "가마솥" }
//     → 응답 { 존재: true|false, 뜻풀이그룹: [{ 번호:1, 뜻풀이:["..."] }, ...] }
//       (뜻풀이그룹은 동음이의어별로 묶은 배열 — wchain은 존재만, Llove는 이 필드까지 씀.
//        단어가 없으면 빈 배열. 그룹화 기준은 아래 뜻풀이_그룹화() 참조.)
//   요청  POST { 단어: "필연", 디버그: true } → 위 응답에 _원본진단(원본 item 최대 5개) 추가
//     (그룹화가 또 안 맞을 때 재배포 없이 필드명을 확인하기 위한 진단 전용, 평소엔 안 씀)
//   요청  POST { 글자: "가", 방향: "start"|"end" } → 응답 { 후보: ["가나다", ...] }
//   실패 시 4xx/5xx만 반환하면 된다 — 클라이언트는 res.ok가 아니면 null로 강등해 로컬 안전망을 탄다.
//
// (CLAUDE.md 원칙: "API 키는 Cloudflare Workers만, 프론트 노출 금지" — 이 파일에 키를 직접 적지 말 것.)
// 인증키: Cloudflare 대시보드 Worker 설정 > Variables and Secrets 에 이미 등록된
// URIMALSAEM_KEY(인증키)·URIMALSAEM_CERTKEY_NO(발급번호) 두 시크릿을 그대로 쓴다 — 둘 다 필수.

const 국어원_API_기준주소 = 'https://opendict.korean.go.kr/api/search';
const 국어원_API_뷰주소 = 'https://opendict.korean.go.kr/api/view';

// opendict가 User-Agent 없는 요청을 걸러내는 사례가 있어 방어적으로 붙인다.
const 공통_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

// ── CORS ────────────────────────────────────────────────────────────────
// 이 Worker는 인증키를 대신 들고 있는 공용 프록시라, 아무 origin이나 허용하면 다른 사이트가
// 관리자님의 API 호출량을 몰래 빌려 쓸 수 있다. 게임이 실제로 서비스되는 origin만 허용한다.
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

// ── 붙임표(-) · 캐럿(^) 정규화 ───────────────────────────────────────────
// 우리말샘은 합성어 표제어에 붙임표를(`가마-솥`), 띄어 쓰는 합성어에 캐럿을(`가마솥^밥`) 넣어
// 등재한다. 게임은 사용자가 붙여 쓴 한 덩어리 문자열만 다루므로, 비교·응답 양쪽에서 둘 다 지운다.
// (붙임표를 정규화 없이 통째로 버리면 '사'처럼 흔한 글자의 후보 대부분이 사라진다 —
// Worker_수정요청.md ②의 원인.)
const 정규화 = w => String(w).replace(/[-^]/g, '').trim();

// word 문자열 중간에 가능한 모든 위치에 붙임표를 끼운 변형 목록(2~6글자 한글만).
// Worker가 대신 하면 왕복이 1홉(Worker→오픈API)으로 줄어든다. 클라이언트(국어원.js)의
// 붙임표_변형 폴백은 이중 안전망으로 남겨 둔다.
function 붙임표_변형(word){
  if(!/^[가-힣]{2,6}$/.test(word)) return [];
  const 변형 = [];
  for(let i = 1; i < word.length; i++) 변형.push(word.slice(0, i) + '-' + word.slice(i));
  return 변형;
}

// Cloudflare Secret 입력 시 앞뒤 공백·줄바꿈이 섞여 들어가는 실수를 막는다(문자열 그대로
// 비교하는 API라 공백 한 칸만 있어도 "등록 안 된 키"로 거부된다 — 실측으로 확인된 문제).
const 다듬기 = v => String(v || '').trim();

// ── 오픈API 호출 ───────────────────────────────────────────────────────
// key·certkey_no 둘 다 필수. num은 최솟값 제약이 있어(실측: num=1은 "Invalid num value"로
// 거부, num=20/100은 정상) 호출부가 항상 유효한 범위의 값을 넘긴다.
async function 오픈API_검색(env, { q, advanced, target, method, start = 1, num = 10 }){
  const url = new URL(국어원_API_기준주소);
  url.searchParams.set('certkey_no', 다듬기(env.URIMALSAEM_CERTKEY_NO));
  url.searchParams.set('key', 다듬기(env.URIMALSAEM_KEY));
  url.searchParams.set('target_type', 'search');
  url.searchParams.set('req_type', 'json');
  url.searchParams.set('part', 'word');
  url.searchParams.set('sort', 'dict');
  if(advanced) url.searchParams.set('advanced', 'y');
  if(target) url.searchParams.set('target', String(target));
  if(method) url.searchParams.set('method', method);   // exact | include | start | end
  url.searchParams.set('start', String(start));
  url.searchParams.set('num', String(num));
  url.searchParams.set('q', q);

  const res = await fetch(url.toString(), { headers: 공통_HEADERS });
  if(!res.ok) throw new Error('오픈API HTTP ' + res.status);
  const 원문 = await res.text();
  let data;
  try{ data = JSON.parse(원문); }
  catch(e){ throw new Error('오픈API JSON 파싱 실패'); }
  // 이 API는 실패해도 HTTP 200을 주고 본문에 {error:{...}}를 담는 경우가 있다(관공서 API 흔한
  // 패턴) — HTTP 상태만 보면 이 실패를 놓친다.
  if(data && data.error) throw new Error('오픈API 에러: ' + JSON.stringify(data.error));
  const channel = data && data.channel;
  const items = (channel && Array.isArray(channel.item)) ? channel.item : [];
  return { items };
}

// view API — target_code 하나를 상세조회해 group_code(다의어 번호 — 동음이의어를 구분하는
// 진짜 고유 키, search API 응답엔 없음)를 얻는다. 아래 뜻풀이_그룹화_비동기()에서만 쓴다.
async function 오픈API_뷰(env, target_code){
  const url = new URL(국어원_API_뷰주소);
  url.searchParams.set('certkey_no', 다듬기(env.URIMALSAEM_CERTKEY_NO));
  url.searchParams.set('key', 다듬기(env.URIMALSAEM_KEY));
  url.searchParams.set('req_type', 'json');
  url.searchParams.set('method', 'target_code');
  url.searchParams.set('q', String(target_code));

  const res = await fetch(url.toString(), { headers: 공통_HEADERS });
  if(!res.ok) throw new Error('오픈API(view) HTTP ' + res.status);
  const 원문 = await res.text();
  let data;
  try{ data = JSON.parse(원문); }
  catch(e){ throw new Error('오픈API(view) JSON 파싱 실패'); }
  if(data && data.error) throw new Error('오픈API(view) 에러: ' + JSON.stringify(data.error));
  const item = data && data.channel && data.channel.item;
  return Array.isArray(item) ? (item[0] || null) : (item || null);   // view는 원래 단일 객체
}

// ── 뜻풀이 동음이의어 그룹화 ─────────────────────────────────────────────
// 2026-08-19 디버그:true 진단으로 실제 opendict 응답 구조를 확인한 결과(README.md 기록),
// item은 표제어당 1개가 아니라 **뜻(sense) 하나당 1개**로 내려오고, sup_no 필드는 아예 없으며
// target_code는 표제어가 아니라 **sense(뜻풀이) 단위 고유값**이라 필연=必然의 명사·부사 두
// 뜻조차 서로 다른 target_code를 갖는다 — 그룹 키로 쓸 수 없다(1차 수정에서 잘못 짚었던 부분).
// 어원(sense.origin, 예: "必然"/"筆硯")이 있는 뜻은 그걸로 정확히 갈린다(한자어 동음이의어는
// 이걸로 충분).
//
// 2026-08-19 3차(관리자님 승인) — 순우리말이라 origin이 없는 뜻(눈=眼/雪 등)은 위 방법으로
// 구분이 안 됐는데, opendict view API(target_type=view)가 도는 group_code가 진짜 동음이의어
// 구분 키임을 확인했다. 다만 target_code 하나당 별도 호출이 필요해 비용이 크므로:
//   ① 어원 없는 뜻이 2개 이상 몰려 있을 때만(1개면 나눌 대상이 없어 스킵)
//   ② 서로 다른 target_code 개수가 상한(뷰_추가조회_최대) 이내일 때만 — 넘으면 조회를 포기하고
//      기존처럼 표제어 하나로 합쳐서 보여준다(정확도만 낮아질 뿐 죽지 않는 안전한 폴백)
//   ③ 병렬로 — 순서대로 기다리면 뜻 개수만큼 왕복이 쌓인다
// 조회에 실패한 target_code는 다른 것과 잘못 합치지 않고 그 자체로 고립시킨다(틀리게 합치는
// 것보다 안전).
const 뷰_추가조회_최대 = 6;

async function 뜻풀이_그룹화_비동기(env, items){
  const 어원있음 = new Map();   // 'origin:필드값' → 뜻풀이[]
  const 어원없음 = [];          // { definition, target_code, word } — 순서 보존

  for(const it of items){
    if(!it) continue;
    const sense목록 = Array.isArray(it.sense) ? it.sense : (it.sense ? [it.sense] : []);
    for(const s of sense목록){
      if(!s || !s.definition) continue;
      if(s.origin){
        const 키 = 'origin:' + s.origin;
        if(!어원있음.has(키)) 어원있음.set(키, []);
        어원있음.get(키).push(String(s.definition));
      } else {
        어원없음.push({ definition: String(s.definition), target_code: s.target_code, word: it.word });
      }
    }
  }

  const 어원없음그룹 = new Map();
  const 고유target = [...new Set(어원없음.map(x => x.target_code).filter(v => v != null))];

  if(어원없음.length >= 2 && 고유target.length >= 2 && 고유target.length <= 뷰_추가조회_최대){
    const 조회결과 = await Promise.all(고유target.map(tc => 오픈API_뷰(env, tc).catch(() => null)));
    const target별_그룹코드 = new Map();
    고유target.forEach((tc, i) => {
      const view = 조회결과[i];
      target별_그룹코드.set(tc, (view && view.group_code != null) ? String(view.group_code) : null);
    });
    for(const s of 어원없음){
      const 그룹코드 = s.target_code != null ? target별_그룹코드.get(s.target_code) : null;
      const 키 = 그룹코드 != null ? ('group:' + 그룹코드) : ('tc:' + s.target_code);
      if(!어원없음그룹.has(키)) 어원없음그룹.set(키, []);
      어원없음그룹.get(키).push(s.definition);
    }
  } else if(어원없음.length){
    // 뜻이 1개뿐이거나 target_code가 없거나 상한을 넘음 — 안전하게 표제어 하나로 합친다.
    어원없음그룹.set('word:' + 어원없음[0].word, 어원없음.map(s => s.definition));
  }

  // 등장 순서(= opendict가 준 순서, 대개 흔한 뜻부터) 그대로 번호만 매긴다.
  return [...어원있음.values(), ...어원없음그룹.values()].map((뜻풀이, i) => ({ 번호: i + 1, 뜻풀이 }));
}

// ── ① 단어 존재 여부 + 뜻풀이 ──────────────────────────────────────────
// advanced=y&target=1&method=exact — "자세히 찾기" 모드로 정확 일치만 받는다(기본 검색은
// 부분/포함 일치라 관련 없는 단어까지 섞여 존재 판정이 느슨해질 수 있어 이쪽을 쓴다).
// method=exact는 opendict 자체가 문자열을 정확 비교하므로, 붙여 쓴 입력("가마솥")으로는
// 붙임표 표제어("가마-솥")를 찾지 못한다. 원본 그대로 먼저 시도하고, 못 찾으면 가능한 위치에
// 붙임표를 끼운 변형을 **병렬로** 전부 시도한다(직렬이면 변형 수만큼 왕복이 쌓인다).
// 진단 모드(payload.디버그===true)일 때만 원본 item을 함께 실어 보낸다 — 그룹화 로직이 또
// 안 맞을 경우 재배포 없이 curl 한 번으로 실제 필드명을 확인하기 위함(README.md 참조).
// 평소 요청에는 이 인자를 안 넘기므로 기본 응답 크기·계약에 영향 없다.
async function 단어존재조회(env, word, 진단 = false){
  const 시도할것 = [word, ...붙임표_변형(word)];
  const 결과들 = await Promise.all(
    시도할것.map(w => 오픈API_검색(env, { q: w, advanced: true, target: 1, method: 'exact', num: 20 })
      .catch(() => ({ items: [] }))));   // 개별 실패는 "없음"으로 취급, 전체는 아래서 판단

  for(const { items } of 결과들){
    const 일치항목 = items.filter(it => 정규화(it.word) === 정규화(word));
    if(일치항목.length){
      const 결과 = { 존재: true, 뜻풀이그룹: await 뜻풀이_그룹화_비동기(env, 일치항목) };
      if(진단) 결과._원본진단 = 일치항목.slice(0, 5);
      return 결과;
    }
  }
  return { 존재: false, 뜻풀이그룹: [] };
}

// ── ② 후보 목록(글자로 시작/끝나는 단어) ───────────────────────────────
// advanced=y&target=1&method=start|end — "이 글자로 시작/끝나는 단어" 전방/후방 일치.
// num=100 + 필요하면 다음 페이지까지 병렬로 받는다. 붙임표 든 표제어는 버리지 않고
// 정규화해서 포함한다(위 "정규화" 주석).
const 후보_페이지당개수 = 100;
const 후보_최대페이지 = 3;   // 최대 300개. 페이지 수를 늘리면 후보는 늘지만 왕복도 늘어난다.

async function 후보목록조회(env, 글자, 방향){
  const method = 방향 === 'end' ? 'end' : 'start';

  const 페이지들 = await Promise.all(
    Array.from({ length: 후보_최대페이지 }, (_, i) => i)
      .map(i => 오픈API_검색(env, {
        q: 글자, advanced: true, target: 1, method,
        start: 1 + i * 후보_페이지당개수, num: 후보_페이지당개수,
      }).catch(() => ({ items: [] })))
  );

  const 후보 = [];
  const 본것 = new Set();
  for(const { items } of 페이지들){
    for(const it of items){
      if(typeof it.word !== 'string') continue;
      const 정리됨 = 정규화(it.word);
      // 접사·구(句) 등 게임에 쓸 수 없는 형태를 거른다:
      //   · 공백이 남아 있으면(캐럿이 아니라 실제 띄어쓰기) 구(句) — 클라이언트가 phrase 설정에
      //     따라 별도로 다루므로 여기서는 온전한 한 단어만 보낸다.
      //   · 한 글자짜리는 게임 규칙상 의미가 없다.
      //   · 한글이 아닌 문자(로마자 표기 등)가 섞인 표제어는 제외.
      if(!정리됨 || 정리됨.includes(' ')) continue;
      if(정리됨.length < 2) continue;
      if(!/^[가-힣]+$/.test(정리됨)) continue;
      if(방향 === 'start' && !정리됨.startsWith(글자)) continue;
      if(방향 === 'end' && !정리됨.endsWith(글자)) continue;
      if(본것.has(정리됨)) continue;
      본것.add(정리됨);
      후보.push(정리됨);
    }
  }
  return 후보;
}

// ── 진입점 ───────────────────────────────────────────────────────────
export default {
  async fetch(request, env){
    const origin = request.headers.get('Origin') || '';

    if(request.method === 'OPTIONS'){
      return new Response(null, { status: 204, headers: cors헤더(origin) });
    }
    if(!허용_ORIGIN.has(origin)){
      // CORS 프리플라이트를 못 넣는 curl 등 서버 간 호출은 여기서 막힌다 — 의도된 동작.
      return json응답({ error: '허용되지 않은 origin' }, 403, origin);
    }
    if(request.method !== 'POST'){
      return json응답({ error: 'POST만 허용됩니다.' }, 405, origin);
    }
    if(!env.URIMALSAEM_KEY || !env.URIMALSAEM_CERTKEY_NO){
      return json응답({ error: '서버 설정 오류: URIMALSAEM_KEY·URIMALSAEM_CERTKEY_NO 둘 다 필요합니다.' }, 500, origin);
    }

    let payload;
    try{ payload = await request.json(); }
    catch(e){ return json응답({ error: '잘못된 JSON' }, 400, origin); }

    try{
      if(typeof payload.단어 === 'string' && payload.단어.trim()){
        const 결과 = await 단어존재조회(env, payload.단어.trim(), payload.디버그 === true);
        return json응답(결과, 200, origin);
      }
      if(typeof payload.글자 === 'string' && payload.글자.trim()
         && (payload.방향 === 'start' || payload.방향 === 'end')){
        const 후보 = await 후보목록조회(env, payload.글자.trim(), payload.방향);
        return json응답({ 후보 }, 200, origin);
      }
      return json응답({ error: '요청 형식이 올바르지 않습니다(단어 또는 글자+방향 필요).' }, 400, origin);
    }catch(e){
      console.error('[우리말샘 Worker] 처리 실패', e);
      return json응답({ error: '오픈API 호출 실패' }, 502, origin);
    }
  },
};

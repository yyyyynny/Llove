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
//        단어가 없으면 빈 배열.)
//   요청  POST { 글자: "가", 방향: "start"|"end" } → 응답 { 후보: ["가나다", ...] }
//   실패 시 4xx/5xx만 반환하면 된다 — 클라이언트는 res.ok가 아니면 null로 강등해 로컬 안전망을 탄다.
//
// (CLAUDE.md 원칙: "API 키는 Cloudflare Workers만, 프론트 노출 금지" — 이 파일에 키를 직접 적지 말 것.)
// 인증키: Cloudflare 대시보드 Worker 설정 > Variables and Secrets 에 이미 등록된
// URIMALSAEM_KEY(인증키)·URIMALSAEM_CERTKEY_NO(발급번호) 두 시크릿을 그대로 쓴다 — 둘 다 필수.

const 국어원_API_기준주소 = 'https://opendict.korean.go.kr/api/search';

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

// ── 뜻풀이 동음이의어 그룹화 ─────────────────────────────────────────────
// opendict 검색 API는 표제어의 뜻 하나(또는 하위 sense 몇 개)마다 item을 하나씩 내려주고,
// 어원이 다른 동음이의어(예: 필연=必然/筆硯)는 item.sup_no(어깻번호)로 구분된다. sup_no가
// 같은 item들의 뜻풀이를 한 그룹으로 묶는다. item.sense는 문서상 단일 객체로 오는 경우가
// 대부분이지만, 혹시 배열로 오는 경우까지 방어적으로 둘 다 처리한다.
// ⚠️ sup_no 필드명은 국립국어원 표준 API 문서 기준이며, 배포 후 curl로 실측 검증이 필요하다
// (README.md 참조). 필드가 없거나 이름이 다르면 전부 1그룹으로 뭉뚱그려지는 정도로 안전하게
// 저하되고(뜻풀이 자체는 여전히 표시됨), 실측 후 이 함수만 고치면 된다.
function 뜻풀이_그룹화(items){
  const 그룹맵 = new Map();   // 어깻번호(문자열) → 뜻풀이 배열
  for(const it of items){
    if(!it) continue;
    const 어깻번호 = it.sup_no != null ? String(it.sup_no) : '1';
    const sense목록 = Array.isArray(it.sense) ? it.sense : (it.sense ? [it.sense] : []);
    const 뜻들 = sense목록.map(s => s && s.definition ? String(s.definition) : '').filter(Boolean);
    if(!뜻들.length) continue;
    if(!그룹맵.has(어깻번호)) 그룹맵.set(어깻번호, []);
    그룹맵.get(어깻번호).push(...뜻들);
  }
  return [...그룹맵.entries()]
    .sort((a, b) => (parseInt(a[0], 10) || 0) - (parseInt(b[0], 10) || 0))
    .map(([, 뜻풀이], i) => ({ 번호: i + 1, 뜻풀이 }));
}

// ── ① 단어 존재 여부 + 뜻풀이 ──────────────────────────────────────────
// advanced=y&target=1&method=exact — "자세히 찾기" 모드로 정확 일치만 받는다(기본 검색은
// 부분/포함 일치라 관련 없는 단어까지 섞여 존재 판정이 느슨해질 수 있어 이쪽을 쓴다).
// method=exact는 opendict 자체가 문자열을 정확 비교하므로, 붙여 쓴 입력("가마솥")으로는
// 붙임표 표제어("가마-솥")를 찾지 못한다. 원본 그대로 먼저 시도하고, 못 찾으면 가능한 위치에
// 붙임표를 끼운 변형을 **병렬로** 전부 시도한다(직렬이면 변형 수만큼 왕복이 쌓인다).
async function 단어존재조회(env, word){
  const 시도할것 = [word, ...붙임표_변형(word)];
  const 결과들 = await Promise.all(
    시도할것.map(w => 오픈API_검색(env, { q: w, advanced: true, target: 1, method: 'exact', num: 20 })
      .catch(() => ({ items: [] }))));   // 개별 실패는 "없음"으로 취급, 전체는 아래서 판단

  for(const { items } of 결과들){
    const 일치항목 = items.filter(it => 정규화(it.word) === 정규화(word));
    if(일치항목.length) return { 존재: true, 뜻풀이그룹: 뜻풀이_그룹화(일치항목) };
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
        const { 존재, 뜻풀이그룹 } = await 단어존재조회(env, payload.단어.trim());
        return json응답({ 존재, 뜻풀이그룹 }, 200, origin);
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

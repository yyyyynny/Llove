// '잇는' — 우리말샘(국립국어원 오픈API) 프록시 Worker (2026-07-29 전면 재작성)
//
// wchain/Worker_수정요청.md에 정리된 3가지 결함(①붙임표 오판 ②후보 부족 ③희귀어 편중)을
// 반영한 새 구현. 배포 방법은 이 폴더의 README.md 참조.
//
// 클라이언트(wchain/js/국어원.js)와의 계약 — 이 형태는 바꾸지 말 것(바꾸면 클라이언트도 함께 고쳐야 함):
//   요청  POST { 단어: "가마솥" }              → 응답 { 존재: true|false }
//   요청  POST { 글자: "가", 방향: "start"|"end" } → 응답 { 후보: ["가나다", ...] }
//   실패 시 4xx/5xx만 반환하면 된다 — 클라이언트는 res.ok가 아니면 null로 강등해 로컬 안전망을 탄다.
//
// 인증키: Cloudflare 대시보드 Worker 설정 > Variables and Secrets 에 URIMALSAEM_KEY로 등록(관리자님이 이미 등록해 두신 시크릿 이름 — 우리말샘 오픈API 공식 문서상 인증키 파라미터는 'key' 하나뿐이라, 화면에 함께 있던 URIMALSAEM_CERTKEY_NO는 이 호출에 쓰지 않는다).
// (CLAUDE.md 원칙: "API 키는 Cloudflare Workers만, 프론트 노출 금지" — 이 파일에 키를 직접 적지 말 것.)

const 국어원_API_기준주소 = 'https://opendict.korean.go.kr/api/search';

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

// ── 붙임표(-) · 캐리트(^) 정규화 ───────────────────────────────────────────
// 우리말샘은 합성어 표제어에 붙임표를(`가마-솥`), 띄어 쓰는 합성어에 캐럿을(`가마솥^밥`) 넣어
// 등재한다. 게임은 사용자가 붙여 쓴 한 덩어리 문자열만 다루므로, 비교·응답 양쪽에서 둘 다 지운다
// (Worker_수정요청.md ① — "^도 함께 지워야 합니다").
const 정규화 = w => String(w).replace(/[-^]/g, '').trim();

// word 문자열 중간에 가능한 모든 위치에 붙임표를 끼운 변형 목록(2~6글자 한글만).
// 종전엔 이 일을 클라이언트(wchain/js/국어원.js의 붙임표_변형)가 했다 — 단어 하나 확인에 최대
// 5회 왕복(브라우저→Worker→오픈API)이 났다. Worker가 대신 하면 왕복이 1홉(Worker→오픈API)으로
// 줄어 훨씬 빠르다. 클라이언트 쪽 폴백은 안전망으로 당분간 남겨 둔다(이 Worker가 실배포·검증되면
// 걷어내도 된다).
function 붙임표_변형(word){
  if(!/^[가-힣]{2,6}$/.test(word)) return [];
  const 변형 = [];
  for(let i = 1; i < word.length; i++) 변형.push(word.slice(0, i) + '-' + word.slice(i));
  return 변형;
}

// ── 오픈API 호출 ───────────────────────────────────────────────────────
async function 오픈API_검색(env, { q, method, start = 1, num = 10 }){
  const url = new URL(국어원_API_기준주소);
  url.searchParams.set('key', env.URIMALSAEM_KEY);
  url.searchParams.set('q', q);
  url.searchParams.set('req_type', 'json');
  url.searchParams.set('advanced', 'y');
  url.searchParams.set('method', method);   // exact | start | end
  url.searchParams.set('target', '1');      // 1 = 표제어 검색
  url.searchParams.set('start', String(start));
  url.searchParams.set('num', String(num));

  const res = await fetch(url.toString());
  if(!res.ok) throw new Error('오픈API HTTP ' + res.status);
  const data = await res.json();
  const channel = data && data.channel;
  const items = (channel && Array.isArray(channel.item)) ? channel.item : [];
  const total = channel ? Number(channel.total) || 0 : 0;
  return { items, total };
}

// ── ① 단어 존재 여부 ───────────────────────────────────────────────────
// method=exact는 opendict 자체가 문자열을 정확 비교하므로, 붙여 쓴 입력("가마솥")으로는
// 붙임표 표제어("가마-솥")를 찾지 못한다. 원본 그대로 먼저 시도하고, 못 찾으면 가능한 위치에
// 붙임표를 끼운 변형을 **병렬로** 전부 시도한다(직렬이면 변형 수만큼 왕복이 쌓인다).
async function 단어존재조회(env, word){
  const 시도할것 = [word, ...붙임표_변형(word)];
  const 결과들 = await Promise.all(
    시도할것.map(w => 오픈API_검색(env, { q: w, method: 'exact', num: 1 })
      .catch(() => ({ items: [], total: 0 }))));   // 개별 실패는 "없음"으로 취급, 전체는 아래서 판단

  // 하나라도 정규화 일치하는 표제어를 찾으면 존재.
  for(const { items } of 결과들){
    if(items.some(it => 정규화(it.word) === 정규화(word))) return true;
  }
  return false;
}

// ── ② 후보 목록(글자로 시작/끝나는 단어) ───────────────────────────────
// 종전 결함: num이 기본값(10)에 머물러 있었고, 붙임표 든 표제어를 필터링 없이 정규화도 안 하고
// 그대로 버려서(또는 그대로 내보내서 클라이언트 판정이 깨져서) '사' 같은 흔한 글자도 후보가
// 2개뿐이었다. num을 크게 올리고, 필요하면 다음 페이지까지 병렬로 받는다.
const 후보_페이지당개수 = 100;
const 후보_최대페이지 = 3;   // 최대 300개. 페이지 수를 늘리면 후보는 늘지만 왕복도 늘어난다.

async function 후보목록조회(env, 글자, 방향){
  const method = 방향 === 'end' ? 'end' : 'start';

  // 총 개수를 먼저 몰라도 병렬로 여러 페이지를 쏘고, 빈 페이지는 버린다(총량이 페이지당개수보다
  // 적으면 뒤 페이지는 자연히 빈 배열로 온다 — 오픈API가 범위를 벗어난 start를 에러 없이
  // 빈 결과로 돌려주는 걸 전제. 혹시 에러를 낸다면 개별 catch가 빈 배열로 흡수한다).
  const 페이지들 = await Promise.all(
    Array.from({ length: 후보_최대페이지 }, (_, i) => i)
      .map(i => 오픈API_검색(env, {
        q: 글자, method, start: 1 + i * 후보_페이지당개수, num: 후보_페이지당개수,
      }).catch(() => ({ items: [], total: 0 })))
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
      //   · 한 글자짜리는 게임 규칙상 의미가 없다(원본도 필터링).
      //   · 한글이 아닌 문자(로마자 표기 등)가 섞인 표제어는 제외.
      if(!정리됨 || 정리됨.includes(' ')) continue;
      if(정리됨.length < 2) continue;
      if(!/^[가-힣]+$/.test(정리됨)) continue;
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
      // CORS 프리플라이트를 못 넣는 curl 등 서버 간 호출은 여기서 막힌다 — 의도된 동작
      // (관리자님이 curl로 점검할 때는 Origin 헤더 없이도 도달은 하되, 브라우저가 아니므로
      //  응답 자체는 받되 CORS 헤더가 'null'이라 실제 사이트에서는 못 쓴다는 뜻).
      return json응답({ error: '허용되지 않은 origin' }, 403, origin);
    }
    if(request.method !== 'POST'){
      return json응답({ error: 'POST만 허용됩니다.' }, 405, origin);
    }
    if(!env.URIMALSAEM_KEY){
      return json응답({ error: '서버 설정 오류: URIMALSAEM_KEY 미등록' }, 500, origin);
    }

    let payload;
    try{ payload = await request.json(); }
    catch(e){ return json응답({ error: '잘못된 JSON' }, 400, origin); }

    try{
      if(typeof payload.단어 === 'string' && payload.단어.trim()){
        const 존재 = await 단어존재조회(env, payload.단어.trim());
        return json응답({ 존재 }, 200, origin);
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

// '잇는' — 우리말샘(국립국어원 오픈API) 프록시 Worker (2026-07-29 정정판)
//
// wchain/Worker_수정요청.md에 정리된 결함(①붙임표 오판 ②후보 부족)을 반영한 구현.
// 배포 방법은 이 폴더의 README.md 참조.
//
// ⚠️ 2026-07-29 정정: 첫 버전에서 URIMALSAEM_CERTKEY_NO를 빼먹었었다. 압축 이전 대화 기록을
// 뒤져 확인한 결과, 이 API는 key 하나만으로는 안 되고 **certkey_no를 함께 보내야** 정상 응답한다
// (예전 세션이 서브에이전트로 국립국어원 공식 문서 원문을 직접 읽어 확인했고, 그 구조로 실제
// "필연" 단어 뜻풀이 응답까지 받아 검증했던 코드가 있었다 — 이 파일은 그 검증된 구조를 기준으로
// 삼고, 이번 점검에서 찾은 결함만 얹었다). Cloudflare에 이미 등록된 두 시크릿(URIMALSAEM_KEY·
// URIMALSAEM_CERTKEY_NO)을 그대로 재사용한다 — 새로 등록할 것 없음.
//
// 클라이언트(wchain/js/국어원.js)와의 계약 — 이 형태는 바꾸지 말 것(바꾸면 클라이언트도 함께 고쳐야 함):
//   요청  POST { 단어: "가마솥" }              → 응답 { 존재: true|false }
//   요청  POST { 글자: "가", 방향: "start"|"end" } → 응답 { 후보: ["가나다", ...] }
//   실패 시 4xx/5xx만 반환하면 된다 — 클라이언트는 res.ok가 아니면 null로 강등해 로컬 안전망을 탄다.
//
// (CLAUDE.md 원칙: "API 키는 Cloudflare Workers만, 프론트 노출 금지" — 이 파일에 키를 직접 적지 말 것.)

const 국어원_API_기준주소 = 'https://opendict.korean.go.kr/api/search';

// opendict가 User-Agent 없는 요청을 걸러내는 사례가 있어(예전 검증된 코드에 이미 포함돼 있던
// 방어) 그대로 유지한다 — 지워서 다시 막힐 이유가 없다.
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
//
// ⚠️ 예전 코드는 이 항목들을 정규화하지 않고 **통째로 버렸다**(`if (w.includes('-') || ...)
// continue`). num=100으로 넉넉히 받아도, '사'처럼 흔한 글자는 받은 100건 중 대부분이 합성어라
// 필터에 걸려 사라져 실제로는 2개만 남았다 — Worker_수정요청.md ②의 정확한 원인. 이번엔 버리지
// 않고 정규화해서 그대로 후보에 포함한다.
const 정규화 = w => String(w).replace(/[-^]/g, '').trim();

// word 문자열 중간에 가능한 모든 위치에 붙임표를 끼운 변형 목록(2~6글자 한글만).
// 종전엔 이 일을 클라이언트(wchain/js/국어원.js의 붙임표_변형)가 했다 — 단어 하나 확인에 최대
// 5회 왕복(브라우저→Worker→오픈API)이 났다. Worker가 대신 하면 왕복이 1홉(Worker→오픈API)으로
// 줄어 훨씬 빠르다. 클라이언트 쪽 폴백은 안전망으로 당분간 남겨 둔다.
function 붙임표_변형(word){
  if(!/^[가-힣]{2,6}$/.test(word)) return [];
  const 변형 = [];
  for(let i = 1; i < word.length; i++) 변형.push(word.slice(0, i) + '-' + word.slice(i));
  return 변형;
}

// ── 오픈API 호출 ───────────────────────────────────────────────────────
// key·certkey_no 둘 다 필수(위 2026-07-29 정정 주석 참조).
//
// ⚠️ 2026-07-29 정정 2: 시크릿점검 결과 URIMALSAEM_KEY 길이가 33자였다(정상 32자 — 1글자
// 초과). Cloudflare Secret 입력창에 복사할 때 끝에 공백·줄바꿈이 한 글자 딸려 들어가면 흔히
// 이렇게 된다 — 예전 검증된 코드도 실제로 .trim()을 걸어 뒀었는데(압축 이전 대화 기록 확인),
// 이번에 새로 짜면서 빠뜨렸다. 문자열 그대로 비교하는 API라 공백 한 칸도 "등록 안 된 키"가 된다.
function 다듬기(v){ return String(v || '').trim(); }

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
  const 원문 = await res.text();
  // ⚠️ 임시 디버그(2026-07-29, 원인 확인용 — 확인되면 지울 것): HTTP 상태·JSON 파싱·API 자체
  // 에러(응답은 200인데 본문에 {error:{...}}를 담는 관공서 API 흔한 패턴) 세 갈래를 전부
  // Error 객체에 실어 올린다. 응답 본문 앞부분만 담으므로 요청 URL의 key 값 자체는 안 실린다.
  if(!res.ok){
    const err = new Error('HTTP ' + res.status);
    err._디버그 = { 단계: 'http', 상태: res.status, 본문: 원문.slice(0, 300) };
    throw err;
  }
  let data;
  try{ data = JSON.parse(원문); }
  catch(e){
    const err = new Error('JSON 파싱 실패');
    err._디버그 = { 단계: 'json파싱', 본문: 원문.slice(0, 300) };
    throw err;
  }
  if(data && data.error){
    const err = new Error('오픈API 에러 응답');
    err._디버그 = { 단계: 'api오류', 오류: data.error };
    throw err;
  }
  const channel = data && data.channel;
  const items = (channel && Array.isArray(channel.item)) ? channel.item : [];
  return { items };
}

// ── ① 단어 존재 여부 ───────────────────────────────────────────────────
// advanced=y&target=1&method=exact — "자세히 찾기" 모드로 정확 일치만 받는다(기본 검색은
// 부분/포함 일치라 관련 없는 단어까지 섞여 존재 판정이 느슨해질 수 있어 이쪽을 쓴다).
// method=exact는 opendict 자체가 문자열을 정확 비교하므로, 붙여 쓴 입력("가마솥")으로는
// 붙임표 표제어("가마-솥")를 찾지 못한다. 원본 그대로 먼저 시도하고, 못 찾으면 가능한 위치에
// 붙임표를 끼운 변형을 **병렬로** 전부 시도한다(직렬이면 변형 수만큼 왕복이 쌓인다).
//
// 디버그=true면 catch로 삼키지 않고 **원본 실패의 상세**를 그대로 위로 던진다(진단용, 임시).
//
// ⚠️ 2026-08-15 정정 3: num=1로 불렀더니 "103 Invalid num value"로 거부됐다(후보 조회의
// num=100은 정상 동작 확인됨 — '사' 글자로 107건 수신). 예전 검증된 코드도 단어 조회엔
// num=20을 썼지 1을 쓴 적이 없었다 — 이 API가 num에 최솟값 제약을 두는 것으로 보인다.
// 존재 확인은 어차피 "1건이라도 있는가"만 보면 되므로 값 자체는 안 써도 되지만, 유효한
// 범위 안의 값을 보내야 하므로 예전과 같은 20으로 맞춘다.
async function 단어존재조회(env, word, 디버그 = false){
  const 시도할것 = [word, ...붙임표_변형(word)];
  const 결과들 = await Promise.all(
    시도할것.map(w => 오픈API_검색(env, { q: w, advanced: true, target: 1, method: 'exact', num: 20 })
      .catch(e => { if(디버그) throw e; return { items: [] }; })));

  for(const { items } of 결과들){
    if(items.some(it => 정규화(it.word) === 정규화(word))) return true;
  }
  return false;
}

// ── ② 후보 목록(글자로 시작/끝나는 단어) ───────────────────────────────
// advanced=y&target=1&method=start|end — "이 글자로 시작/끝나는 단어" 전방/후방 일치.
// num=100(예전과 동일) + 필요하면 다음 페이지까지 병렬로 받는다. 붙임표 든 표제어는
// 버리지 않고 정규화해서 포함한다(위 "정규화" 주석 — 후보 부족의 실제 원인 수정).
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

    // ⚠️ 임시 디버그 스위치(2026-07-29): payload.디버그===true면 실패를 삼키지 않고 원인을
    // 응답에 그대로 담는다. 원인을 확인하면 이 스위치와 관련 코드를 전부 지울 것.
    const 디버그 = payload.디버그 === true;

    // payload.시크릿점검===true면 (1) 등록된 두 시크릿의 **길이만**(값은 절대 안 보냄) 알려주고,
    // (2) 두 값을 서로 바꿔서 실제로 API를 한 번 호출해 "바뀌어 등록됐다"는 가설을 직접 검증한다
    // — 정황(길이)만 보고 끝내지 않고 실증까지 한 번에 끝내서 재배포를 왕복하지 않기 위함.
    if(payload.시크릿점검 === true){
      const 정방향_실패 = await 오픈API_검색(env,
        { q: '가', advanced: true, target: 1, method: 'exact', num: 20 })
        .then(() => null).catch(e => e._디버그 || String(e));

      const 바뀐env = { URIMALSAEM_KEY: env.URIMALSAEM_CERTKEY_NO, URIMALSAEM_CERTKEY_NO: env.URIMALSAEM_KEY };
      const 역방향_실패 = await 오픈API_검색(바뀐env,
        { q: '가', advanced: true, target: 1, method: 'exact', num: 20 })
        .then(() => null).catch(e => e._디버그 || String(e));

      return json응답({
        URIMALSAEM_KEY_길이: (env.URIMALSAEM_KEY || '').length,
        URIMALSAEM_KEY_다듬은_길이: 다듬기(env.URIMALSAEM_KEY).length,
        URIMALSAEM_CERTKEY_NO_길이: (env.URIMALSAEM_CERTKEY_NO || '').length,
        참고: 'key는 보통 32자(16진수), certkey_no는 보통 5자 안팎(숫자). 원래 길이와 다듬은 길이가'
            + ' 다르면 앞뒤 공백/줄바꿈이 섞여 있던 것(이제 검색 호출 자체는 다듬어서 보냄).',
        정방향_현재등록순서_결과: 정방향_실패 ? { 실패: 정방향_실패 } : { 성공: true },
        역방향_뒤바꿔본_결과: 역방향_실패 ? { 실패: 역방향_실패 } : { 성공: true },
        결론: !정방향_실패 ? '현재 등록 순서가 맞습니다(성공)'
             : !역방향_실패 ? '두 값이 서로 바뀌어 등록돼 있었습니다 — 대시보드에서 이름을 맞바꿔 주세요'
             : '둘 다 실패 — 순서 문제가 아니라 값 자체가 잘못됐을 가능성(오탈자·만료 등)',
      }, 200, origin);
    }

    try{
      if(typeof payload.단어 === 'string' && payload.단어.trim()){
        const 존재 = await 단어존재조회(env, payload.단어.trim(), 디버그);
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
      if(디버그) return json응답({ error: '오픈API 호출 실패', 디버그: e._디버그 || String(e) }, 502, origin);
      return json응답({ error: '오픈API 호출 실패' }, 502, origin);
    }
  },
};

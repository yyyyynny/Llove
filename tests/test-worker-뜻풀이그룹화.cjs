// 우리말샘 Worker(wchain/worker/우리말샘-worker.mjs)의 뜻풀이 동음이의어 그룹화 회귀 테스트.
// ─────────────────────────────────────────────────────────────────────────
// Worker는 Cloudflare 환경 전용(export default { fetch }) 이라 jsdom·node로 그대로
// require할 수 없다. export default 뒤(진입점)를 잘라내고 순수 함수 부분만 eval해서
// 검증한다 — 다른 테스트가 못 건드리는 "실측 후 로직 자체가 맞는지"를 커버한다.
//
// 2026-08-19 3차 수정(관리자님 승인) 검증:
//   · 한자어 동음이의어(필연=必然/筆硯) — sense.origin 기준, view API 호출 없이 그룹화.
//   · 순우리말 동음이의어(눈=眼/雪 등) — sense.origin이 없으면 opendict view API로
//     group_code(다의어 번호)를 물어 그룹을 나눈다. 병렬·개수 상한(6)·조회 실패 시 고립.
const fs = require('fs');
const path = require('path');
const { makeHarness } = require('./load.cjs');

const { assert, finish } = makeHarness('Worker 뜻풀이 동음이의어 그룹화');

const WORKER_PATH = path.join(__dirname, '..', 'wchain', 'worker', '우리말샘-worker.mjs');
const src = fs.readFileSync(WORKER_PATH, 'utf8');
// export default { ... } 진입점(Cloudflare 전용 fetch 핸들러) 앞까지만 잘라 순수 함수만 로드.
const 함수부 = src.split('// ── 진입점')[0];
// eslint 등 없이 그대로 eval — 이 스코프의 const 선언들이 이 함수 안에서만 보이므로
// new Function으로 감싸 필요한 함수를 반환받는다(전역 오염 방지).
const 로드됨 = new Function(`
  ${함수부}
  return { 뜻풀이_그룹화_비동기, 오픈API_뷰 };
`)();
const { 뜻풀이_그룹화_비동기 } = 로드됨;

const ENV = { URIMALSAEM_KEY: 'test-key', URIMALSAEM_CERTKEY_NO: 'test-certkey' };

async function main() {
  // (1) 한자어 동음이의어 — origin으로 갈리고, view API는 호출되지 않아야 한다(비용 없음).
  {
    global.fetch = async () => { throw new Error('origin 케이스에서는 view가 호출되면 안 됨'); };
    const 필연 = [
      { word: '필연', sense: [{ definition: '사물의 관련이나 일의 결과가 반드시 그렇게 될 수밖에 없음.', origin: '必然', target_code: '549241' }] },
      { word: '필연', sense: [{ definition: '틀림없이 꼭.', origin: '必然', target_code: '475795' }] },
      { word: '필연', sense: [{ definition: '붓과 벼루를 아울러 이르는 말.', origin: '筆硯', target_code: '365461' }] },
    ];
    const 결과 = await 뜻풀이_그룹화_비동기(ENV, 필연);
    assert('필연: 2그룹(必然/筆硯)으로 갈림', 결과.length === 2, JSON.stringify(결과));
    assert('필연: 1그룹에 必然의 뜻 2개가 모임',
      결과[0].뜻풀이.length === 2 && 결과[0].뜻풀이.includes('틀림없이 꼭.'));
    assert('필연: 2그룹에 筆硯의 뜻 1개만',
      결과[1].뜻풀이.length === 1 && 결과[1].뜻풀이[0].includes('붓과 벼루'));
  }

  // (2) 순우리말 동음이의어 — origin 없음, view API의 group_code로 분리돼야 한다.
  {
    const viewMap = { A: { group_code: '1' }, B: { group_code: '1' }, C: { group_code: '2' } };
    const 조회된target = [];
    global.fetch = async (url) => {
      const tc = new URL(url).searchParams.get('q');
      조회된target.push(tc);
      return { ok: true, text: async () => JSON.stringify({ channel: { item: viewMap[tc] || null } }) };
    };
    const 눈 = [
      { word: '눈', sense: [{ definition: '눈 뜻1(안구)', target_code: 'A' }] },
      { word: '눈', sense: [{ definition: '눈 뜻2(안구 관련)', target_code: 'B' }] },
      { word: '눈', sense: [{ definition: '눈 뜻3(날씨)', target_code: 'C' }] },
    ];
    const 결과 = await 뜻풀이_그룹화_비동기(ENV, 눈);
    assert('눈: group_code 기준 2그룹으로 갈림', 결과.length === 2, JSON.stringify(결과));
    assert('눈: 같은 group_code(A·B)는 한 그룹에 모임',
      결과.some(g => g.뜻풀이.includes('눈 뜻1(안구)') && g.뜻풀이.includes('눈 뜻2(안구 관련)')));
    assert('눈: 다른 group_code(C)는 별도 그룹', 결과.some(g => g.뜻풀이.length === 1 && g.뜻풀이[0].includes('날씨')));
    assert('눈: 조회 대상 target_code 3개 모두 병렬 조회됨',
      new Set(조회된target).size === 3, 조회된target.join(','));
  }

  // (3) 개수 상한 초과 — view를 아예 호출하지 않고 안전하게 1그룹으로 합친다.
  {
    global.fetch = async () => { throw new Error('상한 초과 시 view가 호출되면 안 됨'); };
    const 많은뜻 = Array.from({ length: 8 }, (_, i) =>
      ({ word: '많은말', sense: [{ definition: '뜻' + i, target_code: 'T' + i }] }));
    const 결과 = await 뜻풀이_그룹화_비동기(ENV, 많은뜻);
    assert('상한(6) 초과 시 view 호출 없이 1그룹으로 폴백', 결과.length === 1 && 결과[0].뜻풀이.length === 8);
  }

  // (4) view 조회 일부 실패 — 실패한 것은 다른 그룹과 잘못 합쳐지지 않고 고립된다.
  {
    global.fetch = async (url) => {
      const tc = new URL(url).searchParams.get('q');
      if (tc === 'FAIL') throw new Error('네트워크 실패(스텁)');
      return { ok: true, text: async () => JSON.stringify({ channel: { item: { group_code: '9' } } }) };
    };
    const 배 = [
      { word: '배', sense: [{ definition: '배 뜻1', target_code: 'OK1' }] },
      { word: '배', sense: [{ definition: '배 뜻2', target_code: 'OK2' }] },
      { word: '배', sense: [{ definition: '배 뜻3(조회실패)', target_code: 'FAIL' }] },
    ];
    const 결과 = await 뜻풀이_그룹화_비동기(ENV, 배);
    assert('조회 실패한 뜻은 성공한 것들과 합쳐지지 않고 고립됨',
      결과.length === 2 && 결과.some(g => g.뜻풀이.length === 1 && g.뜻풀이[0].includes('조회실패')),
      JSON.stringify(결과));
  }

  // (5) 어원 없는 뜻이 1개뿐이면 나눌 대상이 없으니 view를 호출하지 않는다.
  {
    global.fetch = async () => { throw new Error('뜻이 1개뿐이면 view가 호출되면 안 됨'); };
    const 단일 = [{ word: '외톨말', sense: [{ definition: '뜻 하나뿐', target_code: 'ONLY' }] }];
    const 결과 = await 뜻풀이_그룹화_비동기(ENV, 단일);
    assert('어원 없는 뜻 1개는 view 호출 없이 그대로 1그룹', 결과.length === 1 && 결과[0].뜻풀이.length === 1);
  }

  process.exit(finish() > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

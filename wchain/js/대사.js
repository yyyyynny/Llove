// '잇는' 페르소나 대사 — 코드에서 분리해 data/대사.json 한 곳으로 모음 (2026-07-29, 관리자님 지시).
//
// 종전에는 `say(gs, '폭군 대사', '비서 대사')` 형태로 62곳에 인라인으로 흩어져 있어, 대사를 고치려면
// 로직 파일을 열어 문자열을 찾아 헤매야 했다. 이제 문구는 전부 data/대사.json에 있고 코드는 키만
// 참조한다 — **대사 추가·수정은 JSON만 건드리면 된다**(관리자님이 이후 차수에 직접 작업 예정).
//
// JSON 구조:
//   { "키": { "폭군": "...", "비서": "..." }, ... }
// 키는 그 대사가 쓰이는 함수 이름 + 순번(예: user_defeat_1, 버튼_양보_1)이라 코드에서 역추적된다.
//
// 자리표시자: 중괄호. 두 가지를 모두 지원한다.
//   · 위치형 {0} {1}  → 대사(gs, '키', [값0, 값1])
//   · 이름형 {칭호}   → 대사(gs, '키', {칭호: title(gs)})
// 이름형은 폭군·비서가 서로 다른 값을 참조하는 대사(한쪽만 칭호를 쓰는 등)를 위해 둔다.
//
// say(gs, a, b)는 게임상태.js에 그대로 남겨 둔다 — 파이썬 원본과의 대조 기준 함수라 지우지 않는다.
//
// 클래식 스크립트. 게임상태.js(is_arrogant) 뒤, 게임규칙.js·서바이벌.js보다 먼저 로드.

let 대사표 = {};
let 대사_적재됨 = false;

// data/대사.json 적재. index.html의 부트스트랩이 await로 기다린다.
// 실패해도 게임이 멈추지는 않게 하되, 조용히 넘어가면 화면이 텅 비므로 반드시 표면화한다.
async function 대사_로드(){
  try{
    const res = await fetch('data/대사.json');
    if(!res.ok) throw new Error('HTTP ' + res.status);
    대사표 = await res.json();
    대사_적재됨 = true;
  }catch(e){
    console.error('[대사] data/대사.json 적재 실패 — 대사가 키 이름으로 표시됩니다.', e);
    대사_적재됨 = false;
  }
  return 대사_적재됨;
}

// 키로 페르소나에 맞는 문구를 꺼내 자리표시자를 채운다.
// 값이 없으면(키 오타·적재 실패) 키 이름을 그대로 돌려줘 화면이 비지 않고 어디가 빠졌는지 보이게 한다.
function 대사(gs, 키, 값){
  const 항목 = 대사표[키];
  if(!항목){
    console.warn('[대사] 키 없음:', 키);
    return `[대사 없음: ${키}]`;
  }
  const 문구 = is_arrogant(gs) ? 항목.폭군 : 항목.비서;
  if(값 === undefined || 값 === null) return 문구;
  return String(문구).replace(/\{([^{}]+)\}/g, (전체, 이름) => {
    // 위치형이면 배열 인덱스, 이름형이면 객체 키
    const v = Array.isArray(값) ? 값[Number(이름)] : 값[이름];
    return v === undefined ? 전체 : String(v);
  });
}

if (typeof module !== 'undefined') module.exports = { 대사_로드, 대사, get 대사표(){ return 대사표; } };

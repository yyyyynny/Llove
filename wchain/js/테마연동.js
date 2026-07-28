// '잇는' — Llove 테마 연동 (2026-07-29, 관리자님 지시)
//
// "공유는 기본 설정이 아니라 토글을 마련해서, 누르면 Llove의 현재 테마와 연동되도록 하고
//  기본적으로는 따로 구분을 할 수 있도록"
//
// 기본값은 **꺼짐** — 잇는은 자체 다크 팔레트(index.html의 :root)를 쓴다. 이세계는 학습 세계와
// 구분되는 게 맞다는 관리자님 판단. 토글을 켜면 Llove가 저장해 둔 테마를 그대로 따라간다.
//
// 어떻게 통신 없이 되는가: Llove와 wchain은 같은 GitHub Pages 도메인이라 localStorage를 공유한다.
// Llove의 setTheme()(Llove/js/테마.js)이 `plx_테마`에, 커스텀 테마 에디터가 `plx_커스텀`에
// 저장해 둔 값을 그대로 읽으면 된다. 우리는 **읽기만 하고 쓰지 않는다** — 잇는에서 조작해
// Llove 쪽 설정이 바뀌는 일은 없어야 한다.
//
// 클래식 스크립트. 서바이벌.js보다 먼저 로드(설정 화면이 이 함수들을 부른다).

const 테마연동_KEY = 'plx_잇는_테마연동';
const LLOVE_테마_KEY = 'plx_테마';
const LLOVE_커스텀_KEY = 'plx_커스텀';

// 각 테마의 배경색 — 모바일 주소창 색(<meta name="theme-color">)을 맞추는 데 쓴다.
// index.html의 테마 블록 --bg 값과 같아야 한다.
const 테마_배경색 = {
  잇는: '#0e1016', antique: '#111009', navy: '#080d18',
  midnight: '#08060f', paper: '#ede8df', forest: '#060c08',
};

function 테마연동_켜짐(){
  try{ return localStorage.getItem(테마연동_KEY) === '1'; }
  catch(e){ return false; }   // localStorage 차단 환경 — 기본(잇는 테마)
}

// Llove가 저장해 둔 테마 이름. 없거나 읽을 수 없으면 null.
function Llove_테마이름(){
  try{ return localStorage.getItem(LLOVE_테마_KEY); }
  catch(e){ return null; }
}

// 커스텀 테마는 Llove가 raw 4색(bg/card/acc/txt)을 저장해 둔다 —
// index.html의 [data-theme="custom"] 블록이 --c-* 를 참조해 나머지를 파생시킨다.
function 커스텀색_적용(){
  try{
    const 색 = JSON.parse(localStorage.getItem(LLOVE_커스텀_KEY) || 'null');
    if(!색 || !색.bg) return false;
    const r = document.documentElement.style;
    r.setProperty('--c-bg', 색.bg);
    r.setProperty('--c-card', 색.card);
    r.setProperty('--c-acc', 색.acc);
    r.setProperty('--c-txt', 색.txt);
    return true;
  }catch(e){ return false; }
}

// 현재 설정에 맞는 테마를 화면에 적용한다. 부팅 시와 토글 조작 시 모두 이 함수를 부른다.
function 테마_적용(){
  const 연동 = 테마연동_켜짐();
  let 이름 = '잇는';
  if(연동){
    const l = Llove_테마이름();
    // Llove에서 아직 테마를 고른 적이 없으면(신규 사용자) 연동해도 따라갈 값이 없다 →
    // 잇는 기본 테마를 그대로 쓴다(빈 화면·깨진 색이 되지 않게).
    if(l){
      이름 = l;
      if(l === 'custom' && !커스텀색_적용()) 이름 = '잇는';   // 커스텀인데 색 정보가 없으면 폴백
    }
  }
  // 잇는 기본은 :root가 담당하므로 data-theme을 아예 붙이지 않는다.
  if(이름 === '잇는') document.body.removeAttribute('data-theme');
  else document.body.setAttribute('data-theme', 이름);

  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', 테마_배경색[이름] || 테마_배경색.잇는);
  return 이름;
}

// 설정 화면 토글이 부른다.
function 테마연동_설정(켬){
  try{ localStorage.setItem(테마연동_KEY, 켬 ? '1' : '0'); }
  catch(e){ /* 차단 환경 — 이번 세션에만 적용된다 */ }
  return 테마_적용();
}

// 설정 화면에 보여줄 현재 상태 설명
function 테마연동_설명(){
  if(!테마연동_켜짐()) return '잇는 고유 테마를 사용합니다 (학습 세계와 구분)';
  const l = Llove_테마이름();
  if(!l) return 'Llove에서 아직 테마를 고른 적이 없어 잇는 기본 테마로 표시됩니다';
  const 표시 = { antique:'고서', navy:'네이비', midnight:'미드나이트',
                paper:'페이퍼', forest:'포레스트', custom:'커스텀' }[l] || l;
  return `Llove의 현재 테마(${표시})를 따릅니다`;
}

if (typeof module !== 'undefined') module.exports = {
  테마연동_켜짐, 테마_적용, 테마연동_설정, 테마연동_설명, 테마연동_KEY
};

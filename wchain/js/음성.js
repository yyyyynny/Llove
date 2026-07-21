// '잇는' — 콜롬비나 음성(TTS) 배선 (Phase 6)
// Llove의 콜롬비나 음성 봉인 골격(js/grok.js · docs/음성생성_봉인골격.md)과 동일한 패턴이지만,
// wchain은 Llove의 js/grok.js를 직접 로드하지 않는다(별도 앱, DOM·상태가 다름) — 그래서 게이트와
// 호출 로직만 이 파일에 독립적으로 새로 둔다(js/국어원.js가 GROK_활성화를 그대로 복제하지 않고
// 국어원_활성화를 독립 게이트로 새로 만든 것과 같은 선례). Llove의 음성생성_활성화와 이 파일의
// 음성생성_활성화는 서로 다른 변수(각자 다른 스크립트 스코프)이며 **둘 다 기본 false**다.
//
// 용도: 서바이벌 모드에서 AI가 말한 단어를 관리자님의 콜롬비나 TTS 서버로 보내 음성으로 재생.
// 서버는 아직 없음(GPU 서버 준비는 별도 인프라 작업) — 여기서는 게이트 뒤 호출부 배선만 완료한다.
//
// 클래식 스크립트. js/국어원.js 다음, js/서바이벌.js 이전에 로드(호출부가 서바이벌.js에 있으므로).

// ⚠️ 음성 게이트 — 최고 관리자님 승인 없이 true로 변경 금지 (Llove 음성생성_활성화와 동일 정책).
//    GPU 서버 준비 전까지 실호출 전면 봉인. false인 동안 음성생성호출()은 fetch 자체를 하지 않는다.
const 음성생성_활성화 = false;

// 콜롬비나 TTS 서버 주소. Llove 설정 패널에서 관리자님이 입력해 Firestore 사용자 문서의
// 음성엔드포인트 필드에 저장한 값을 js/연동.js가 읽어와 채운다(여기서는 코드에 주소를 두지 않음).
let 음성엔드포인트 = '';

// 텍스트(단어) → 외부 음성 서버 → 음성 데이터(Blob). 봉인/미설정 시 fetch 없이 null.
async function 음성생성호출(텍스트){
  if(!음성생성_활성화){
    console.warn('[음성] 봉인 상태(음성생성_활성화=false) — 호출 차단');
    return null;
  }
  if(!음성엔드포인트){
    console.warn('[음성] 엔드포인트 미설정 — 호출 불가');
    return null;
  }
  const 보낼텍스트 = (텍스트 || '').trim();
  if(!보낼텍스트) return null;
  try{
    const res = await fetch(음성엔드포인트, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ 텍스트: 보낼텍스트 })
    });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    return await res.blob();
  }catch(e){
    console.error('[음성] 생성 실패', e);
    return null;
  }
}

// 음성 재생 — Blob 또는 URL 문자열 모두 허용 (Llove 음성재생과 동일 시그니처).
function 음성재생(소스){
  try{
    let url = 소스;
    if(소스 && typeof 소스 !== 'string'){
      url = (window.URL && URL.createObjectURL) ? URL.createObjectURL(소스) : 소스;
    }
    const audio = new Audio(url);
    const p = audio.play();
    if(p && p.catch) p.catch(e=> console.warn('[음성] 재생 차단/실패', e));
    return audio;
  }catch(e){
    console.error('[음성] 재생 오류', e);
    return null;
  }
}

if (typeof module !== 'undefined') module.exports = { 음성생성호출, 음성재생 };

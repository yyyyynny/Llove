// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Grok 연동 준비 (KNOWLEDGE 4-1·5·32) — Cloudflare Workers 프록시 경유
   - API 키는 프론트에 두지 않음 (Workers에서만 관리)
   - Workers 엔드포인트는 추후 생성 후 아래 상수에 입력 (현재 미생성)
   - reasoning_effort는 기능별 레벨 적용 (KNOWLEDGE 4-1)
   ⚠️ 실제 기능(문제 생성·질문하기·이의있음 등) 연결은 엔드포인트 확정 후 진행
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// Cloudflare Workers 엔드포인트 (xAI/Grok 프록시). xAI API 키는 Workers에서만 관리 — 프론트 미노출.
const GROK_WORKERS_ENDPOINT = 'https://xai-api-llove.hypoqwer.workers.dev';

// ⚠️ Grok 게이트 (최고 관리자님 지시 — 2026-06-10)
//    xAI 크레딧 미구매 상태이므로 실호출 전면 봉인. 모든 기능은 이 플래그를 먼저 확인하며,
//    false인 동안에는 grok호출()이 절대 실행되지 않고 토큰도 차감하지 않는다.
//    크레딧 구매 후 이 값만 true로 바꾸면 연결 지점(질문하기·이의있음·구어교정·출제분기)이 활성화된다.
const GROK_활성화 = false;

// 기능별 리즈닝 레벨 (KNOWLEDGE 4-1섹션)
const GROK_리즈닝레벨 = {
  문제생성: 'none', 채점: 'none', 질문하기: 'low',
  사고전개: 'high', 구어교정: 'medium', 이의있음: 'high'
};

// Grok 호출 — Workers로 프록시. 기능명에 따라 reasoning_effort 적용.
async function grok호출(기능명, payload){
  if(!GROK_활성화){
    // 게이트 봉인 상태 — 어떤 경우에도 네트워크 호출하지 않음 (크레딧 미구매)
    console.warn('[Grok] 게이트 봉인(GROK_활성화=false) — 호출 차단:', 기능명);
    return null;
  }
  if(!GROK_WORKERS_ENDPOINT){
    console.error('[Grok] Workers 엔드포인트 미설정 — 호출 불가');
    return null;
  }
  try{
    const res = await fetch(GROK_WORKERS_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        기능: 기능명,
        reasoning_effort: GROK_리즈닝레벨[기능명] ?? 'none',
        지침: 사용자.AI지침 || '',   // 세션6 항목5: 사용자 통합 지침 — 전 기능 공통 전달
        ...payload
      })
    });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }catch(e){
    console.error('[Grok] 호출 실패', e);
    showToastMsg(UI_TEXT.rate_limit.문구); // KNOWLEDGE 5 rate limit 문구
    return null;
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   추가기능: 콜롬비나 음성 생성(TTS) — 창조주 전용 봉인 골격
   - 파이썬 So-VITS 모델은 외부 GPU 서버에서 돈다(브라우저·끝사용자 기기 불가).
     Llove는 텍스트를 보내고 완성된 음성만 받아 재생한다.
     끝말잇기 게임이 완성되면 음성생성호출(단어) 한 줄로 연결한다.
   ⚠️ Grok과 동일한 봉인 정책: 서버 준비 전까지 음성생성_활성화=false 유지.
      최고 관리자님 승인 없이 true로 변경 금지 (네트워크 호출·재생 전부 차단).
   - 서버 주소는 코드에 박지 않고 창조주가 설정 패널에서 입력(plx_음성엔드포인트 + Firestore).
     비밀키는 프론트·레포에 두지 않음 — 서버/Cloudflare Worker에서만 관리.
   - 모델·음성 파일은 레포에 절대 커밋하지 않음 (저작권: 호요버스 캐릭터/성우 목소리).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const 음성생성_활성화 = false;   // ⚠️ 봉인 — 승인 없이 true 금지 (서버 준비 후에만)
let 음성엔드포인트 = '';          // 창조주가 설정에서 입력 (로컬 터널 또는 클라우드 GPU 주소)

// 텍스트 → 외부 음성 서버 → 음성 데이터(Blob). 봉인/미설정 시 null 반환(호출 자체 차단).
async function 음성생성호출(텍스트){
  if(!음성생성_활성화){
    // 봉인 상태 — 어떤 경우에도 네트워크 호출하지 않음 (서버 미준비)
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
    return await res.blob();   // 서버가 audio/wav|mp3 반환
  }catch(e){
    console.error('[음성] 생성 실패', e);
    showToastMsg('음성 생성 실패 — 서버 주소·상태를 확인해 주세요');
    return null;
  }
}

// 음성 재생 — Blob 또는 URL 문자열 모두 허용 (프로젝트 최초 오디오 재생 인프라)
function 음성재생(소스){
  try{
    let url = 소스;
    if(소스 && typeof 소스 !== 'string'){
      // Blob → 객체 URL (지원 환경에서만; 미지원이면 그대로 전달)
      url = (window.URL && URL.createObjectURL) ? URL.createObjectURL(소스) : 소스;
    }
    const audio = new Audio(url);
    const p = audio.play();
    if(p && p.catch) p.catch(e=> console.warn('[음성] 재생 차단/실패', e));
    return audio;
  }catch(e){
    console.error('[음성] 재생 오류', e);
    showToastMsg('음성 재생을 시작할 수 없습니다');
    return null;
  }
}

// 로딩 표시 토글 — 절제된 점 불투명도 펄스(기존 화면 톤과 통일)
function 음성생성_로딩(켜기){
  const el = document.getElementById('음성로딩');
  const btn = document.getElementById('음성생성버튼');
  if(el) el.style.display = 켜기 ? 'flex' : 'none';
  if(btn) btn.disabled = !!켜기;
}

/* ── 창조주 전용 설정 진입점 + 테스트 벤치 ── */
// 설정 화면의 음성 생성 행 표시 갱신 — 창조주만 노출 (비창조주는 행 자체가 숨김)
function 갱신_음성설정_UI(){
  const row = document.getElementById('음성설정Row');
  if(!row) return;
  row.style.display = 사용자.창조주달성 ? 'flex' : 'none';
}
/* ━━━ 세션7 항목2: 실험실 — 예정·실험 기능 티저 (전원 노출, 항목 탭 시 티저 안내) ━━━ */
const 실험실_목록 = [
  {아이콘:'🔗', 이름:'끝말잇기', 설명:'AI 목소리와 함께하는 단어 배틀', 상태:'예정'},
  {아이콘:'🎙', 이름:'음성 생성', 설명:'단어를 캐릭터 목소리로 듣기', 상태:'실험', 열기:'음성설정_탭'},
  {아이콘:'🤖', 이름:'AI 실시간 출제', 설명:'Grok이 매번 새로운 문제를 생성', 상태:'예정'},
  {아이콘:'🧠', 이름:'사고전개 답변', 설명:'AI의 풀이 과정을 함께 보기', 상태:'예정'}
];
function 실험실_열기(){
  const 목록 = 실험실_목록.map((it,i)=>
    `<div style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid var(--bdr);cursor:pointer;text-align:left" onclick="실험실_항목탭(${i})">
      <span style="font-size:20px">${it.아이콘}</span>
      <div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--txt)">${it.이름} <span style="font-size:10px;color:${it.상태==='실험'?'var(--warn)':'var(--txt2)'};border:1px solid var(--bdr);border-radius:5px;padding:1px 5px">${it.상태}</span></div>
      <div style="font-size:11px;color:var(--txt2);margin-top:2px">${it.설명}</div></div>
      <span style="color:var(--txtm)">›</span>
    </div>`).join('');
  showInfoModal('🧪','실험실', `<div style="text-align:left;font-size:11px;color:var(--txt2);margin-bottom:6px">앞으로 추가될 기능들을 미리 소개합니다.</div>${목록}`);
}
function 실험실_항목탭(i){
  const it = 실험실_목록[i];
  if(!it) return;
  // 개발자 모드 + 연결 가능한 항목은 실제 기능으로 (예: 음성 생성 패널)
  if(사용자.개발자모드 && it.열기 && typeof window[it.열기] === 'function'){
    closeInfoModal();
    window[it.열기]();
    return;
  }
  // 티저형 문구 (최고 관리자님 확정) — 예고 + 해금 조건 안내
  showInfoModal(it.아이콘, it.이름,
    `🔒 준비 중인 기능입니다.<br>업데이트를 조금만 기다려 주세요!<br><br><span style="font-size:11px;color:var(--txt2)">개발자 모드에서는 먼저 체험할 수 있습니다.</span><br><br><button class="btn-g" style="width:100%;padding:9px" onclick="실험실_열기()">← 실험실 목록으로</button>`);
}

function 음성설정_탭(){
  if(!사용자.창조주달성){
    showInfoModal('🔒','음성 생성','[창조주] 업적을 달성하면 사용할 수 있습니다.');
    return;
  }
  음성생성패널_열기();
}
function 음성생성패널_열기(){
  const inp = document.getElementById('음성엔드포인트입력');
  if(inp) inp.value = 음성엔드포인트 || '';
  const 안내 = document.getElementById('음성봉인안내');
  if(안내) 안내.style.display = 음성생성_활성화 ? 'none' : 'block';
  음성생성_로딩(false);
  document.getElementById('음성생성Bg').classList.add('show');
}
function 음성생성패널_닫기(){
  document.getElementById('음성생성Bg').classList.remove('show');
  활성입력_blur();  // 세션5 버그9: 엔드포인트/테스트 입력 커서 잔존 방지
}
// 엔드포인트 저장/지우기 — plx_음성엔드포인트 + Firestore (setTheme 패턴)
function 음성엔드포인트_저장(){
  const inp = document.getElementById('음성엔드포인트입력');
  const 값 = (inp ? inp.value : '').trim();
  음성엔드포인트 = 값;
  try{ localStorage.setItem('plx_음성엔드포인트', 값); }catch(e){ /* localStorage 차단 환경 무시 */ }
  사용자.음성엔드포인트 = 값;
  사용자데이터_저장({음성엔드포인트: 값});  // Firestore 동기화
  // 세션7 항목4: 저장/지우기 안내 분리 — 빈 값 저장은 "삭제"가 아니라 별도 안내
  showToastMsg(값 ? '✅ 서버 주소 저장됨' : 'ℹ️ 입력된 주소가 없습니다');
}
function 음성엔드포인트_지우기(){
  const inp = document.getElementById('음성엔드포인트입력');
  if(inp) inp.value = '';
  음성엔드포인트 = '';
  try{ localStorage.setItem('plx_음성엔드포인트', ''); }catch(e){ /* 무시 */ }
  사용자.음성엔드포인트 = '';
  사용자데이터_저장({음성엔드포인트: ''});
  showToastMsg('🗑️ 서버 주소 삭제됨');  // 세션7 항목4: 지우기 전용 문구
}
// 테스트 벤치: 텍스트 → 생성 → 재생 (봉인 중엔 안내만)
async function 음성_테스트생성(){
  const ta = document.getElementById('음성테스트입력');
  const 텍스트 = (ta ? ta.value : '').trim();
  if(!텍스트){ showToastMsg('테스트 문장을 입력해 주세요'); return; }
  if(!음성생성_활성화){
    showToastMsg('🔒 음성 생성은 서버 준비 후 활성화됩니다');
    return;
  }
  if(!음성엔드포인트){ showToastMsg('서버 주소를 먼저 저장해 주세요'); return; }
  음성생성_로딩(true);
  const 데이터 = await 음성생성호출(텍스트);
  음성생성_로딩(false);
  if(데이터) 음성재생(데이터);
}

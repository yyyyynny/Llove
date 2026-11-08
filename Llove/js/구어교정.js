// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   구어 교정
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function switchSpkMode(mode){
  const 텍스트 = mode === 'text';
  document.getElementById('spkMText').classList.toggle('on', 텍스트);
  document.getElementById('spkMVoice').classList.toggle('on', !텍스트);
  document.getElementById('spkTextArea').style.display = 텍스트 ? 'block' : 'none';
  document.getElementById('spkVoiceArea').style.display = 텍스트 ? 'none' : 'block';
  if(텍스트){ 음성인식_중지(); return; }  // 텍스트 탭으로 전환 시 진행 중 인식 정리
  // 항목8: 미지원 브라우저 안내 (Firefox 등 SpeechRecognition 미구현 환경)
  if(!음성인식_지원()){
    const st=document.getElementById('spkVoiceStatus');
    const btn=document.getElementById('spkMicBtn');
    if(st) st.textContent='이 브라우저는 음성 인식을 지원하지 않아요. Chrome·Edge·Safari에서 쓰거나 글로 입력해 주세요.';
    if(btn) btn.disabled=true;
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   항목8: 구어 교정 음성 입력 (Web Speech API · SpeechRecognition)
   - 브라우저 내장 음성 인식 사용(별도 서버/키 불필요). 언어: 한국어(ko-KR).
   - 지원: Chrome·Edge(데스크톱/안드로이드), Safari(iOS 14.5+). Firefox는 미지원.
   - 제약: HTTPS(또는 localhost)에서만 동작, 마이크 권한 허용 필요, 인식 정확도는 환경 의존.
   - 인식된 최종 텍스트는 spkInput에도 반영되어 「분석하기(submitSpk)」가 그대로 동작한다.
   - 채점은 현 단계 불필요(Grok 봉인) — 입력 확보까지가 이번 구현 범위.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let 음성인식객체 = null;
let 음성인식중 = false;
let 음성인식_확정텍스트 = '';

function 음성인식_지원(){
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function 음성인식_UI갱신(){
  const btn=document.getElementById('spkMicBtn');
  const lbl=document.getElementById('spkMicLabel');
  if(!btn || !lbl) return;
  btn.classList.toggle('rec', 음성인식중);
  lbl.textContent = 음성인식중 ? '인식 중… (누르면 종료)' : '말하기 시작';
}

function 음성인식_토글(){
  if(!음성인식_지원()){
    showToastMsg('이 브라우저는 음성 인식을 지원하지 않아요');
    return;
  }
  if(음성인식중){ 음성인식_중지(); return; }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  음성인식객체 = new SR();
  음성인식객체.lang = 'ko-KR';
  음성인식객체.interimResults = true;   // 중간 결과 실시간 표시
  음성인식객체.continuous = false;       // 한 발화 단위로 인식
  음성인식객체.maxAlternatives = 1;

  음성인식_확정텍스트 = (document.getElementById('spkVoiceTranscript')?.dataset.final) || '';

  음성인식객체.onstart = ()=>{
    음성인식중 = true;
    음성인식_UI갱신();
    const st=document.getElementById('spkVoiceStatus');
    if(st) st.textContent='듣고 있어요… 말이 끝나면 자동으로 정리돼요.';
  };
  음성인식객체.onresult = (e)=>{
    let interim = '';
    for(let i=e.resultIndex; i<e.results.length; i++){
      const 조각 = e.results[i][0].transcript;
      if(e.results[i].isFinal) 음성인식_확정텍스트 += 조각;
      else interim += 조각;
    }
    const box=document.getElementById('spkVoiceTranscript');
    if(box){
      box.dataset.final = 음성인식_확정텍스트;
      box.innerHTML = 음성인식_확정텍스트.replace(/</g,'&lt;') + (interim ? `<span class="interim">${interim.replace(/</g,'&lt;')}</span>` : '');
    }
    // 분석하기(submitSpk)가 읽는 spkInput에도 최종 텍스트 반영
    const inp=document.getElementById('spkInput');
    if(inp) inp.value = 음성인식_확정텍스트;
  };
  음성인식객체.onerror = (e)=>{
    음성인식중 = false;
    음성인식_UI갱신();
    const st=document.getElementById('spkVoiceStatus');
    let 메시지 = '음성 인식 중 문제가 생겼어요.';
    if(e.error === 'not-allowed' || e.error === 'service-not-allowed') 메시지 = '마이크 권한이 막혀 있어요. 브라우저 설정에서 마이크를 허용해 주세요.';
    else if(e.error === 'no-speech') 메시지 = '말소리가 들리지 않았어요. 다시 해 주세요.';
    else if(e.error === 'network') 메시지 = '네트워크 문제로 음성 인식에 실패했어요.';
    if(st) st.textContent = 메시지;
  };
  음성인식객체.onend = ()=>{
    음성인식중 = false;
    음성인식_UI갱신();
    const st=document.getElementById('spkVoiceStatus');
    if(st && 음성인식_확정텍스트.trim()) st.textContent='인식 완료 — 「모범답안 보기」를 누르거나 마이크로 이어 말할 수 있어요.';
  };

  try{ 음성인식객체.start(); }
  catch(e){ showToastMsg('음성 인식을 시작할 수 없어요'); }
}

function 음성인식_중지(){
  if(음성인식객체 && 음성인식중){
    try{ 음성인식객체.stop(); }catch(e){ /* 이미 종료된 경우 무시 */ }
  }
  음성인식중 = false;
  음성인식_UI갱신();
}
/* β8: 구어 교정 출제 — 정령왕 JSON 구어_교정 27건에서 랜덤 예문 제시 */
function 구어교정_예문표시(){
  const card=document.getElementById('spkPrompt');
  if(!card || !구어교정풀.length) return;
  구어교정현재 = 출제_뽑기(구어교정풀);
  현재문제_reasoning_note = 구어교정현재.reasoning_note || '';
  card.style.display='block';
  document.getElementById('spkPromptText').textContent = '"' + 구어교정현재.구어 + '"';
  document.getElementById('spkPromptDiff').textContent = '난이도: ' + (구어교정현재.난이도 || '-');
  document.getElementById('spkResult').classList.remove('show');
  const inp=document.getElementById('spkInput');
  if(inp) inp.value='';
}
function 구어교정_다음예문(){
  구어교정_예문표시();
  showToastMsg('다음 예문이에요');
}

function submitSpk(){
  const txt=document.getElementById('spkInput').value.trim();
  // 자동 채점이 없으므로(AI 봉인) 최소한 문장다운 길이는 요구한다 — 한두 글자로 보상만 받는 것 방지
  if(txt.replace(/\s/g,'').length < 5){
    showToastMsg('격식체로 바꾼 문장을 5자 이상 입력해 주세요');
    return;
  }
  document.getElementById('spkOrigTxt').textContent=txt;
  if(GROK_활성화){
    // β1 연결 지점 (크레딧 구매 후 활성화):
    //   토큰차감('구어교정', 30) → grok호출('구어교정', {입력:txt}) → 응답을 spkFixTxt/spkTipTxt에 주입
    //   ※ 사고전개 ON 시 비용 체계는 미확정 보류 (KNOWLEDGE 21 #13) — 확정 후 구현
  }
  // Grok 미연동 단계: 정령왕 예문의 모범답안·포인트와 비교하는 방식으로 동작
  if(구어교정현재){
    document.getElementById('spkFixTxt').textContent = '모범답안: ' + 구어교정현재.격식;
    document.getElementById('spkTipTxt').textContent = 구어교정현재.포인트 || '';
  } else {
    document.getElementById('spkFixTxt').textContent = '이 문장의 모범답안은 준비 중이에요';
    document.getElementById('spkTipTxt').textContent = '';
  }
  document.getElementById('spkResult').classList.add('show');
  탐닉_체크();   // 집중력 업적: 구어 교정 제출도 「이어서 공부」로 센다(오늘 목표 수는 안 늘림)
  // 같은 예문 반복 제출로 EXP 중복 획득 방지 — 예문당 1회만 +60 (KNOWLEDGE 12)
  const id = (구어교정현재 && 구어교정현재.id) || '자유입력';
  if(!구어교정완료ID[id]){
    구어교정완료ID[id] = true;
    구어완료_저장();  // 세션5: 새로고침 후 재획득 차단 (uid별 영속)
    EXP획득(60, '구어 교정 완료');
    마스터리증가('구어교정횟수');
  }
  showToastMsg('모범답안과 비교해 보세요 (자동 채점 없음)');
}

// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   온보딩
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function renderObDots(){
  const c=document.getElementById('obDots');
  c.innerHTML='';
  for(let i=0;i<OB_TOTAL;i++){
    const d=document.createElement('div');
    d.className='ob-dot'+(i===obIdx?' on':'');
    c.appendChild(d);
  }
}
function setObSlide(i){
  document.querySelectorAll('.ob-slide').forEach(s=>{
    const idx=parseInt(s.dataset.i);
    s.classList.remove('active','exit');
    if(idx===i) s.classList.add('active');
    else if(idx<i) s.classList.add('exit');
  });
  obIdx=i;
  document.getElementById('obProg').style.width=((i+1)/OB_TOTAL*100)+'%';
  renderObDots();
  // 세션9: 마지막 슬라이드는 콘텐츠 안에 이미 '학습 시작하기' 버튼이 있어,
  // 아래 고정 이전/다음 바(.ob-nav)를 통째로 숨긴다. (기존엔 다음 버튼만 투명해지고
  // 자리(칸)는 남아 버튼이 두 겹으로 보이던 문제 — "슬라이드해도 아래 칸이 안 사라짐")
  const nav = document.querySelector('.ob-nav');
  if(nav) nav.style.display = (i === OB_TOTAL - 1) ? 'none' : 'flex';
  // 버튼 상태
  document.getElementById('obPrev').classList.toggle('inv', i===0);
  const next=document.getElementById('obNext');
  if(i===OB_TOTAL-1){
    next.classList.add('inv');
  } else {
    next.classList.remove('inv');
  }
}
function obNext(){ if(obIdx<OB_TOTAL-1) setObSlide(obIdx+1); }
function obPrev(){ if(obIdx>0) setObSlide(obIdx-1); }
function skipOb(){ finishOb(); }
function finishOb(){
  document.getElementById('onboarding').classList.add('gone');
  // 로그인 화면 fadeUp 애니메이션 재실행
  const sl=document.getElementById('sl');
  sl.querySelectorAll('.fu').forEach(e=>{
    e.style.animation='none';
    void e.offsetWidth;
    e.style.animation='';
  });
}
function showOb(){
  document.getElementById('onboarding').classList.remove('gone');
  setObSlide(0);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   이름 & 이름 변경
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function updateNmPreview(){
  const v=document.getElementById('nmInp').value;
  const p=document.getElementById('nmPrev');
  document.getElementById('nmPrevName').textContent=v||'이름을 입력해 주세요';
  p.classList.toggle('has',v.length>0);
}
function applyName(){
  const v=document.getElementById('nmInp').value.trim();
  // v3.7 항목7: 빈 입력 시 기본 이름 풀에서 랜덤 1개 (KNOWLEDGE 27섹션)
  if(v){
    userName=v;
  } else {
    userName=기본이름풀[Math.floor(Math.random()*기본이름풀.length)];
  }
  사용자.이름=userName;
  // 신규 사용자 Firestore 문서 생성 후 홈 진입 (Firebase 미설정 시 콘솔 에러만 출력하고 진행)
  신규사용자_생성().then(()=> goNav('sh',null));
}
function openNmModal(){
  document.getElementById('nmModalInp').value=userName;
  document.getElementById('nmModalBg').classList.add('show');
  setTimeout(()=>document.getElementById('nmModalInp').focus(),300);
}
function closeNmModal(){
  document.getElementById('nmModalBg').classList.remove('show');
  활성입력_blur();  // 세션5 버그9: 이름 입력 커서 잔존 방지
}
function applyNmChange(){
  const v=document.getElementById('nmModalInp').value.trim();
  if(v){
    userName=v;
    사용자.이름=v; // 사용자 객체와 동기화
    ['homeUser','statusUser','settingsUser'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.textContent=v;
    });
    사용자데이터_저장({이름: v}); // Firestore 동기화
    showToastMsg('이름이 변경됐습니다');
  }
  closeNmModal();
}

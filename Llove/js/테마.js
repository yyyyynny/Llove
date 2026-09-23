// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   안내 모달
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function showInfoModal(icon, title, desc, 와이드){
  document.getElementById('infoIcon').textContent=icon;
  document.getElementById('infoTitle').textContent=title;
  document.getElementById('infoDesc').innerHTML=desc;
  // v3.7: 호출마다 「확인」 버튼으로 초기화 (개발자모드_탭 등 동적 버튼 잔재 방지)
  const btnArea = document.getElementById('infoBtns');
  if(btnArea){
    btnArea.innerHTML = `<button class="btn-acc" style="flex:1" onclick="closeInfoModal()">확인</button>`;
  }
  // 세션10-d 항목3: 채팅 내역처럼 내용이 많은 모달은 더 넓게(.modal-bx.wide) — 호출마다 토글
  const bx = document.querySelector('#infoBg .modal-bx');
  if(bx) bx.classList.toggle('wide', !!와이드);
  document.getElementById('infoBg').classList.add('show');
}
function closeInfoModal(){
  document.getElementById('infoBg').classList.remove('show');
}

/* 버그6: 2중 확인 모달 — 정보 모달 컴포넌트 재사용, [취소]+[확인] 2버튼 */
function showConfirmModal(icon, title, desc, confirmLabel, onConfirm){
  document.getElementById('infoIcon').textContent=icon;
  document.getElementById('infoTitle').textContent=title;
  document.getElementById('infoDesc').innerHTML=desc;
  const body=document.getElementById('infoBody'); if(body) body.innerHTML='';
  const btnArea=document.getElementById('infoBtns');
  if(btnArea){
    btnArea.innerHTML='';
    const cancel=document.createElement('button');
    cancel.className='btn-g'; cancel.style.flex='1'; cancel.textContent='취소';
    cancel.onclick=closeInfoModal;
    const ok=document.createElement('button');
    ok.className='btn-acc'; ok.style.flex='1'; ok.textContent=confirmLabel;
    // 첫 모달이 닫힌 뒤 다음 단계 호출 (전환 깜빡임 방지)
    ok.onclick=()=>{ closeInfoModal(); setTimeout(()=>{ if(onConfirm) onConfirm(); }, 240); };
    btnArea.appendChild(cancel); btnArea.appendChild(ok);
  }
  document.getElementById('infoBg').classList.add('show');
}

/* 버그6: 계정 삭제 — 2중 확인 절차 (KNOWLEDGE 18섹션) */
function 계정삭제_1단계(){
  showConfirmModal('⚠️','계정 삭제 (1/2)',
    '계정을 삭제하면 레벨·업적·복습 데이터·토큰 등 <b>모든 데이터가 영구 삭제</b>되며 되돌릴 수 없습니다.<br><br>계속하시겠습니까?',
    '계속', 계정삭제_2단계);
}
function 계정삭제_2단계(){
  showConfirmModal('🗑️','계정 삭제 (2/2)',
    '<b>마지막 확인</b>입니다. 정말로 계정을 영구 삭제하시겠습니까?<br><br>이 작업은 취소할 수 없습니다.',
    '영구 삭제', 계정삭제_실행);
}
function 계정삭제_실행(){
  if(!fbAuth || !fbAuth.currentUser){
    console.error('[Firebase] 로그인 상태가 아님 — 계정 삭제 불가');
    showToastMsg('🗑️ 삭제할 계정이 없습니다');
    return;
  }
  const uid = fbAuth.currentUser.uid;
  // 세션10-l: 채팅 기록부터 먼저 정리 — Firestore는 부모 문서(users/{uid})를 지워도 서브컬렉션은
  // 자동으로 안 지워지고(고아 데이터로 남음), Auth 계정까지 지워지고 나면 인증 토큰이 무효화돼
  // 그 뒤엔 서브컬렉션 삭제 요청 자체가 거부될 수 있어 계정 삭제보다 먼저 처리해야 한다.
  채팅기록_전체삭제();
  // Firestore 사용자 문서 삭제 → Auth 계정 삭제 (재인증 필요 오류 시 콘솔 출력)
  fbDb.collection('users').doc(uid).delete()
    .then(()=> fbAuth.currentUser.delete())
    .then(()=>{
      현재UID = null;
      showToastMsg('🗑️ 계정이 삭제되었습니다');
      goNav('sl', null);
    })
    .catch(e=>{
      console.error('[Firebase] 계정 삭제 실패', e);
      showToastMsg('삭제 실패 — 다시 로그인 후 시도해 주세요');
    });
}

/* 토스트 */
let toastTimer=null;
function showToastMsg(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2000);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   테마 / 폰트 / 설정
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// 세션10-k: 다크/라이트 토글 삭제로 마지막다크·마지막라이트 기억 로직 불필요해져 제거 —
// 테마 선택은 이제 아래 「테마 선택」 그리드 단일 경로로만 이뤄짐(정신모델 단순화, 최고 관리자님 확정)
function setTheme(name, 조용히){
  curTheme=name;
  document.body.setAttribute('data-theme',name);
  document.querySelectorAll('.tc').forEach(c=>c.classList.remove('on'));
  document.getElementById('th-'+name)?.classList.add('on');
  // 빌드1: plx_ 로컬 캐시 (새로고침 대비)
  try{ localStorage.setItem('plx_테마', name); }catch(e){ /* localStorage 차단 환경 무시 */ }
  if(조용히) return;  // 초기 로드·Firestore 복원 시: 토스트·저장 생략
  사용자.테마 = name;
  사용자데이터_저장({테마: name});  // Firestore 설정 동기화 (KNOWLEDGE 13-1)
  showToastMsg('테마 변경: '+name);
}

/* 세션5 버그1: 「화면 크기」·「글자 크기」 분리 (KNOWLEDGE — 사용자 검토 지시)
   - setFontScale = 화면 크기: root zoom으로 UI 전체 확대/축소 (구 「글자 크기」의 실체.
     함수명은 기존 테스트·복원 경로 호환을 위해 유지, 의미만 화면 배율로 변경)
   - set글자크기 = 글자 크기: CSS 변수 --글자배율로 학습 콘텐츠 텍스트만 확대 (레이아웃 불변)
   - 저장 키: 화면=plx_화면배율/Firestore 화면배율 · 글자=plx_글자배율/Firestore 글자배율
     (기존 plx_글자배율 사용자는 그 %가 글자 배율로 이어짐 — 기본 100이라 체감 차이 없음) */
const 화면크기단계 = [70,80,90,100,110,125,150];  // 세션10-g: 최소 70%(항목3)·최대 150%(항목2, 175·200 제거)
function setFontScale(pct, 조용히){
  pct = 화면크기단계.includes(pct) ? pct : 100;
  // 앱 전체 배율 적용 (zoom: Chrome·Edge·Safari·Firefox 126+)
  document.documentElement.style.zoom = (pct/100).toString();
  const txt = document.getElementById('fontScaleTxt');
  if(txt) txt.textContent = pct + '% — 화면 전체를 확대/축소';
  document.querySelectorAll('#fontScaleOpts .fs-opt').forEach(b=>b.classList.toggle('on', b.textContent.trim() === pct + '%'));
  try{ localStorage.setItem('plx_화면배율', String(pct)); }catch(e){ /* localStorage 차단 환경 무시 */ }
  if(조용히) return;
  사용자.화면배율 = pct;
  사용자데이터_저장({화면배율: pct});  // Firestore 동기화
  showToastMsg('화면 크기: ' + pct + '%');
}

/* 세션7 항목10: 글자 크기 적용 범위 — '학습'(기본: 학습 콘텐츠만) / '전체'(주요 UI 텍스트 포함) */
function set글자범위(범위, 조용히){
  범위 = (범위 === '전체') ? '전체' : '학습';
  document.documentElement.dataset.글자범위 = 범위;
  document.getElementById('글자범위학습')?.classList.toggle('on', 범위==='학습');
  document.getElementById('글자범위전체')?.classList.toggle('on', 범위==='전체');
  try{ localStorage.setItem('plx_글자범위', 범위); }catch(e){ /* 무시 */ }
  if(조용히) return;
  사용자.글자범위 = 범위;
  사용자데이터_저장({글자범위: 범위});
  showToastMsg('글자 크기 적용 범위: ' + (범위==='전체' ? '앱 전체' : '학습 콘텐츠만'));
}

const 글자크기단계 = [70,80,90,100,110,125,150];  // 세션10-g 항목3: 최소 70%
function set글자크기(pct, 조용히){
  pct = 글자크기단계.includes(pct) ? pct : 100;
  // 읽기 텍스트 전용 배율 — CSS calc(원본px * --글자배율) 블록이 소비
  document.documentElement.style.setProperty('--글자배율', String(pct/100));
  const txt = document.getElementById('textScaleTxt');
  if(txt) txt.textContent = pct + '% — 문제·카드·채팅 글자만 확대';
  document.querySelectorAll('#textScaleOpts .fs-opt').forEach(b=>b.classList.toggle('on', b.textContent.trim() === pct + '%'));
  try{ localStorage.setItem('plx_글자배율', String(pct)); }catch(e){ /* localStorage 차단 환경 무시 */ }
  if(조용히) return;
  사용자.글자배율 = pct;
  사용자데이터_저장({글자배율: pct});  // Firestore 동기화
  showToastMsg('글자 크기: ' + pct + '%');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   항목3: 커스텀 테마 에디터 (KNOWLEDGE 19 사양)
   - 4색 직접 설정(배경/카드/포인트/텍스트) · 32색 팔레트 · 실시간 미리보기
   - 대비 경고(4.5:1 미만) · 랜덤 생성 · 테마 이름 · 10슬롯 프로필
   - 자동 저장: localStorage(plx_커스텀·plx_커스텀슬롯) + Firestore
   기존엔 '곧 구현' 안내 모달만 떠 동작하지 않던 부분(최고 관리자님 지적)을 실제 구현으로 대체.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const 커스텀팔레트 = [
  // 선명 16
  '#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e84393',
  '#c0392b','#d35400','#f39c12','#27ae60','#16a085','#2980b9','#8e44ad','#fd79a8',
  // 파스텔 + 명도 단계 16
  '#ffb3ba','#ffdfba','#fff5ba','#baffc9','#bae1ff','#c9c9ff','#e0baff','#ffc9e3',
  '#0a0a10','#161620','#242430','#3a3a4a','#6a6a80','#a8a8c0','#e0e0ec','#fafaff'
];
const 커스텀랜덤프리셋 = [
  {bg:'#0e0e14',card:'#161620',acc:'#8080ff',txt:'#e8e8f0'},
  {bg:'#0a0f0a',card:'#121a12',acc:'#52a868',txt:'#d0e8d4'},
  {bg:'#1a0e0e',card:'#241616',acc:'#e07a5a',txt:'#f0dcd0'},
  {bg:'#0e1420',card:'#16203a',acc:'#5aa0f0',txt:'#d8e8ff'},
  {bg:'#140e1a',card:'#201628',acc:'#b070e0',txt:'#e8d8f0'},
  {bg:'#faf6ef',card:'#ffffff',acc:'#c0392b',txt:'#2a1e16'},
  {bg:'#f0f4f8',card:'#ffffff',acc:'#2980b9',txt:'#1a2430'},
  {bg:'#101010',card:'#1c1c1c',acc:'#f1c40f',txt:'#f0f0f0'},
  {bg:'#0c1414',card:'#142020',acc:'#1abc9c',txt:'#d0eee8'},
  {bg:'#1a1410',card:'#241c14',acc:'#d4af37',txt:'#efe4cf'}
];
let 커스텀색 = {bg:'#0e0e14', card:'#161620', acc:'#8080ff', txt:'#e8e8f0'};
let 커스텀이름 = '';
let 커스텀슬롯 = [];          // [{이름,bg,card,acc,txt}] 최대 10
let 커스텀선택채널 = 'bg';

// WCAG 상대 휘도 & 대비비율
function _색휘도(hex){
  const c = hex.replace('#','');
  if(c.length < 6) return 0;
  const v = i => { const x = parseInt(c.substr(i,2),16)/255; return x<=0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055,2.4); };
  return 0.2126*v(0) + 0.7152*v(2) + 0.0722*v(4);
}
function 대비비율(h1,h2){ const a=_색휘도(h1)+0.05, b=_색휘도(h2)+0.05; return Math.max(a,b)/Math.min(a,b); }

function openCustomTheme(){
  커스텀_팔레트렌더();
  커스텀_채널선택(커스텀선택채널, null);
  커스텀_슬롯렌더();
  커스텀_미리보기갱신();
  document.getElementById('ctName').value = 커스텀이름 || '';
  document.getElementById('customThemeBg').classList.add('show');
}
function closeCustomTheme(){
  document.getElementById('customThemeBg').classList.remove('show');
  활성입력_blur();
}

function 커스텀_팔레트렌더(){
  const wrap = document.getElementById('ctPalette');
  if(!wrap) return;
  wrap.innerHTML = 커스텀팔레트.map(h=>
    `<button type="button" class="ct-sw-opt" style="background:${h}" data-hex="${h}" onclick="커스텀_색선택('${h}')"></button>`
  ).join('');
  커스텀_팔레트강조();
}
function 커스텀_팔레트강조(){
  const 현재 = 커스텀색[커스텀선택채널];
  document.querySelectorAll('#ctPalette .ct-sw-opt').forEach(b=>{
    b.classList.toggle('on', (b.dataset.hex||'').toLowerCase() === (현재||'').toLowerCase());
  });
}
function 커스텀_채널선택(ch, btn){
  커스텀선택채널 = ch;
  document.querySelectorAll('.ct-ch').forEach(b=>b.classList.toggle('on', b.dataset.ch===ch));
  커스텀_팔레트강조();
}
function 커스텀_색선택(hex){
  커스텀색[커스텀선택채널] = hex;
  커스텀_미리보기갱신();
  커스텀_팔레트강조();
}
function 커스텀_미리보기갱신(){
  const card = document.getElementById('ctPrevCard');
  if(card){
    document.getElementById('ctPreview').style.background = 커스텀색.bg;
    card.style.background = 커스텀색.card;
    document.getElementById('ctPrevTitle').style.color = 커스텀색.txt;
    document.getElementById('ctPrevSub').style.color = 커스텀색.txt;
    const btn = document.getElementById('ctPrevBtn');
    btn.style.background = 커스텀색.acc;
    btn.style.color = (대비비율(커스텀색.acc,'#ffffff') >= 대비비율(커스텀색.acc,'#000000')) ? '#ffffff' : '#000000';
  }
  // 채널 버튼 스와치
  const sw = {bg:'ctSwBg', card:'ctSwCard', acc:'ctSwAcc', txt:'ctSwTxt'};
  Object.keys(sw).forEach(k=>{ const el=document.getElementById(sw[k]); if(el) el.style.background = 커스텀색[k]; });
  커스텀_대비갱신();
}
function 커스텀_대비갱신(){
  const el = document.getElementById('ctContrast');
  if(!el) return;
  const r = 대비비율(커스텀색.txt, 커스텀색.bg);
  if(r >= 4.5){ el.className='ct-contrast ok'; el.textContent = `✓ 텍스트 대비 ${r.toFixed(1)}:1 (읽기 좋음)`; }
  else { el.className='ct-contrast warn'; el.textContent = `⚠️ 텍스트 대비 ${r.toFixed(1)}:1 — 4.5:1 미만이라 읽기 어려울 수 있습니다`; }
}
function 커스텀_랜덤(){
  const p = 커스텀랜덤프리셋[Math.floor(Math.random()*커스텀랜덤프리셋.length)];
  커스텀색 = {bg:p.bg, card:p.card, acc:p.acc, txt:p.txt};
  커스텀_미리보기갱신();
  커스텀_팔레트강조();
}
function 커스텀_색적용DOM(){
  // 선택한 4색을 루트 변수로 반영 (custom 테마 CSS가 나머지 톤을 파생)
  const root = document.documentElement.style;
  root.setProperty('--c-bg', 커스텀색.bg);
  root.setProperty('--c-card', 커스텀색.card);
  root.setProperty('--c-acc', 커스텀색.acc);
  root.setProperty('--c-txt', 커스텀색.txt);
}
function 커스텀_적용(){
  커스텀이름 = (document.getElementById('ctName')?.value || '').trim();
  커스텀_색적용DOM();
  setTheme('custom');           // data-theme=custom 적용 + plx_테마 저장 + 테마칩 동기화
  커스텀_저장persist();
  showToastMsg('🎨 커스텀 테마 적용' + (커스텀이름 ? ` · ${커스텀이름}` : ''));
}
/* 세션5 버그2: 커스텀 이름을 테마 선택 칩 라벨에 반영 — 이름 없으면 「커스텀」 유지 */
function 커스텀칩_라벨갱신(){
  const el = document.querySelector('#th-custom .tnm');
  if(el) el.textContent = '🎨 ' + (커스텀이름 || '커스텀');
}
function 커스텀_저장persist(){
  try{
    localStorage.setItem('plx_커스텀', JSON.stringify({이름:커스텀이름, ...커스텀색}));
    localStorage.setItem('plx_커스텀슬롯', JSON.stringify(커스텀슬롯));
  }catch(e){ /* 무시 */ }
  커스텀칩_라벨갱신();  // 세션5 버그2: 저장 시점에 칩 라벨 동기화
  사용자.커스텀테마 = {이름:커스텀이름, ...커스텀색};
  사용자.커스텀슬롯 = 커스텀슬롯;
  사용자데이터_저장({커스텀테마:사용자.커스텀테마, 커스텀슬롯:커스텀슬롯});
}

/* 10슬롯 프로필 */
function 커스텀_슬롯렌더(){
  const wrap = document.getElementById('ctSlots');
  if(!wrap) return;
  let html = '';
  for(let i=0;i<10;i++){
    const s = 커스텀슬롯[i];
    if(s){
      const bg = `linear-gradient(135deg, ${s.bg} 0 38%, ${s.card} 38% 64%, ${s.acc} 64%)`;
      html += `<div class="ct-slot filled" title="${(s.이름||'슬롯 '+(i+1)).replace(/"/g,'')}" style="background:${bg}" onclick="커스텀_슬롯로드(${i})"><span class="ct-slot-clear" onclick="event.stopPropagation();커스텀_슬롯비우기(${i})">✕</span></div>`;
    } else {
      html += `<div class="ct-slot" onclick="커스텀_슬롯_현재저장(${i})">＋</div>`;
    }
  }
  wrap.innerHTML = html;
}
function 커스텀_슬롯_현재저장(i){
  // i(슬롯 번호) 미지정이면 첫 빈 슬롯을 찾는다
  let idx = (typeof i === 'number') ? i : -1;
  if(idx < 0){ for(let k=0;k<10;k++){ if(!커스텀슬롯[k]){ idx=k; break; } } }
  if(idx < 0){ showToastMsg('빈 슬롯이 없습니다 (✕로 비운 뒤 저장)'); return; }
  커스텀슬롯[idx] = {이름:(document.getElementById('ctName')?.value||'').trim(), ...커스텀색};
  커스텀_슬롯렌더();
  커스텀_저장persist();
  showToastMsg(`슬롯 ${idx+1}에 저장했습니다`);
}
function 커스텀_슬롯로드(i){
  const s = 커스텀슬롯[i];
  if(!s) return;
  커스텀색 = {bg:s.bg, card:s.card, acc:s.acc, txt:s.txt};
  커스텀이름 = s.이름 || '';
  const nm = document.getElementById('ctName'); if(nm) nm.value = 커스텀이름;
  커스텀_미리보기갱신();
  커스텀_팔레트강조();
  showToastMsg(`슬롯 ${i+1} 불러옴 — 「적용」을 누르면 반영됩니다`);
}
function 커스텀_슬롯비우기(i){
  커스텀슬롯[i] = null;
  // 뒤쪽 null 정리(배열 길이 안정화)
  while(커스텀슬롯.length && 커스텀슬롯[커스텀슬롯.length-1] == null) 커스텀슬롯.pop();
  커스텀_슬롯렌더();
  커스텀_저장persist();
}

/* 저장된 커스텀 색·슬롯 복원 (앱 시작 시) */
function 커스텀_복원(객체){
  try{
    const 색 = 객체 || JSON.parse(localStorage.getItem('plx_커스텀') || 'null');
    if(색 && 색.bg){
      커스텀색 = {bg:색.bg, card:색.card, acc:색.acc, txt:색.txt};
      커스텀이름 = 색.이름 || '';
      커스텀_색적용DOM();  // 테마가 custom이면 즉시 반영되도록 변수 세팅
    }
    const 슬롯 = JSON.parse(localStorage.getItem('plx_커스텀슬롯') || 'null');
    if(Array.isArray(슬롯)) 커스텀슬롯 = 슬롯.filter(Boolean).slice(0,10);
  }catch(e){ /* 무시 */ }
  커스텀칩_라벨갱신();  // 세션5 버그2: 복원 시점에도 칩 라벨 동기화
}

/* 폰트 선택 */
// 빌드1: 글꼴 미리보기 가사 2세트 — 모달 열 때마다 A ↔ B 교체 (KNOWLEDGE 19 확정표)
// 세트 A: 피차일반 (음율, 幸福論 2023) / 세트 B: Betelgeuse (ユイリ 유우리)
let 가사세트 = 'B'; // openFontSelect에서 먼저 토글되므로 첫 열람은 A
const 글꼴가사 = {
  nanum_gothic:   {A:'언젠가 이뤄낼 미래, 그 이상을', B:'그건 마치 우리들처럼 꼭 붙어 있어'},
  nanum_myeongjo: {A:'상상만 해도 좋잖아', B:'그걸 울고 웃으며 계속 이어나가고 있어'},
  nanum_square:   {A:'믿지 않는 당신도', B:'몇십 번, 몇백 번 부딪히더라도'},
  mona:           {A:'내일을 꿈꾸잖아', B:'몇십 년, 몇백 년 옛날의 빛이'},
  asummer:        {A:'여전히 다를 게 없네 우린', B:'별자신도 잊어버렸을 즈음에'},
  round:          {A:'피차일반이네', B:'우리들에게 닿는 거야'},
  taebaek:        {A:'미련이라는 마음 남기지 않아', B:'우리는 서로 찾아내고, 서로 당기며 같은 하늘을'},
  leeseoyun:      {A:'그저 이 하나만 이루면 돼', B:'빛나는 것도 둘일 거라고 약속했어'},
  songam:         {A:'인생의 마지막 날에도 후회 없이', B:'아득히 머나먼 끝나지 않는 베텔기우스'},
  pyeongchang:    {A:'들려주고 싶은 노래를 부를게', B:'누군가에게 잇는 마법'},
};

function openFontSelect(){
  가사세트 = (가사세트==='A') ? 'B' : 'A';  // 열 때마다 세트 교체
  const list=document.getElementById('fontList');
  list.innerHTML='';
  FONTS.forEach(f=>{
    const div=document.createElement('div');
    div.className='fo'+(f.key===curFont?' on':'');
    div.onclick=()=>applyFont(f.key);
    // 버그B 수정: 기존의 취약한 style 조립 로직 제거. css는 순수 font-family 스택이므로 그대로 적용하고,
    //   단일 굵기로 배포된 폰트(weight 지정)는 미리보기에 굵기를 함께 적용한다.
    const 미리보기스타일 = `font-family:${f.css}` + (f.weight ? `;font-weight:${f.weight}` : '');
    // 빌드1: 미리보기 문구는 가사 2세트에서 — 매핑 없는 폰트만 기존 sample 폴백
    const 미리보기문구 = (글꼴가사[f.key] && 글꼴가사[f.key][가사세트]) || f.sample;
    div.innerHTML=`
      <div>
        <div class="fo-nm">${f.name}</div>
        <div class="fo-sm" style="${미리보기스타일}">${미리보기문구}</div>
      </div>
      <span class="fo-ck">✓</span>
    `;
    list.appendChild(div);
  });
  // v3.7 항목8: 폰트 출처 표기 렌더링 (KNOWLEDGE 19섹션 의무)
  const credits = document.getElementById('fontCreditList');
  if(credits){
    credits.innerHTML = FONTS.map(f=>`<div>· <span style="color:var(--txt)">${f.name}</span> — ${f.src}</div>`).join('');
  }
  document.getElementById('fontBg').classList.add('show');
}
function closeFont(){
  document.getElementById('fontBg').classList.remove('show');
}
function applyFont(key, 조용히){
  const f=FONTS.find(x=>x.key===key);
  if(!f) return;
  curFont=key;
  document.body.style.fontFamily=f.css;
  document.getElementById('fontTxt').textContent=f.name;
  // on 클래스 갱신
  document.querySelectorAll('.fo').forEach(el=>el.classList.remove('on'));
  // 빌드1: plx_ 로컬 캐시 — 로그인 전·새로고침 대비 (CLAUDE.md localStorage 규칙)
  try{ localStorage.setItem('plx_폰트', key); }catch(e){ /* localStorage 차단 환경 무시 */ }
  if(조용히) return;  // 초기 로드·Firestore 복원 시: 토스트·저장 생략
  사용자.폰트 = key;
  사용자데이터_저장({폰트: key});  // Firestore 설정 동기화 (KNOWLEDGE 13-1)
  showToastMsg('글꼴 변경: '+f.name);
  setTimeout(closeFont,300);
}

/* AI 문제만 토글 */
function toggleAiOnly(){
  aiOnly=document.getElementById('aiOnlyToggle').checked;
  document.getElementById('aiOnlyTxt').textContent=aiOnly?'켜짐':'꺼짐';
  사용자.AI문제만 = aiOnly;
  사용자데이터_저장({AI문제만: aiOnly});  // 빌드1: Firestore 설정 동기화
  showToastMsg('AI 문제만 출제: '+(aiOnly?'켜짐':'꺼짐'));
}

/* 히스토리 필터 */
function openHistoryFilter(){
  document.getElementById('selTitle').textContent='📋 최근 출제 제외';
  document.getElementById('selDesc').textContent='중복 문제를 막을지 설정합니다. 모드별로 독립 관리됩니다.';
  const list=document.getElementById('selList');
  const opts=[
    {v:'off', label:'사용 안함'},
    {v:'30', label:'최근 30개'},
    {v:'50', label:'최근 50개'},
    {v:'80', label:'최근 80개'},
    {v:'100', label:'최근 100개'},
    {v:'120', label:'최근 120개'}
  ];
  list.innerHTML='';
  opts.forEach(o=>{
    const div=document.createElement('div');
    div.className='select-opt'+(o.v===histFilter?' on':'');
    div.onclick=()=>applyHistoryFilter(o.v, o.label);
    div.innerHTML=`<span>${o.label}</span><span class="select-opt-ck">✓</span>`;
    list.appendChild(div);
  });
  document.getElementById('selBg').classList.add('show');
}
function applyHistoryFilter(v, label){
  histFilter=v;
  document.getElementById('histFilterTxt').textContent=label;
  사용자.히스토리필터 = v;
  사용자데이터_저장({히스토리필터: v});  // 빌드1: Firestore 설정 동기화
  showToastMsg('최근 출제 제외: '+label);
  setTimeout(closeSelect,250);
}
function closeSelect(){
  document.getElementById('selBg').classList.remove('show');
}

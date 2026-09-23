// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   빌드1 α4·α5·α9: 주신의 경지 / 칭호 선택 / 고급 커스터마이징
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// α4: Lv.70 도달 메시지 탭 — 창조주 달성 흐름 안내 (KNOWLEDGE 11)
function 주신의경지_탭(){
  showInfoModal('👑','주҉신҉의 경지',
    '창조주의 권한을 얻어라.<br><b>마지막 2문장을 말해라.</b><br><br>([창조주] 업적에서 단서를 확인할 수 있습니다)');
}

// α5: 창조주 달성 후 칭호 선택 — 「폐하」 ↔ 글리치 없는 깨끗한 「주신」 (KNOWLEDGE 11)
function 칭호선택_모달(){
  if(!사용자.창조주달성) return;
  document.getElementById('selTitle').textContent='👑 칭호 선택';
  document.getElementById('selDesc').textContent='창조주 달성자는 칭호를 선택할 수 있습니다.';
  const list=document.getElementById('selList');
  list.innerHTML='';
  [{v:'폐하', d:' (기본)'},{v:'주신', d:' (글리치 없는 깨끗한 주신)'}].forEach(o=>{
    const div=document.createElement('div');
    div.className='select-opt'+((사용자.선택칭호||'폐하')===o.v?' on':'');
    div.onclick=()=>{
      사용자.선택칭호=o.v;
      사용자데이터_저장({선택칭호:o.v});  // 신규 필드 — KNOWLEDGE 13-1 규칙에 따라 한글 변수명, 추가 보고됨
      closeSelect();
      if(curScreen==='ss') afterNav('ss');
      showToastMsg('칭호 변경: '+o.v);
    };
    div.innerHTML=`<span>${o.v}${o.d}</span><span class="select-opt-ck">✓</span>`;
    list.appendChild(div);
  });
  document.getElementById('selBg').classList.add('show');
}

/* ━━━ 세션6 항목11: 프로필 커스터마이징 개방 (최고 관리자님 확정 사양)
   - 전원: 이모지 프리셋 + assets/프로필/ 이미지 프리셋 자유 선택.
   - 직접 업로드만 고급(초월자 Lv.16+ 또는 개발자모드) — 미달 시 [권한 부족] 경고.
   - 이미지 프리셋은 assets/프로필/목록.json에 등록된 것만 노출(파일 추가 → 자동 반영).
     출처 표기·삭제 정책은 assets/프로필/출처.md 참조. ━━━ */
const 프로필_이모지프리셋 = ['⚔️','📚','🦉','🌙','🔥','🌊','🌸','⭐','🎯','🐺','🐱','🐰'];
let 프로필_이미지프리셋 = [];   // [{파일, 이름, 출처}] — 목록.json에서 로드
function 프로필프리셋_로드(){
  fetch('assets/프로필/목록.json')
    .then(r => r.ok ? r.json() : null)
    .then(d => { if(d && Array.isArray(d.items)) 프로필_이미지프리셋 = d.items; })
    .catch(()=>{ /* 폴더 없음/오프라인 — 이모지 프리셋만 노출 */ });
}

// 아바타 렌더 — 값이 이미지(assets/·data:·http)면 <img>, 아니면 이모지 텍스트
function 아바타_적용(el, 값){
  if(!el) return;
  const v = 값 || '⚔️';
  if(/^(assets\/|data:|https?:)/.test(v)){
    el.innerHTML = `<img src="${문자열_이스케이프(v)}" alt="프로필" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
  } else {
    el.textContent = v;
  }
}

function 프로필선택_열기(){
  const esc = 문자열_이스케이프;
  const 이모지들 = 프로필_이모지프리셋.map(e =>
    `<button style="font-size:22px;width:44px;height:44px;background:var(--elev);border:1px solid var(--bdr);border-radius:10px;cursor:pointer" onclick="프로필_적용선택('${e}')">${e}</button>`
  ).join('');
  const 이미지들 = 프로필_이미지프리셋.length
    ? 프로필_이미지프리셋.map(it =>
        `<img src="assets/프로필/${esc(it.파일)}" title="${esc(it.이름||'')}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;cursor:pointer;border:1px solid var(--bdr)" onclick="프로필_적용선택('assets/프로필/${esc(it.파일)}')">`
      ).join('')
    // 세션7 항목11: 관리 방법(폴더 경로·목록.json)은 사용자 노출 문구에서 제거 — 운영자용 안내는 이 주석으로만.
    //   등록 방법: assets/프로필/ 폴더에 이미지 추가 + 목록.json items에 {파일,이름,출처} 등록 (출처.md 표기 필수)
    : `<div style="font-size:11px;color:var(--txt2)">등록된 이미지가 아직 없습니다. 업데이트를 기다려 주세요!</div>`;
  const 업로드가능 = 사용자.개발자모드 || curLv >= 16;
  showInfoModal('🖼️','프로필 선택',
    `<div style="text-align:left">
      <div style="font-size:11px;color:var(--txt2);margin-bottom:5px">기본 이모지 — 누구나 사용 가능</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${이모지들}</div>
      <div style="font-size:11px;color:var(--txt2);margin:10px 0 5px">이미지 프리셋 — 누구나 사용 가능</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${이미지들}</div>
      <div style="font-size:11px;color:var(--txt2);margin:10px 0 5px">직접 업로드 ${업로드가능 ? '' : '🔒 초월자(Lv.16) 해금'}</div>
      <button class="btn-g" style="width:100%;padding:9px" onclick="프로필_업로드시도()">📁 내 사진 선택…</button>
      <input type="file" id="프로필파일입력" accept="image/*" style="display:none" onchange="프로필_파일처리(this)">
    </div>`);
}
function 프로필_적용선택(v){
  사용자.프로필이미지 = v;
  사용자데이터_저장({프로필이미지: v});
  ['homeAvatar','statusAvatar','settingsAvatar','nmAvatar'].forEach(id => 아바타_적용(document.getElementById(id), v));
  closeInfoModal();
  showToastMsg('프로필 변경 완료');
}
function 프로필_업로드시도(){
  // 확정 사양: 직접 업로드만 고급 게이트 — 미달자는 경고 팝업
  if(!(사용자.개발자모드 || curLv >= 16)){
    showInfoModal('🔒','고급 커스터마이징','[권한 부족]<br><br>직접 업로드는 초월자(Lv.16) 달성 시 해금됩니다.<br>기본 이모지·이미지 프리셋은 지금도 자유롭게 사용할 수 있습니다.');
    return;
  }
  document.getElementById('프로필파일입력')?.click();
}
function 프로필_파일처리(inp){
  const f = inp.files && inp.files[0];
  if(!f) return;
  const rd = new FileReader();
  // 세션10-i 항목2: 무조건 중앙 정사각 크롭이었던 것을 폐지 → 배너와 동일한 크롭 모달(드래그+확대)로 위임.
  rd.onload = () => 이미지크롭_열기(rd.result, '프로필');
  rd.readAsDataURL(f);
  inp.value = '';
}

// α9 호환: 기존 진입점은 프로필 선택으로 위임 (개방 정책 반영)
function 고급커스터마이징_탭(){ 프로필선택_열기(); }

/* ━━━ 세션7 항목12: 현황 배너 — 그라디언트 프리셋(전원) + 이미지 프리셋(전원) + 업로드(Lv.16) ━━━ */
const 배너_그라프리셋 = [
  'linear-gradient(135deg,var(--accd),var(--acc))',
  'linear-gradient(135deg,#2b5876,#4e4376)',
  'linear-gradient(135deg,#134e5e,#71b280)',
  'linear-gradient(135deg,#41295a,#2f0743)',
  'linear-gradient(135deg,#dd2476,#ff512f)',
  'linear-gradient(135deg,#141e30,#243b55)'
];
let 배너_이미지프리셋 = [];   // assets/배너/목록.json — {파일,이름,출처}
function 배너프리셋_로드(){
  fetch('assets/배너/목록.json')
    .then(r => r.ok ? r.json() : null)
    .then(d => { if(d && Array.isArray(d.items)) 배너_이미지프리셋 = d.items; })
    .catch(()=>{ /* 폴더 없음/오프라인 — 그라디언트만 노출 */ });
}
function 배너_적용(el, v){
  if(!el) return;
  if(v && /^(assets\/|data:|https?:)/.test(v)){
    el.innerHTML = `<img src="${문자열_이스케이프(v)}" alt="배너">`;
    el.style.background = '';
    return;
  }
  el.innerHTML = '';
  if(v && v.startsWith('grad:')){
    el.style.background = 배너_그라프리셋[parseInt(v.slice(5),10)] || '';
  } else {
    el.style.background = '';   // 기본: CSS 테마 그라디언트
  }
}
function 배너선택_열기(){
  const esc = 문자열_이스케이프;
  const 그라들 = 배너_그라프리셋.map((g,i)=>
    `<div style="width:72px;height:30px;border-radius:8px;border:1px solid var(--bdr);cursor:pointer;background:${g}" onclick="배너_적용선택('grad:${i}')"></div>`
  ).join('');
  const 이미지섹션 = 배너_이미지프리셋.length
    ? `<div style="font-size:11px;color:var(--txt2);margin:10px 0 5px">이미지 배너 — 누구나 사용 가능</div>
       <div style="display:flex;flex-wrap:wrap;gap:6px">${배너_이미지프리셋.map(it=>
         `<img src="assets/배너/${esc(it.파일)}" title="${esc(it.이름||'')}" style="width:110px;height:36px;border-radius:8px;object-fit:cover;cursor:pointer;border:1px solid var(--bdr)" onclick="배너_적용선택('assets/배너/${esc(it.파일)}')">`).join('')}</div>`
    : '';   // 관리 방법: assets/배너/ + 목록.json (출처.md 표기) — 운영자용 주석
  const 업로드가능 = 사용자.개발자모드 || curLv >= 16;
  showInfoModal('🖼️','배너 선택',
    `<div style="text-align:left">
      <div style="font-size:11px;color:var(--txt2);margin-bottom:5px">기본 배너 — 누구나 사용 가능</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${그라들}</div>
      ${이미지섹션}
      <div style="font-size:11px;color:var(--txt2);margin:10px 0 5px">직접 업로드 ${업로드가능 ? '' : '🔒 초월자(Lv.16) 해금'}</div>
      <button class="btn-g" style="width:100%;padding:9px" onclick="배너_업로드시도()">📁 내 사진 선택…</button>
      <input type="file" id="배너파일입력" accept="image/*" style="display:none" onchange="배너_파일처리(this)">
    </div>`);
}
function 배너_적용선택(v){
  사용자.배너이미지 = v;
  사용자데이터_저장({배너이미지: v});
  // 세션10-c 항목4: 현황·설정 두 화면이 같은 배너를 공유 → 둘 다 즉시 갱신
  배너_적용(document.getElementById('statusBanner'), v);
  배너_적용(document.getElementById('settingsBanner'), v);
  closeInfoModal();
  showToastMsg('배너 변경 완료');
}
function 배너_업로드시도(){
  if(!(사용자.개발자모드 || curLv >= 16)){
    showInfoModal('🔒','고급 커스터마이징','[권한 부족]<br><br>직접 업로드는 초월자(Lv.16) 달성 시 해금됩니다.<br>기본 배너는 지금도 자유롭게 사용할 수 있습니다.');
    return;
  }
  document.getElementById('배너파일입력')?.click();
}
function 배너_파일처리(inp){
  const f = inp.files && inp.files[0];
  if(!f) return;
  const rd = new FileReader();
  // 세션10-d 항목5: 무조건 중앙 크롭하던 것을 폐지 → 크롭 모달로 넘겨 사용자가 위치·확대를 직접 정한다.
  rd.onload = () => 이미지크롭_열기(rd.result, '배너');
  rd.readAsDataURL(f);
  inp.value = '';
}

/* ━━━ 세션10-d 항목5 / 세션10-i 항목2: 이미지 크롭 UI — 배너·프로필 공용(드래그 이동 + 확대) ━━━
   뷰포트 안에서 이미지를 cover 배치 후, 드래그로 위치를 옮기고 슬라이더로 확대한다. 적용 시 뷰포트에
   보이는 영역만 캔버스로 렌더 → dataURL(JPEG 0.82, Firestore 1MB 한도 內) → 대상별 적용 함수로 위임.
   원래 배너 전용(배너크롭_*)이었으나 프로필 사진도 같은 드래그·줌 UX를 원해 대상(대상:'배너'|'프로필')으로
   일반화 — 뷰포트 비율(700:320 vs 1:1)·출력 크기·적용 함수만 대상에 따라 갈린다. */
const 이미지크롭_출력 = { 배너: {w:700, h:320}, 프로필: {w:256, h:256} };
let 이미지크롭_상태 = {natW:0, natH:0, s0:1, z:1, tx:0, ty:0, Wv:0, Hv:0, dragging:false, px:0, py:0, 대상:'배너'};
function 이미지크롭_열기(dataURL, 대상){
  const bg = document.getElementById('cropBg');
  const img = document.getElementById('이미지크롭이미지');
  const vp = document.getElementById('cropViewport');
  if(!bg || !img || !vp) return;
  이미지크롭_상태.대상 = (대상 === '프로필') ? '프로필' : '배너';
  vp.classList.toggle('round', 이미지크롭_상태.대상 === '프로필');  // 프로필: 정사각+원형 마스크 안내
  const 제목 = document.getElementById('cropTitle');
  if(제목) 제목.textContent = (이미지크롭_상태.대상 === '프로필') ? '프로필 사진 자르기' : '배너 자르기';
  const zr = document.getElementById('cropZoom'); if(zr) zr.value = 1;
  img.onload = () => {
    // 세션10-f 항목3("배너 재설정 안 됨"): getBoundingClientRect()는 CSS transform(모달 등장 애니메이션
    // .modal-bx{transform:scale(.85)→scale(1)})의 영향을 받아, 트랜지션이 끝나기 전(이미지 로드가 먼저
    // 끝나는 경우) 실제보다 작은 뷰포트 크기를 측정해 크롭 좌표가 어긋나는 버그였다. offsetWidth/Height는
    // 레이아웃 박스 크기만 반영하고 transform에 영향받지 않아 항상 최종 크기를 정확히 준다.
    const st = 이미지크롭_상태;
    st.natW = img.naturalWidth || 0; st.natH = img.naturalHeight || 0;
    st.Wv = vp.offsetWidth || 0; st.Hv = vp.offsetHeight || 0;
    st.z = 1;
    st.s0 = (st.natW && st.natH && st.Wv && st.Hv) ? Math.max(st.Wv/st.natW, st.Hv/st.natH) : 1;
    이미지크롭_중앙정렬();
    이미지크롭_렌더();
  };
  img.src = dataURL;
  bg.classList.add('show');
}
function 이미지크롭_치수(){
  const st = 이미지크롭_상태;
  return { dispW: st.natW*st.s0*st.z, dispH: st.natH*st.s0*st.z };
}
function 이미지크롭_클램프(){
  const st = 이미지크롭_상태, {dispW, dispH} = 이미지크롭_치수();
  st.tx = Math.min(0, Math.max(st.Wv - dispW, st.tx));  // 이미지가 항상 뷰포트를 덮도록
  st.ty = Math.min(0, Math.max(st.Hv - dispH, st.ty));
}
function 이미지크롭_중앙정렬(){
  const st = 이미지크롭_상태, {dispW, dispH} = 이미지크롭_치수();
  st.tx = (st.Wv - dispW)/2; st.ty = (st.Hv - dispH)/2;
  이미지크롭_클램프();
}
function 이미지크롭_렌더(){
  const st = 이미지크롭_상태, img = document.getElementById('이미지크롭이미지');
  if(!img) return;
  const {dispW, dispH} = 이미지크롭_치수();
  img.style.width = dispW+'px'; img.style.height = dispH+'px';
  img.style.transform = `translate(${st.tx}px,${st.ty}px)`;
}
function 이미지크롭_줌(v){
  const st = 이미지크롭_상태;
  const 이전 = st.s0*st.z;
  st.z = parseFloat(v) || 1;
  const 이후 = st.s0*st.z;
  // 뷰포트 중심 기준 확대(중심 고정)
  if(이전 > 0){
    const cx = st.Wv/2, cy = st.Hv/2;
    st.tx = cx - (cx - st.tx)*(이후/이전);
    st.ty = cy - (cy - st.ty)*(이후/이전);
  }
  이미지크롭_클램프(); 이미지크롭_렌더();
}
function 이미지크롭_드래그시작(e){
  const st = 이미지크롭_상태;
  st.dragging = true; st.px = e.clientX; st.py = e.clientY;
  try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(_){ /* 미지원 무시 */ }
}
function 이미지크롭_드래그중(e){
  const st = 이미지크롭_상태;
  if(!st.dragging) return;
  st.tx += e.clientX - st.px; st.ty += e.clientY - st.py;
  st.px = e.clientX; st.py = e.clientY;
  이미지크롭_클램프(); 이미지크롭_렌더();
}
function 이미지크롭_드래그끝(){ 이미지크롭_상태.dragging = false; }
function 이미지크롭_취소(){ document.getElementById('cropBg')?.classList.remove('show'); }
function 이미지크롭_적용(){
  const st = 이미지크롭_상태, img = document.getElementById('이미지크롭이미지');
  if(!img || !st.Wv){ 이미지크롭_취소(); return; }
  const out = 이미지크롭_출력[st.대상] || 이미지크롭_출력.배너;
  const c = document.createElement('canvas'); c.width = out.w; c.height = out.h;
  const ctx = c.getContext('2d');
  if(!ctx){ 이미지크롭_취소(); return; }  // jsdom/캔버스 미지원 안전
  const k = out.w / st.Wv, {dispW, dispH} = 이미지크롭_치수();
  ctx.drawImage(img, st.tx*k, st.ty*k, dispW*k, dispH*k);
  const 대상 = st.대상;
  이미지크롭_취소();
  const dataURL = c.toDataURL('image/jpeg', 0.82);
  if(대상 === '프로필') 프로필_적용선택(dataURL);
  else 배너_적용선택(dataURL);
}

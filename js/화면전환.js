// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   화면 전환 (slideIn / slideOut)
   - curScreen에서 id로 이동
   - btn은 데모 네비 버튼 활성화 표시용 (선택)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* 항목4 수정: 현재 포커스된 입력(textarea/input)의 네이티브 커서(caret) 잔존 방지.
   ask·이의있음 패널은 display:none이 아니라 transform으로 숨겨져, 닫아도 입력이 포커스를
   유지하면 커서가 계속 깜빡인다. 화면 전환·패널 닫기 시 이 함수로 명시적 blur 처리한다.
   (CSS로 커서를 숨기는 임시방편이 아니라, 포커스 자체를 해제하는 근본 수정) */
function 활성입력_blur(){
  const ae = document.activeElement;
  if(ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) ae.blur();
}

/* 세션6 항목12: 모달 드래그-아웃 오작동 방지 —
   모달 안에서 드래그를 시작해 밖에서 손을 떼면 click이 배경에서 발생해 닫히던 문제.
   포인터다운 시작 지점을 추적해, 「누름·뗌 모두 배경」일 때만 닫는다. */
let 마지막포인터다운타깃 = null;
document.addEventListener('mousedown', ev => { 마지막포인터다운타깃 = ev.target; }, true);
document.addEventListener('touchstart', ev => { 마지막포인터다운타깃 = ev.target; }, true);

/* 세션6 신규: 안드로이드 뒤로가기 = 앱 종료 문제 — popstate로 이전 화면 복귀
   (홈 이전까지 히스토리가 없으면 브라우저 기본 동작 = 종료 유지) */
let 뒤로가기_이동중 = false;
window.addEventListener('popstate', ev => {
  const 화면 = ev.state && ev.state.화면;
  if(!화면 || !document.getElementById(화면)) return;
  뒤로가기_이동중 = true;
  // 세션7: 학습 화면으로 복귀할 땐 goLearn 재진입 — 화면만 바꾸면 현재학습모드가 어긋나
  // EXP·마스터리가 엉뚱한 카테고리로 집계되고 문제도 갱신되지 않던 문제 해소
  if(/^sq\d/.test(화면) && ev.state.카테고리){
    goLearn(ev.state.카테고리, 화면, null);
  } else {
    goNav(화면, null);
  }
  뒤로가기_이동중 = false;
});
// 세션7: 창조주 시나리오 진행 중엔 배경 탭 무시 — 실수 탭으로 시나리오가 통째로 취소되는 함정 방지
function ask배경닫기(){
  if(창조주진행중) return;
  closeAsk();
}
function 배경클릭_닫기(ev, 닫기fn){
  if(ev.target !== ev.currentTarget) return;                 // 내부 요소 클릭은 무시
  if(마지막포인터다운타깃 && 마지막포인터다운타깃 !== ev.currentTarget) return;  // 드래그 시작이 안쪽이면 무시
  닫기fn();
}

function goNav(id, btn){
  if(id===curScreen) return;
  const prev=document.getElementById(curScreen);
  const next=document.getElementById(id);
  if(!next) return;
  활성입력_blur();  // 항목4: 이전 화면의 입력 포커스(깜빡이는 커서) 해제

  // 이전 화면: 슬라이드아웃 후 active 제거
  if(prev){
    prev.classList.remove('active','entering');
    prev.classList.add('leaving');
    setTimeout(()=>{prev.classList.remove('leaving')},280);
  }

  next.classList.add('active');
  // v3.7 항목18: 화면 전환 시 scrollTop 초기화 (이전 화면의 스크롤 잔재 방지)
  next.scrollTop=0;
  next.querySelectorAll('.qbody, .ach-list, .set-body, .seg-content').forEach(el=>{ el.scrollTop=0; });
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    next.classList.add('entering');
    next.querySelectorAll('.fu').forEach(e=>{e.style.animation='none';void e.offsetWidth;e.style.animation='';});
    setTimeout(()=>next.classList.remove('entering'),400);
  }));

  const 이전화면ID = curScreen;
  curScreen=id;

  // 세션6 신규: 모바일 뒤로가기 지원 (뒤로가기로 온 경우 제외)
  // 세션7: 바텀 네비 화면끼리 오갈 땐 replace — 탭 왕복으로 히스토리가 무한히 쌓여
  //        "뒤로가기를 수십 번 눌러야 나가지는" 문제 방지
  if(!뒤로가기_이동중){
    try{
      const 네비간이동 = SHOW_NAV.includes(id) && SHOW_NAV.includes(이전화면ID);
      if(네비간이동) history.replaceState({화면:id}, '', '');
      else history.pushState({화면:id}, '', '');
    }catch(e){ /* file:// 등 미지원 환경 무시 */ }
  }

  const bnav=document.getElementById('g-bnav');
  if(SHOW_NAV.includes(id)){
    bnav.classList.remove('hidden');
    document.querySelectorAll('.nv-btn').forEach(b=>b.classList.remove('on'));
    const activeId=NAV_MAP[id];
    if(activeId) document.getElementById(activeId)?.classList.add('on');
  } else {
    bnav.classList.add('hidden');
  }

  // FAB 제거됨 — 학습 화면 하단 AI 챗 바만 유지

  document.querySelectorAll('.demb').forEach(b=>b.classList.remove('on'));
  if(btn) btn.classList.add('on');

  // v3.7 항목11,12: 슬라이드 자동 순환 — 홈 진입 시 시작, 그 외 정지
  if(id==='sh'){ 슬라이드시작(); } else { 슬라이드정지(); }

  afterNav(id);
}

function afterNav(id){
  if(id==='sh'){
    // 홈 화면: 사용자 객체 기반 렌더링 — 개발자 오버레이 표시 합성 (KNOWLEDGE 14)
    const 표시Lv=표시레벨(), 표시Exp=표시EXP(), 표시Max=expForLevel(표시Lv);
    const 등급 = 등급정보(표시Lv);
    document.getElementById('homeUser').textContent=userName;
    아바타_적용(document.getElementById('homeAvatar'), 사용자.프로필이미지);  // 세션6: 이미지/이모지 겸용
    document.getElementById('homeLv').textContent='Lv.'+표시Lv;
    document.getElementById('homeRank').textContent=등급.등급;
    document.getElementById('homeTitle').textContent='· '+등급.세부;
    document.getElementById('homeExpTxt').textContent=`${표시Exp} / ${표시Max} EXP`;
    document.getElementById('homeStreak').textContent='🔥 '+사용자.연속학습일;
    document.getElementById('homeVocab').textContent='📚 '+표시마스터리('총누적어휘수');
    document.getElementById('homeReview').textContent='📝 '+사용자.복습대기열수;

    // EXP 바 애니메이션 (transition:none → rAF 두 번 → transition 복구)
    const bar=document.getElementById('homeExp');
    bar.classList.add('instant');
    bar.style.width='0%';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      bar.classList.remove('instant');
      bar.style.width=(표시Exp/표시Max*100)+'%';
    }));

    // v3.7 항목11: 「오늘 한 문장」 슬라이드 빌더 호출 (KNOWLEDGE 24섹션)
    슬라이드빌드();
  }
  if(id==='ss'){
    // 현황 탭: 사용자 객체 + 소칭호 계산 — 개발자 오버레이 표시 합성
    const 표시Lv = 표시레벨();
    const 등급 = 등급정보(표시Lv);
    document.getElementById('statusUser').textContent=userName;
    아바타_적용(document.getElementById('statusAvatar'), 사용자.프로필이미지);  // 세션6: 이미지/이모지 겸용
    배너_적용(document.getElementById('statusBanner'), 사용자.배너이미지);      // 세션7: 프로필 배너
    document.getElementById('statusTitle').textContent=등급.세부;

    // α1·α7·α8: 7단계 소칭호 + 색상 + 주신 글리치 일괄 적용
    const 소칭호엘 = document.getElementById('statusSubTitle');
    소칭호적용(소칭호엘, 표시Lv, 사용자.창조주달성);
    // α5: 창조주 달성 시 소칭호 탭 → 칭호 선택 (폐하 ↔ 깨끗한 주신)
    소칭호엘.style.cursor = 사용자.창조주달성 ? 'pointer' : '';
    소칭호엘.onclick = 사용자.창조주달성 ? 칭호선택_모달 : null;
    // α4: Lv.70 도달 시 「주신의 경지」 메시지 노출 (창조주 달성 전까지)
    const jm=document.getElementById('jushinMsg');
    if(jm) jm.style.display = (표시Lv >= 최대레벨 && !사용자.창조주달성) ? 'block' : 'none';

    document.getElementById('statusLv').textContent='Lv.'+표시Lv;
    document.getElementById('statusGrade').textContent=등급.등급;
    renderTree();
  }
  if(id==='sg'){
    // β10: 성장 상세 화면 렌더
    렌더_성장상세();
  }
  // 학습 화면 진입 시 토큰 바 갱신 (β5) — 세션10-p: sq6·sq7(지문 독해·문장 배열) 누락 발견, 추가
  if(['sq1','sq2','sq3','sq4','sq5','sq6','sq7'].includes(id)){
    토큰표시_갱신();
  }
  if(id==='sse'){
    // 설정: 사용자 객체 기반
    const 등급 = 등급정보(curLv);
    document.getElementById('settingsUser').textContent=userName;
    아바타_적용(document.getElementById('settingsAvatar'), 사용자.프로필이미지);  // 세션6: 이미지/이모지 겸용
    document.getElementById('settingsTitle').textContent=등급.세부;
    document.getElementById('settingsEmail').textContent=사용자.이메일;
    document.getElementById('settingsEmail2').textContent=사용자.이메일;
    배너_적용(document.getElementById('settingsBanner'), 사용자.배너이미지);  // 세션10-c 항목4: 현황과 동일 배너 공유

    // v3.5: 창조주 달성 시 개발자 모드 항목 활성화 표시
    갱신_설정_개발자모드_UI();
    갱신_음성설정_UI();  // 추가기능: 창조주 전용 음성 생성 행 노출/숨김
  }
  if(id==='sa'){
    renderAchievements();
  }
  if(id==='sr'){
    // v3.5: 복습 화면 진입 시 동적 렌더링
    renderReview();
  }
  // 학습 모드 진입 시 항상 초기화
  if(id==='sq2'){
    setTimeout(initFlashcard,50);
  }
  if(id==='sq4'){
    setTimeout(initDad,50);
  }
}

/* 학습 모드 진입 — 카테고리별 화면/렌더 분기 */
function goLearn(category, screenId, btn){
  goNav(screenId, btn);
  // 세션10-e 항목3: 홈 카드 등 일반 진입은 랜덤이 아니므로 넘어가기 버튼을 숨긴다.
  // 랜덤학습()은 이 goLearn 호출이 끝난 뒤 별도로 켠다(순서 보장).
  랜덤진입 = false;
  랜덤넘어가기_표시(false);
  // 빌드1: 현재 모드 기록 (EXP·마스터리 연결용) + 토큰 바 갱신
  // 세션6 항목4: 카테고리가 바뀌면 진행 중 채팅을 기록으로 보관하고 채팅창을 비운다
  if(현재학습모드 && 현재학습모드 !== category) 채팅세션_마감('카테고리 이동');
  현재학습모드 = category;
  // 세션7: 뒤로가기 복귀용 — 히스토리 상태에 카테고리를 덧붙임 (popstate 시 goLearn 재진입 근거)
  try{ history.replaceState({화면:screenId, 카테고리:category}, '', ''); }catch(e){ /* 무시 */ }
  현재학습모드필드 = 모드_마스터리맵[category] || '';
  // 세션5: 매핑 실패 시 마스터리가 조용히 누락되는 문제 — 콘솔 경고로 표면화
  if(!현재학습모드필드) console.warn('[마스터리] 모드 매핑 없음 — 학습 수가 집계되지 않습니다:', category);
  퀴즈세션 = {수:0, 오답:0};  // 퍼펙트 세션 카운터 — 모드 진입마다 초기화
  토큰표시_갱신();
  // 4지선다 화면(sq1) — 상식·어원 / 세계사·신화 분기 (β9: 출제_분기 경유)
  if(screenId==='sq1'){
    document.getElementById('sq1Title').textContent=category;
    if(category==='상식·어원'){
      document.getElementById('sq1Mode').textContent='🌍 4지선다';
      renderQuiz4(출제_분기(category, QUIZ_COMMON));
    } else {
      document.getElementById('sq1Mode').textContent='🏛️ 4지선다';
      renderQuiz4(출제_분기(category, QUIZ_HISTORY));
    }
  }
  // 플래시카드 화면(sq2) — 고사성어·속담 / 한자·우리말
  // 버그2·9 수정: 4지선다 하드코딩 제거 → 저장된 학습설정.sq2 방식대로 출제 (진입·재진입 공통)
  if(screenId==='sq2'){
    document.getElementById('sq2Title').textContent=category;
    sq2_출제_렌더(category);
  }
  if(screenId==='sq3'){
    renderQuiz3(출제_분기('맞춤법', QUIZ_SPELL));
  }
  if(screenId==='sq4'){
    // v3.6: 초기 진입 시 학습설정.sq4 값 기반으로 데이터 선택 + 패널 버튼 상태 동기화
    const 현재난이도 = 학습설정.sq4 || '아↗그거!';
    renderDad(아재풀_구성(현재난이도));
    동기화_학습설정_버튼('sq4', 현재난이도);
  }
  // 버그 수정(2026-06-14): 구어 교정(sq5) 진입 분기 누락 — 화면만 전환되고 예문이 출제되지 않던 문제.
  //   기존엔 페이지 최초 로드/「다음 예문」 버튼으로만 출제돼, 모드 진입 시 빈 화면처럼 보였다.
  if(screenId==='sq5'){
    switchSpkMode('text');     // 진입 시 텍스트 입력 탭을 기본으로 초기화
    구어교정_예문표시();        // 정령왕 JSON 구어_교정 풀에서 예문 즉시 출제
  }
  // 세션10-c: 지문 독해(sq6) — 방식 옵션 없음, 요지/추론/세부 문장형 보기 전용 엔진
  if(screenId==='sq6'){
    document.getElementById('sq6Title').textContent=category;
    document.getElementById('sq6Mode').textContent='📖 지문 독해';
    독해_렌더();
  }
  // 세션10-m: 문장 배열(sq7) — 문해력 2탄(D안), 방식 옵션 없음
  if(screenId==='sq7'){
    document.getElementById('sq7Title').textContent=category;
    document.getElementById('sq7Mode').textContent='🧩 문장 배열';
    문장배열_렌더();
  }
}

// 세션10-e 항목3: 랜덤 「넘어가기」 — 화면 전환·타이틀·세션 리셋 없이 같은 모드에서 문제만 다시 뽑는다.
// goLearn의 출제 분기와 동일 로직이라 중복이지만, 모드 진입 부작용(채팅 마감·popstate 기록 등)을 피하려고
// 별도 함수로 둔다. goLearn의 sq1~sq6 분기가 바뀌면 이쪽도 함께 맞춰야 한다.
function 현재모드_다음출제(){
  const 카테고리 = 현재학습모드, 화면 = curScreen;
  if(화면==='sq1'){
    renderQuiz4(출제_분기(카테고리, 카테고리==='상식·어원' ? QUIZ_COMMON : QUIZ_HISTORY));
  } else if(화면==='sq2'){
    sq2_출제_렌더(카테고리);
  } else if(화면==='sq3'){
    renderQuiz3(출제_분기('맞춤법', QUIZ_SPELL));
  } else if(화면==='sq4'){
    const 현재난이도 = 학습설정.sq4 || '아↗그거!';
    renderDad(아재풀_구성(현재난이도));
    setTimeout(initDad,30);
  } else if(화면==='sq5'){
    구어교정_예문표시();
  } else if(화면==='sq6'){
    독해_렌더();
  } else if(화면==='sq7'){
    문장배열_렌더();
  }
}
function 랜덤넘어가기_표시(보임){
  document.querySelectorAll('.random-skip').forEach(el => { el.style.display = 보임 ? 'block' : 'none'; });
}
function 랜덤_넘어가기(){
  현재모드_다음출제();  // 랜덤진입은 그대로 true 유지 — 버튼 계속 노출
}

/* 버그2·9 수정: sq2(고사성어·속담 / 한자·우리말) 출제 렌더 — 진입·재진입·설정 변경 공통 경로.
   저장된 학습설정.sq2 값(4지선다·뜻 직접 서술·역방향·유의어 변별·플래시카드)대로 출제하여
   재진입 시 4지선다로 리셋되던 문제를 해소한다. */
function sq2_출제_렌더(category){
  const 방식 = 학습설정.sq2 || '4지선다';
  const 배지아이콘 = category === '한자·우리말' ? '🈯' : '📜';
  document.getElementById('sq2Mode').textContent = `${배지아이콘} ${방식}`;
  // 설정 패널 버튼 활성 상태도 현재 방식과 동기화
  동기화_학습설정_버튼('sq2', 방식);
  // 근본 수정(2026-06-14): 기존엔 '유의어 변별' 외 4방식이 전부 renderFlashcard로 폴백되어
  //   사용자가 무엇을 골라도(기본값 4지선다 포함) 플래시카드만 나오던 버그였다.
  //   이제 선택한 방식대로 실제 출제 화면을 분기한다.
  if(방식 === '예문형'){
    유의어변별_렌더();
  } else if(방식 === '4지선다'){
    sq2_사지선다_렌더(category);
  } else if(방식 === '역방향'){
    sq2_역방향_렌더(category);
  } else if(방식 === '뜻 직접 서술'){
    sq2_뜻서술_렌더(category);
  } else {
    // 플래시카드(명시 선택) — data/ JSON이 채워지면 출제_분기가 그 풀을 자동 사용
    renderFlashcard(출제_분기(category, category === '한자·우리말' ? FC_HANJA : FC_GOSAEONGEO));
  }
}

/* v3.6 신규: 학습 설정 패널 진입 시 버튼 활성 상태를 학습설정 값과 동기화
   세션6 버그6(근본): 기존엔 패널 전체 버튼을 「텍스트==단일 값」으로 토글해, 행이 2개인
   sq4 패널에서 '입력 방식' 행의 기본 on('선택지')을 벗겨버렸다. 이제 각 버튼의 onclick에서
   (screenId, mode)를 읽어 행 무관하게 정확히 동기화한다. (두 번째 인자는 호환용으로 유지) */
function 동기화_학습설정_버튼(screenId, _현재값){
  const 패널 = document.getElementById('lset' + screenId.charAt(0).toUpperCase() + screenId.slice(1));
  if(!패널) return;
  패널.querySelectorAll('.lset-opt').forEach(b=>{
    const m = (b.getAttribute('onclick')||'').match(/setLsetMode\('([^']+)','([^']+)'/);
    if(m) b.classList.toggle('on', 학습설정[m[1]] === m[2]);
  });
}

/* 세션6 항목7: 랜덤 학습 — 홈 카드와 동일한 모드 목록에서 임의 선택 후 goLearn 위임 */
const 랜덤학습_모드목록 = [
  ['상식·어원','sq1'], ['고사성어·속담','sq2'], ['세계사·신화','sq1'],
  ['아재개그','sq4'], ['한자·우리말','sq2'], ['맞춤법','sq3'], ['구어 교정','sq5'],
  ['지문 독해','sq6'],  // 세션10-d 항목7: 랜덤에도 문해력 모드 포함
  ['문장 배열','sq7']  // 세션10-m: 문해력 2탄(D안)도 랜덤에 포함
];
let 랜덤진입 = false;  // 세션10-e 항목3: 랜덤으로 들어왔을 때만 하단 「넘어가기」 노출
/* 세션7 항목8: 랜덤 설정 — 모드별 가중치(0=제외/1/2/3), plx_랜덤설정+Firestore 영속 */
let 랜덤설정 = {가중치:{}};
function 랜덤_가중치(모드){
  const v = 랜덤설정.가중치[모드];
  return (v === 0 || v) ? v : 1;   // 미설정 = 기본 1
}
function 랜덤학습(){
  // 가중치 추첨 — 0(제외)은 후보에서 빠짐
  const 풀 = [];
  랜덤학습_모드목록.forEach(m => { for(let i=0;i<랜덤_가중치(m[0]);i++) 풀.push(m); });
  if(!풀.length){ showToastMsg('⚙ 모든 모드가 제외되어 있습니다 — 랜덤 설정을 확인하세요'); return; }
  const [카테고리, 화면] = 풀[Math.floor(Math.random()*풀.length)];
  showToastMsg('🎲 오늘의 랜덤: ' + 카테고리);
  goLearn(카테고리, 화면, null);
  // 세션10-e 항목3: goLearn이 랜덤진입을 false로 초기화하므로, 반드시 그 뒤에 켠다
  랜덤진입 = true;
  랜덤넘어가기_표시(true);
}
function 랜덤설정_열기(){
  const 행들 = 랜덤학습_모드목록.map(m=>{
    const 모드 = m[0], 현재 = 랜덤_가중치(모드);
    const 버튼 = [0,1,2,3].map(v=>
      `<button class="fs-opt${현재===v?' on':''}" style="padding:5px 9px" onclick="랜덤_가중치설정('${모드}',${v})">${v===0?'제외':'×'+v}</button>`
    ).join('');
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--bdr)">
      <span style="flex:1;font-size:13px;font-weight:600;text-align:left;${현재===0?'opacity:.45;text-decoration:line-through':''}">${모드}</span>
      <div style="display:flex;gap:4px">${버튼}</div>
    </div>`;
  }).join('');
  showInfoModal('🎲','랜덤 설정',
    `<div style="text-align:left;font-size:11px;color:var(--txt2);margin-bottom:6px">모드별 등장 확률(×배수)을 정하거나 제외할 수 있습니다.</div>${행들}`);
}
function 랜덤_가중치설정(모드, v){
  랜덤설정.가중치[모드] = v;
  try{ localStorage.setItem('plx_랜덤설정', JSON.stringify(랜덤설정)); }catch(e){ /* 무시 */ }
  사용자.랜덤설정 = 랜덤설정;
  사용자데이터_저장({랜덤설정});
  랜덤설정_열기();   // 팝업 즉시 갱신
}

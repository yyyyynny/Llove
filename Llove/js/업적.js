// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   업적 데이터
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const ACH_DATA=[
  // 성장 — stage·current는 업적_표시동기화()가 실계산으로 채운다(초기 가짜 진행치 없음)
  {sec:'성장', items:[
    {key:'first', name:'첫걸음', icon:'🌱', cat:'성장 · 한 번',
     desc:'처음 공부하면 받아요', progress:'+50 EXP', single:true},
    {key:'growth', name:'성장의 기록', icon:'📈', cat:'성장 · 7단계',
     desc:'레벨이 오를수록 단계가 올라가요'},
    {key:'steady', name:'꾸준한 발걸음', icon:'🔥', cat:'성장 · 7단계',
     desc:'며칠 연속으로 공부할수록 단계가 올라가요. 단계마다 받는 EXP가 조금씩 늘어요'}
  ]},
  // 숙련
  {sec:'숙련', items:[
    {key:'perfect', name:'완벽주의자', icon:'🏅', cat:'숙련 · 7단계',
     desc:'다섯 문제를 이어서 모두 맞히면 1회로 세요'},
    {key:'speech', name:'말의 품격', icon:'🎙️', cat:'숙련 · 7단계',
     desc:'구어 교정 예문을 하나 마칠 때마다 1회로 세요'}
  ]},
  // 탐구
  {sec:'탐구', items:[
    {key:'know', name:'상식 쌓기', icon:'🌍', cat:'탐구 · 7단계',
     desc:'상식·어원 문제를 풀 때마다 1회로 세요'},
    {key:'root', name:'언어의 뿌리', icon:'📜', cat:'탐구 · 7단계',
     desc:'고사성어·속담·한자·우리말 문제를 풀 때마다 1회로 세요'},
    {key:'history', name:'역사와 신화', icon:'🏛️', cat:'탐구 · 7단계',
     desc:'세계사·신화 문제를 풀 때마다 1회로 세요'},
    {key:'spell', name:'맞춤법 다지기', icon:'✏️', cat:'탐구 · 7단계',
     desc:'맞춤법 문제를 풀 때마다 1회로 세요'},
    {key:'dad', name:'아재력', icon:'😂', cat:'탐구 · 7단계',
     desc:'아재개그 문제를 풀 때마다 1회로 세요'},
    {key:'vocab', name:'어휘 모으기', icon:'📖', cat:'탐구 · 7단계',
     desc:'지금까지 익힌 단어 수예요. 복습을 마쳐도 줄지 않아요'}
  ]},
  // 관리
  {sec:'관리', items:[
    {key:'clean', name:'휴지통 정리', icon:'🧹', cat:'관리 · 한 번',
     desc:'휴지통을 한 번 모두 비우면 받아요', progress:'+80 EXP', single:true}
  ]},
  // 숨은 업적 — 달성 전엔 이름 대신 「???」와 hint만 보인다(업적_공개). ai:true는 AI 기능이 켜져야 보인다(업적_보임)
  {sec:'숨은 업적', items:[
    {key:'reb', name:'이의 있음!', icon:'⚡', cat:'숨은 업적 · 7단계', ai:true,
     hint:'틀렸다고 생각하는 문제가 있다면…',
     desc:'이의 제기가 받아들여질 때마다 1회로 세요'},
    {key:'night', name:'새벽 공부', icon:'🌙', cat:'숨은 업적 · 7단계',
     hint:'모두가 잠든 시간에 공부해 보세요',
     desc:'자정부터 새벽 4시 사이에 공부한 날을 하루 1회로 세요'},
    {key:'asker', name:'질문 습관', icon:'💬', cat:'숨은 업적 · 7단계',
     hint:'궁금한 건 물어보세요',
     desc:'질문하기를 쓸 때마다 1회로 세요'},
    {key:'abyss', name:'너는 누구니?', icon:'👁️', cat:'숨은 업적 · 한 번',
     hint:'질문하기에 조금 엉뚱한 걸 물어보세요',
     desc:'질문하기에서 「너는 누구야」처럼 정체를 물으면 받아요', progress:'+150 EXP', single:true},
    {key:'will', name:'세 번째에 정답', icon:'💪', cat:'숨은 업적 · 한 번',
     hint:'틀려도 포기하지 마세요',
     desc:'두 번 연달아 틀린 뒤 바로 다음 문제를 맞히면 받아요', progress:'+120 EXP', single:true},
    {key:'deep', name:'집중력', icon:'🦉', cat:'숨은 업적 · 한 번',
     hint:'한자리에서 오래 공부해 보세요',
     desc:'문제 사이를 5분 넘게 쉬지 않고 30분 이상 이어서 공부하면 받아요', progress:'+150 EXP', single:true},
    {key:'border', name:'선을 넘은 질문', icon:'🚧', cat:'숨은 업적 · 한 번', ai:true,
     hint:'물어볼 수 없는 것도 있어요',
     desc:'질문하기에서 답할 수 없는 분야를 두 번 물으면 받아요', progress:'+120 EXP', single:true}
  ]},
  // 최상위
  {sec:'최상위', items:[
    {key:'creator', name:'[창조주]', icon:'👑', cat:'최상위',
     desc:'', blur:true,
     blurText:`【부富와 권력權力. 승리勝利와 영광榮光.】\n【전지全知와 전능全能.】\n【실패하지 않을 것이요, 고꾸라지지 않을 것이다. 필멸자의 승리는 영원하지 않으나 네 것만은 영원하리라.】\n【원한다면 언제든 세계를 너의 발밑에.】\n【바란다면 죽음 또한 감히 그대를 삼키지 못할지니.】`,
     stage:'lck', progress:'+2000 EXP · 칭호: 최고 관리자님', single:true, mystery:true}
  ]}
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   빌드1: 업적 진행도 실계산 + 보상 지급 (KNOWLEDGE 12·14)
   - 저장 형식(KNOWLEDGE 13-1): 업적진행도 map — 단발 0/1, 풀돌 0(미획득)~7(풀돌)
   - 표시 stage(-1~6)와 저장값(0~7)은 +1 차이
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const 업적_한글명 = {
  first:'첫걸음', growth:'성장의기록', steady:'꾸준한발걸음', perfect:'완벽주의자',
  speech:'말의품격', know:'상식의탑', root:'언어의뿌리', history:'역사탐험가',
  spell:'맞춤법수호자', dad:'아재력', vocab:'어휘대사전', clean:'환경미화원',
  reb:'반박의화신', night:'밤의사색가', asker:'질문쟁이', abyss:'심연을들여다보는자',
  will:'불굴의의지', deep:'지식의탐닉자', border:'경계를넘어서', creator:'창조주'
};
const 업적_단발EXP = { first:50, clean:80, abyss:150, will:120, deep:150, border:120, creator:2000 };
const 업적_일반EXP = [50,70,90,120,150,200,300];      // 명함~풀돌 (KNOWLEDGE 12)
const 업적_히든EXP = [120,150,200,250,300,400,500];
const 업적_히든키 = ['reb','night','asker','abyss','will','deep','border'];

// 풀돌 업적: 단계 임계표 + 현재 카운터 (KNOWLEDGE 14 조건표 그대로)
// 세션10: "업적이 너무 빠르다" 피드백 → growth(레벨 기반) 제외 전체 ×1.45 디버프
const 업적_정의 = {
  growth:  {임계:[5,10,20,30,40,55,70],       값:()=>curLv,                  단위:'Lv.', 앞단위:true},
  steady:  {임계:[3,5,7,10,15,21,29],         값:()=>사용자.연속학습일||0,    단위:'일'},
  perfect: {임계:[1,3,6,9,13,17,22],          값:()=>사용자.퍼펙트세션수||0,  단위:'회'},
  speech:  {임계:[3,6,9,13,17,23,27],         값:()=>사용자.구어교정횟수||0,  단위:'회'},  // 마지막 단계 = 구어 예문 수(27) — 예문당 1회만 세므로 넘으면 달성 불가
  know:    {임계:[4,7,14,29,43,65,87],        값:()=>사용자.상식어원학습수||0, 단위:'회'},
  root:    {임계:[4,7,22,36,58,80,100],       값:()=>사용자.언어의뿌리학습수||0, 단위:'회'},
  history: {임계:[4,7,14,29,43,65,87],        값:()=>사용자.세계사신화학습수||0, 단위:'회'},
  spell:   {임계:[4,7,14,29,43,65,87],        값:()=>사용자.맞춤법학습수||0,  단위:'회'},
  dad:     {임계:[4,7,12,17,26,35,43],        값:()=>사용자.아재개그학습수||0, 단위:'회'},
  vocab:   {임계:[30,75,145,220,290,435,580], 값:()=>사용자.총누적어휘수||0,  단위:'개'},
  reb:     {임계:[1,3,6,9,13,17,22],          값:()=>사용자.반박성공횟수||0,  단위:'회'},
  night:   {임계:[1,3,4,7,10,13,15],          값:()=>사용자.밤학습수||0,      단위:'회'},
  asker:   {임계:[3,7,12,17,23,28,33],        값:()=>사용자.총질문수||0,      단위:'회'}
};
// 계산형 단발 업적 (이벤트형 — clean·abyss·will·deep·border — 은 업적_단발달성()이 직접 처리)
const 업적_단발조건 = {
  first:   ()=> (사용자.총학습일||0) >= 1,
  creator: ()=> !!사용자.창조주달성
};

function 업적_단계계산(key){  // 표시용 stage: -1(미획득) ~ 6(풀돌) — 임계는 오름차순
  const d = 업적_정의[key];
  if(!d) return -1;
  const v = d.값();
  return d.임계.findLastIndex(임계 => v >= 임계);
}
// AI 기능에 기대는 업적(ai:true)은 AI가 봉인된 동안 목록·개수에서 숨긴다 — 달성할 길이 없어서
const 업적_보임 = a => !a.ai || GROK_활성화;
// 숨은 업적(hint 있음)은 달성 전엔 이름·설명을 가리고 힌트만 보인다
const 업적_공개 = a => !a.hint || a.stage === 'unl' || a.stage >= 0;
// 임계·현재값 표기 —'Lv.5'처럼 단위가 앞에 붙는 업적(growth)과 '5회'처럼 뒤에 붙는 업적
const 업적_값표기 = (d, n) => d.앞단위 ? (d.단위 + n) : (n + d.단위);

// 단발 업적 보상 — 팝업·업적로그·EXP (진행도 기록과 Firestore 저장 시점은 호출부가 정한다)
function 업적_단발보상(key, 이름){
  const exp = 업적_단발EXP[key] || 0;
  업적_팝업표시(key, null, exp);
  업적로그_기록(이름, '달성', exp);
  if(exp > 0) EXP획득(exp, '업적: ' + 이름);
}

// 이벤트형 단발 업적 달성 (감지 즉시 1회)
function 업적_단발달성(key){
  const 이름 = 업적_한글명[key];
  if(!이름) return;
  if(!사용자.업적진행도) 사용자.업적진행도 = {};
  if(사용자.업적진행도[이름]) return;
  사용자.업적진행도[이름] = 1;
  사용자데이터_저장({업적진행도: 사용자.업적진행도});
  업적_단발보상(key, 이름);
}

// 업적 달성 팝업 (achOv 재사용) — 단계 null = 단발
function 업적_팝업표시(key, 단계, exp){
  const 항목 = ACH_DATA.flatMap(s=>s.items).find(a=>a.key===key);
  if(!항목) return;
  팝업_예약(()=>{
    const ppIcon=document.getElementById('ppIcon'), ppTitle=document.getElementById('ppTitle'),
          ppStage=document.getElementById('ppStage'), ppDesc=document.getElementById('ppDesc'),
          ppStars=document.getElementById('ppStars'), ppExp=document.getElementById('ppExp');
    if(!ppIcon) return;
    ppIcon.textContent = 항목.icon;
    ppTitle.textContent = 항목.name;
    ppStage.textContent = (단계==null) ? '달성!' : (단계 >= 6 ? '모든 단계' : stageLabel(단계)) + ' 달성!';
    ppDesc.textContent = 항목.desc || 항목.cat || '';
    ppStars.innerHTML = (단계==null)
      ? '<span class="ach-star-filled" style="font-size:20px">☾</span>'
      : buildStars(단계, false);
    ppExp.textContent = '+' + exp + ' EXP';
    document.getElementById('achOv').classList.add('show');
  });
}

// 축하 팝업 대기열 — 업적·레벨업이 한꺼번에 와도 겹치거나 덮어쓰지 않고 하나씩 띄운다
const 팝업대기열 = [];
function 팝업_예약(보이기){
  팝업대기열.push(보이기);
  if(팝업대기열.length === 1) 보이기();
}
function 팝업_다음(){
  팝업대기열.shift();
  if(팝업대기열.length) 팝업대기열[0]();
}

// 업적로그 서브컬렉션 기록 (KNOWLEDGE 13-1)
function 업적로그_기록(업적명, 단계, 획득EXP){
  if(!fbDb || !현재UID) return;
  fbDb.collection('users').doc(현재UID).collection('업적로그').add({
    업적명, 단계, 획득EXP,
    달성일시: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(e=> console.error('[Firestore] 업적로그 기록 실패', e));
}

// 업적 전수 검사 — 카운터 변동 시 호출. 보상 EXP로 인한 연쇄 달성은 안정될 때까지 반복
let 업적검사중 = false;
function 업적_검사(){
  if(업적검사중) return;
  업적검사중 = true;
  try{
    if(!사용자.업적진행도) 사용자.업적진행도 = {};
    let 변동 = true, 회 = 0, 저장필요 = false;
    while(변동 && 회 < 5){
      변동 = false; 회++;
      // 풀돌 업적: 계산 단계가 저장 단계보다 높으면 구간별 EXP 합산 지급
      for(const key in 업적_정의){
        const 이름 = 업적_한글명[key];
        const 계산 = 업적_단계계산(key) + 1;  // 저장 형식 0~7
        const 저장 = 사용자.업적진행도[이름] || 0;
        if(계산 > 저장){
          const 표 = 업적_히든키.includes(key) ? 업적_히든EXP : 업적_일반EXP;
          let 합 = 0;
          for(let s=저장; s<계산; s++) 합 += 표[s] || 0;
          사용자.업적진행도[이름] = 계산;
          업적_팝업표시(key, 계산-1, 합);
          업적로그_기록(이름, stageLabel(계산-1), 합);
          if(합 > 0) EXP획득(합, '업적: ' + 이름);
          변동 = true; 저장필요 = true;
        }
      }
      // 계산형 단발 업적
      for(const key in 업적_단발조건){
        const 이름 = 업적_한글명[key];
        if(!사용자.업적진행도[이름] && 업적_단발조건[key]()){
          사용자.업적진행도[이름] = 1;
          업적_단발보상(key, 이름);
          변동 = true; 저장필요 = true;
        }
      }
    }
    if(저장필요) 사용자데이터_저장({업적진행도: 사용자.업적진행도});
  } finally {
    업적검사중 = false;
  }
}

// ACH_DATA 표시값을 실계산으로 동기화 (renderAchievements 직전 호출)
function 업적_표시동기화(){
  const 진행도 = 사용자.업적진행도 || {};
  ACH_DATA.forEach(sec=> sec.items.forEach(a=>{
    // 개발자 모드 「업적 풀돌 강제」 오버레이 — 표시만, 실DB·보상 미반영 (KNOWLEDGE 14)
    if(개발자오버레이?.업적풀돌){
      a.stage = a.single ? 'unl' : 6;
      return;
    }
    if(a.single){
      a.stage = 진행도[업적_한글명[a.key]] ? 'unl' : 'lck';
      return;
    }
    const d = 업적_정의[a.key];
    if(!d) return;
    a.stage = 업적_단계계산(a.key);
    const v = d.값();
    const 다음 = d.임계[Math.min(a.stage+1, 6)];
    a.current = (a.stage >= 6) ? `${업적_값표기(d, v)} (완료)` : `${업적_값표기(d, v)} / ${업적_값표기(d, 다음)}`;
  }));
}

/* 별/달 표시 생성 (v3.6: single 속성 기반으로 재구성)
   - single=true: 단발 업적, 달 기호 (☾ 획득 / ☽ 미획득)
   - single=false 또는 미지정: 풀돌 업적, 별 7개 (✦ 채움 / ✧ 빔)
   stage 값:
     - 단발(single=true): 'unl' 획득 / 'lck' 또는 -1 미획득
     - 풀돌(single=false): -1 미획득 / 0~6 명함~풀돌
   stage의 매직스트링('unl', 'lck')에 의존하지 않고 single 속성으로 우선 분기 */
function buildStars(stage, single){
  // 단발 업적 — 달 기호 1개
  if(single){
    // 획득 판정: 'unl' 또는 양의 숫자 stage
    const 획득 = (stage==='unl') || (typeof stage==='number' && stage>=0);
    if(획득) return '<span class="ach-star-filled" style="font-size:18px">☾</span>';
    return '<span class="ach-star-empty" style="font-size:18px">☽</span>';
  }

  // 풀돌 업적 — 별 7개
  // 미획득 처리: -1 또는 잘못된 값
  if(typeof stage!=='number' || stage<0){
    return '<span class="ach-star-empty">✧✧✧✧✧✧✧</span>';
  }
  let html='';
  for(let i=0;i<7;i++){
    if(i<=stage) html+=`<span class="ach-star-filled">✦</span>`;
    else html+=`<span class="ach-star-empty">✧</span>`;
  }
  return html;
}

/* 업적 렌더 */
function renderAchievements(){
  업적_표시동기화();  // 빌드1: 정적 표시값 → 실계산 동기화
  const body=document.getElementById('achBody');
  // 빌드1: 상단 요약(획득/진행 중/미달성) 실계산 — 3/5/12 하드코딩 제거
  let 획득=0, 진행=0, 미달성=0;
  ACH_DATA.forEach(sec=> sec.items.filter(업적_보임).forEach(a=>{
    if(a.single){ (a.stage==='unl') ? 획득++ : 미달성++; }
    else if(a.stage >= 6) 획득++;
    else if(a.stage >= 0) 진행++;
    else 미달성++;
  }));
  const sd=document.getElementById('achSumDone'); if(sd) sd.textContent=획득;
  const sp=document.getElementById('achSumProg'); if(sp) sp.textContent=진행;
  const sn=document.getElementById('achSumNone'); if(sn) sn.textContent=미달성;
  let html='';
  ACH_DATA.forEach(sec=>{
    html+=`<div class="ach-sec"><div class="ach-sec-t">${sec.sec}</div><div class="ach-list">`;
    sec.items.filter(업적_보임).forEach((a,idx)=>{
      const 공개 = 업적_공개(a);
      const unlClass = (a.stage==='unl' || (typeof a.stage==='number' && a.stage>=0)) ? 'unl' : '';
      const desc = `<div class="ach-ds">${공개 ? a.desc : a.hint}</div>`;
      let stars='';
      if(!a.single){
        // v3.6: buildStars에 single 명시적 전달 (false)
        stars=`<div class="ach-stars">${buildStars(a.stage, false)}<span style="color:var(--txt2);font-size:10px;font-weight:400;margin-left:8px">${stageLabel(a.stage)} · ${a.current}</span></div>`;
      } else {
        // v3.6: 단발 업적은 single=true 명시
        stars=`<div class="ach-stars">${buildStars(a.stage, true)}<span style="color:var(--txt2);font-size:10px;font-weight:400;margin-left:8px">${stageLabel(a.stage==='unl' ? 'unl' : 'lck')}</span></div>`;
      }
      html+=`<div class="ach-item ${unlClass}" style="animation-delay:${0.03*idx}s" onclick="openAchDetail('${a.key}')">
        <div class="ach-icon">${a.icon}</div>
        <div class="grow">
          <div class="ach-nm">${공개 ? a.name : '???'}</div>
          ${desc}
          ${stars}
        </div>
      </div>`;
    });
    html+='</div></div>';
  });
  body.innerHTML=html;
}

// 단계명 — 7단계 업적은 1단계~6단계·완료, 한 번 업적은 달성/미달성
function stageLabel(stage){
  if(stage==='unl')return '달성';
  if(stage==='lck' || stage===-1)return '미달성';
  if(stage===6)return '완료';
  return (stage+1)+'단계';
}

/* 업적 상세 */
function openAchDetail(key){
  const target = ACH_DATA.flatMap(s=>s.items).find(a=>a.key===key);
  if(!target) return;

  document.getElementById('adIcon').textContent=target.icon;
  const 공개 = 업적_공개(target);
  document.getElementById('adName').textContent=공개 ? target.name : '???';
  document.getElementById('adCat').textContent=target.cat;

  const descEl=document.getElementById('adDesc');

  // 창조주 블러 처리
  if(target.blur && target.blurText){
    descEl.innerHTML=`<div id="blurBox" style="filter:blur(6px);cursor:pointer;white-space:pre-line;font-size:12px;line-height:1.8;color:var(--accl);user-select:none" onclick="revealBlur()">${target.blurText}</div><div id="blurHint" style="font-size:10px;color:var(--txtm);margin-top:8px;text-align:center">탭하면 공개됩니다</div>`;
  } else if(target.key==='creator' && target.stage==='unl'){
    // 달성 후에는 블러 없이 보이며 복사 가능
    descEl.innerHTML=`<div style="white-space:pre-line;font-size:12px;line-height:1.8;color:var(--accl);user-select:text;-webkit-user-select:text;padding:10px;background:var(--bg);border-radius:8px">${target.blurText||''}</div><button style="width:100%;margin-top:8px;padding:8px;background:transparent;border:1px solid var(--bdr);color:var(--txt2);border-radius:7px;font-family:var(--fn);font-size:11px;cursor:pointer" onclick="복사_창조주키()">키 문장 복사</button>`;
  } else {
    descEl.textContent=공개 ? target.desc : target.hint;
  }

  const prog=document.getElementById('adProgress');
  if(target.single){
    prog.innerHTML=`
      <div class="ach-d-stars">${buildStars(target.stage, true)}</div>
      <div style="text-align:center;color:var(--accl);font-size:18px;font-weight:900;padding:10px 0 2px">${stageLabel(target.stage==='unl' ? 'unl' : 'lck')}</div>
      <div style="text-align:center;color:var(--txt2);font-size:12px">보상 ${target.progress}</div>
    `;
  } else {
    let html=`<div class="ach-d-stars">${buildStars(target.stage, false)}</div>`;
    html+='<table class="ach-d-table"><tbody>';
    // 조건표는 업적_정의 임계에서 만든다(종전엔 ACH_DATA에 rows로 한 벌 더 적혀 있어 함께 고쳐야 했다)
    const d = 업적_정의[target.key];
    d.임계.map((n,i)=>[stageLabel(i), 업적_값표기(d, n)]).forEach((r,i)=>{
      // v3.6 수정: 미달성(-1) 상태에서 1단계 행(i=0)이 '현재'로 표시되던 버그 제거
      // 이제 stage가 명시적으로 0~6 범위의 숫자일 때만 해당 단계 행이 강조됨
      const isCurrent = (typeof target.stage==='number' && target.stage>=0 && target.stage===i);
      html+=`<tr class="${isCurrent?'ach-d-current':''}"><td>${r[0]}</td><td>${r[1]}${isCurrent?' ◀ 현재':''}</td></tr>`;
    });
    html+='</tbody></table>';
    if(target.current){
      html+=`<div style="text-align:center;font-size:11px;color:var(--ok);margin-top:10px;font-weight:700">진행도: ${target.current}</div>`;
    }
    prog.innerHTML=html;
  }
  document.getElementById('achDetailBg').classList.add('show');
}
function revealBlur(){
  const box=document.getElementById('blurBox');
  if(box){
    // v3.5: 블러 해제 + 복사 가능하게 user-select 활성화 + 복사 버튼 추가
    box.style.filter='none';
    box.style.cursor='text';
    box.style.userSelect='text';
    box.style.webkitUserSelect='text';
    box.onclick=null;
    const hint=document.getElementById('blurHint');
    if(hint){
      hint.innerHTML='<button style="margin-top:6px;padding:8px 16px;background:transparent;border:1px solid var(--bdr);color:var(--txt2);border-radius:7px;font-family:var(--fn);font-size:11px;cursor:pointer" onclick="복사_창조주키()">키 문장 복사</button>';
      hint.style.color='';
    }
  }
}

/* 창조주 키 문장 클립보드 복사 */
function 복사_창조주키(){
  const 키문장 = ACH_DATA.flatMap(s=>s.items).find(a=>a.key==='creator').blurText;

  // 모던 브라우저: navigator.clipboard
  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(키문장).then(()=>{
      showToastMsg('클립보드에 복사됨');
    }).catch(()=>{
      복사_폴백(키문장);
    });
  } else {
    복사_폴백(키문장);
  }
}

/* 클립보드 API 미지원 환경 폴백 */
function 복사_폴백(text){
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  // execCommand는 실패해도 대개 예외 없이 false만 돌려준다 — 반환값으로 판정(2026-09-27 Q14:
  // 종전엔 false여도 "복사됨"을 띄워, 실제로는 복사가 안 됐는데 성공으로 안내했다)
  let 성공 = false;
  try { 성공 = document.execCommand('copy'); } catch(e) {}
  showToastMsg(성공 ? '클립보드에 복사됨' : '복사 실패 — 직접 선택해 주세요');
  document.body.removeChild(ta);
}
function closeAchDetail(){
  document.getElementById('achDetailBg').classList.remove('show');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   현황 트리 (애니메이션)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function renderTree(){
  // 모든 데이터를 사용자 객체에서 가져옴 — 개발자 오버레이 표시 합성 (표시레벨/표시마스터리)
  const wrap=document.getElementById('treeWrap');
  const 표시Lv=표시레벨(), 표시Exp=표시EXP(), 표시Max=expForLevel(표시Lv);
  const 등급 = 등급정보(표시Lv);
  const m = 표시마스터리;
  const lines=[
    {type:'sec', text:'📊 현황'},
    {key:'성장', sec:true, branch:'├──'},
    {key:'레벨', val:String(표시Lv), branch:'│   ├──', highlight:true},
    {key:'등급', val:`${등급.등급} · ${등급.세부}`, branch:'│   ├──'},
    {key:'현재 EXP', val:`${표시Exp} / ${표시Max}`, branch:'│   ├──'},
    {key:'연속 학습', val:`${사용자.연속학습일}일`, branch:'│   └──', valType: 사용자.연속학습일<5 ? 'warn' : ''},
    {key:'학습 기록', sec:true, branch:'├──'},
    {key:'총 학습일', val:`${사용자.총학습일}일`, branch:'│   ├──'},
    {key:'누적 어휘', val:`${m('총누적어휘수')}개`, branch:'│   ├──', highlight:true},
    {key:'5문제 모두 정답', val:`${m('퍼펙트세션수')}회`, branch: GROK_활성화 ? '│   ├──' : '│   └──'},
    ...(GROK_활성화 ? [{key:'이의 제기', val:`${m('이의제기횟수')}회`, branch:'│   └──'}] : []),
    {key:'모드별 현황', sec:true, branch:'├──'},
    {key:'상식·어원', val:`${m('상식어원학습수')}회`, branch:'│   ├──'},
    {key:'고사성어·속담·한자·우리말', val:`${m('언어의뿌리학습수')}회`, branch:'│   ├──', highlight:true},
    {key:'세계사·신화', val:`${m('세계사신화학습수')}회`, branch:'│   ├──', valType: m('세계사신화학습수')===0 ? 'warn' : ''},
    {key:'아재개그', val:`${m('아재개그학습수')}회`, branch:'│   ├──'},
    {key:'맞춤법', val:`${m('맞춤법학습수')}회`, branch:'│   ├──'},
    {key:'구어 교정', val:`${m('구어교정횟수')}회`, branch:'│   └──', valType: m('구어교정횟수')===0 ? 'warn' : ''},
    {key:'보관함', sec:true, branch:'└──'},
    {key:'복습 대기열', val:`${사용자.복습대기열수}개 / ${사용자.복습대기열상한}개`, branch:'    ├──', valType:'ok'},
    {key:'즐겨찾기', val:`${사용자.즐겨찾기수}개`, branch:'    ├──'},
    {key:'휴지통', val:`${사용자.휴지통수}개`, branch:'    └──'}
  ];
  let html='';
  lines.forEach((l,i)=>{
    const delay=(i*0.04).toFixed(2);
    if(l.type==='sec'){
      html+=`<div class="tree-line" style="animation-delay:${delay}s"><span class="tree-section">${l.text}</span></div>`;
    } else if(l.sec){
      html+=`<div class="tree-line" style="animation-delay:${delay}s"><span class="tree-branch">${l.branch} </span><span class="tree-section" style="background:none;padding:0;border:none;display:inline">${l.key}</span></div>`;
    } else {
      const valClass='tree-val'+(l.highlight?' highlight':'')+(l.valType==='warn'?' warn':'')+(l.valType==='ok'?' ok':'');
      html+=`<div class="tree-line" style="animation-delay:${delay}s"><span class="tree-branch">${l.branch} </span><span class="tree-key">${l.key}: </span><span class="${valClass}">${l.val}</span></div>`;
    }
  });
  wrap.innerHTML=html;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   레벨업 / 업적 팝업
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* 레벨업 팝업 미리보기 — 개발자 네비 전용 버튼 (실제 레벨업은 EXP획득() → 레벨업팝업()) */
function triggerLvUp(){
  const 캡 = 사용자.개발자모드 ? 120 : 최대레벨;  // 개발자 모드: Lv.120 확장 (KNOWLEDGE 14)
  레벨업팝업(Math.min(표시레벨() + 1, 캡));
}
function closeLvUp(){ document.getElementById('lvupOv').classList.remove('show'); 팝업_다음(); }
function closeAchOv(){ document.getElementById('achOv').classList.remove('show'); 팝업_다음(); }

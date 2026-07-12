// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   빌드1: 출제 공통 상태 + β9 AI 출제 분기 스켈레톤 (KNOWLEDGE 4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let 현재학습모드 = '';            // 진입한 카테고리명 (goLearn에서 설정)
let 현재학습모드필드 = '';        // 해당 모드의 마스터리 변수명 (KNOWLEDGE 13)
let 현재문제_reasoning_note = ''; // β3: 현재 문제의 출제 근거 (이의있음! 패널 상단 표시)
let 현재퀴즈풀 = null;            // 「다음 문제」 재출제용 풀
let 현재퀴즈화면 = '';            // sq1 / sq3
let 현재아재풀 = null;            // 아재개그 재출제용 풀
let AI대체안내함 = false;          // AI→DB 대체 토스트는 세션당 1회만
let 현재퀴즈문제 = null;          // 복습 대기열 연동용 — 현재 표시 중인 퀴즈 문항
let 현재플래시카드 = null;        // 복습 대기열 연동용 — 현재 표시 중인 카드
let 퀴즈세션 = {수:0, 오답:0};    // 퍼펙트 세션 판정 — 5문제 단위, 전부 정답 시 +150 (KNOWLEDGE 12·14)
let 최근결과 = [];                 // [불굴의 의지] 오답→오답→정답 패턴 감지용

const 모드_마스터리맵 = {
  '상식·어원':'상식어원학습수', '세계사·신화':'세계사신화학습수',
  '고사성어·속담':'언어의뿌리학습수', '한자·우리말':'언어의뿌리학습수',
  '맞춤법':'맞춤법학습수', '아재개그':'아재개그학습수', '구어 교정':'구어교정횟수',
  '지문 독해':'문해력학습수',  // 세션10-c: 문해력 모드 — 전용 카운터
  '문장 배열':'문해력학습수'  // 세션10-m: 문해력 2탄(D안) — 지문 독해와 카운터 공유
};

// β9: 출제 확률 결정 — DB 40% / AI 60%, 「AI 문제만」 ON 시 항상 AI (KNOWLEDGE 4)
function 출제방식_결정(){
  if(aiOnly) return 'ai';
  return Math.random() < 0.4 ? 'db' : 'ai';
}

// β9: 출제 풀 선택 — AI 선택 시 Grok 미연동 단계에서는 DB로 폴백
// (Grok 활성화 후: 토큰 15 차감 → grok호출('문제생성') → reasoning_note 동시 생성이 이 자리에 연결됨)
function 출제_분기(category, 정적폴백){
  const 방식 = 출제방식_결정();
  if(방식 === 'ai' && !GROK_활성화 && !AI대체안내함){
    showToastMsg('🤖 AI 출제 준비 중 — DB 문제로 대체합니다');
    AI대체안내함 = true;
  }
  // DB 풀: data/ JSON에 내용이 있으면 그것을, 비어 있으면 내장 폴백 사용
  // (실DB가 채워진 뒤에는 「DB 소진 → 팝업 → AI 강제 전환」 흐름이 의미를 가짐 — KNOWLEDGE 4)
  const json풀 = DB문제[category];
  return (json풀 && json풀.length) ? json풀 : 정적폴백;
}

// 「다음 문제」 — 같은 풀에서 랜덤 재출제 (sq1/sq3 공용)
function 다음문제(){
  if(!현재퀴즈풀) return;
  if(현재퀴즈화면 === 'sq3') renderQuiz3(현재퀴즈풀);
  else renderQuiz4(현재퀴즈풀);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   퀴즈 데이터
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const QUIZ_COMMON=[
  {ai:true, cat:'상식', q:'악수의 기원은 다음 중 무엇입니까?', opts:[
    {t:'결투 신청을 알리는 의식', c:false},
    {t:'무기를 들고 있지 않다는 것을 보여주는 인사', c:true},
    {t:'고대 화폐를 교환하던 풍습', c:false},
    {t:'왕에게 충성을 맹세하던 절차', c:false}
  ]}
];
const QUIZ_HISTORY=[
  {ai:false, cat:'신화', q:'그리스 신화에서 세이렌(Siren)은 어떤 존재로 묘사됩니까?', opts:[
    {t:'바다의 폭풍을 다스리는 여신', c:false},
    {t:'아름다운 노래로 선원들을 유혹해 파멸시키는 존재', c:true},
    {t:'신들의 전령을 맡은 정령', c:false},
    {t:'태양을 끌어올리는 거인족', c:false}
  ]}
];
const QUIZ_SPELL=[
  {cat:'맞춤법', q:'"그렇게 하면 (&nbsp;&nbsp;&nbsp;&nbsp;) 않아?"', hint:'괄호 안에 들어갈 알맞은 표현을 고르세요.', opts:[
    {t:'되지', c:true},
    {t:'돼지', c:false},
    {t:'됀지', c:false},   /* 세션7 항목7: 4지선다 통일 — 보기 4개로 확장 */
    {t:'대지', c:false}
  ]}
];

/* 4지선다 렌더 — 상식·어원, 세계사·신화 공용 */
function renderQuiz4(data){
  const body=document.getElementById('sq1Body');
  // 빌드1: 풀에서 랜덤 출제 + 「다음 문제」 실동작
  현재퀴즈풀=data; 현재퀴즈화면='sq1';
  const q=data[Math.floor(Math.random()*data.length)];
  현재퀴즈문제 = q;  // 복습 대기열 연동용
  현재문제_reasoning_note = q.reasoning_note || '';  // β3: DB 문제는 JSON에 직접 작성 (없으면 Grok fallback 예정)
  // 세션7 항목7: 플래시카드/역방향 분기 (문항 부족 시 4지선다 폴백)
  if(학습설정.sq1 === '플래시카드'){ 퀴즈_플래시렌더('sq1', q); return; }
  if(학습설정.sq1 === '역방향'){
    if(data.length >= 2){ 퀴즈_역방향렌더('sq1', q, data); return; }
    showToastMsg('문항이 부족해 4지선다로 출제합니다');
  }
  // 세션9: 「예문형」 — 단어 단답 대신 예문 맥락으로 판단 (유의어 변별과 동일 엔진 재사용)
  if(학습설정.sq1 === '예문형'){
    const 예문풀 = (현재학습모드 === '세계사·신화') ? 예문형_세계사신화 : 예문형_상식어원;
    const 항목 = 예문풀[Math.floor(Math.random()*예문풀.length)];
    예문형_렌더('sq1Body', 항목, ()=>renderQuiz4(data));
    return;
  }
  // 세션5 버그7: 「직접입력」 실구현 — 선택지 대신 답 타이핑 + 정답 비교
  if(학습설정.sq1 === '직접입력'){
    body.innerHTML=`
      <div class="qcard">
        <div class="qcat">${q.ai?'<span class="tag-ai">🤖 AI 출제</span>':''}<span class="tag tb">${q.cat}</span></div>
        <div class="q-question">${q.q}</div>
      </div>
      ${직접입력_HTML('sq1')}
      <div class="exp-gain"><div class="egl">정답 시 획득</div><div class="egv">+20 EXP ✨</div></div>
      <button class="btn-acc" style="width:100%" onclick="다음문제()">다음 문제 →</button>
    `;
    return;
  }
  // 선택지 HTML 동적 생성 (1~4번)
  let optsHtml='';
  q.opts.forEach((o,i)=>{
    optsHtml+=`<div class="aopt" onclick="selAns(this,${o.c})"><div class="onum">${i+1}</div><div class="otxt">${o.t}</div></div>`;
  });
  body.innerHTML=`
    <div class="qcard">
      <div class="qcat">${q.ai?'<span class="tag-ai">🤖 AI 출제</span>':''}<span class="tag tb">${q.cat}</span></div>
      <div class="q-question">${q.q}</div>
    </div>
    <div class="aopts">${optsHtml}</div>
    <div class="exp-gain"><div class="egl">정답 시 획득</div><div class="egv">+20 EXP ✨</div></div>
    <button class="btn-acc" style="width:100%" onclick="다음문제()">다음 문제 →</button>
  `;
}

/* 3지선다 렌더 — 맞춤법 전용 */
function renderQuiz3(data){
  const body=document.getElementById('sq3Body');
  // 빌드1: 풀에서 랜덤 출제 + 「다음 문제」 실동작
  현재퀴즈풀=data; 현재퀴즈화면='sq3';
  const q=data[Math.floor(Math.random()*data.length)];
  현재퀴즈문제 = q;  // 복습 대기열 연동용
  현재문제_reasoning_note = q.reasoning_note || '';
  // 세션7 항목7: 플래시카드/역방향 분기 (문항 부족 시 기본 선다형 폴백)
  if(학습설정.sq3 === '플래시카드'){ 퀴즈_플래시렌더('sq3', q); return; }
  if(학습설정.sq3 === '역방향'){
    if(data.length >= 2){ 퀴즈_역방향렌더('sq3', q, data); return; }
    showToastMsg('문항이 부족해 선다형으로 출제합니다');
  }
  // 세션5 버그7: 「직접입력」 실구현 — 선택지 대신 답 타이핑 + 정답 비교
  if(학습설정.sq3 === '직접입력'){
    body.innerHTML=`
      <div class="qcard">
        <div class="qcat"><span class="tag tg">${q.cat}</span></div>
        <div class="q-question">${q.q}</div>
        <div class="q-hint">${q.hint||''}</div>
      </div>
      ${직접입력_HTML('sq3')}
      <div class="exp-gain"><div class="egl">정답 시 획득</div><div class="egv">+20 EXP ✨</div></div>
      <button class="btn-acc" style="width:100%" onclick="다음문제()">다음 문제 →</button>
    `;
    return;
  }
  let optsHtml='';
  q.opts.forEach((o,i)=>{
    optsHtml+=`<div class="aopt" onclick="selAns(this,${o.c})"><div class="onum">${i+1}</div><div class="otxt">${o.t}</div></div>`;
  });
  body.innerHTML=`
    <div class="qcard">
      <div class="qcat"><span class="tag tg">${q.cat}</span></div>
      <div class="q-question">${q.q}</div>
      <div class="q-hint">${q.hint||''}</div>
    </div>
    <div class="aopts">${optsHtml}</div>
    <div class="exp-gain"><div class="egl">정답 시 획득</div><div class="egv">+20 EXP ✨</div></div>
    <button class="btn-acc" style="width:100%" onclick="다음문제()">다음 문제 →</button>
  `;
}

/* 정답 선택 처리 — 정답이면 EXP 플로팅, 오답이면 정답 강조 */
function selAns(el, isCorrect){
  const aopts=el.parentElement.querySelectorAll('.aopt');
  // 이미 선택된 상태면 무시
  if(el.parentElement.querySelector('.correct,.wrong')) return;

  // 복습 대기열 연동 정보 — 정답 보기 텍스트를 「단어」, 문제를 「뜻」으로 기록
  const 정답보기 = 현재퀴즈문제?.opts?.find(o=>o.c)?.t || '';
  const 문제요약 = 현재퀴즈문제?.q || '';

  if(isCorrect){
    el.classList.add('correct');
    // 빌드1: 실제 EXP 획득 (+20, 꾸준한 발걸음 배율 적용) + Firestore 저장
    const 획득 = EXP획득(20, '퀴즈 정답');
    showExpFloat(el,'+'+획득);
    showToastMsg('✓ 정답입니다!');
    연속정답처리(true);  // 10연속 정답 → 토큰 +10
    if(정답보기) 복습대기열_정답처리(정답보기);  // 대기열에 있으면 졸업 카운트 +1
  } else {
    el.classList.add('wrong');
    aopts.forEach(o=>{
      const oc=o.getAttribute('onclick')||'';
      if(oc.includes('true')){
        o.classList.add('correct');
      }
    });
    showToastMsg('✗ 오답입니다');
    연속정답처리(false);
    if(정답보기) 복습대기열_추가(정답보기, 문제요약, 현재퀴즈문제?.cat || 현재학습모드);  // 틀린 문제 → 복습 대기열
  }
  // 빌드1: 모드별 마스터리 +1 (문제 풀 때마다 — KNOWLEDGE 13) + 누적 어휘 +1
  if(현재학습모드필드) 마스터리증가(현재학습모드필드);
  마스터리증가('총누적어휘수');
  세션결과_기록(isCorrect);  // 퍼펙트 세션 + [불굴의 의지] 패턴 감지
  aopts.forEach(o=>o.classList.add('disabled'));
}

/* ━━━ 세션5 버그7: 「직접입력」 공용 구현 (sq1 상식·세계사 / sq3 맞춤법) ━━━ */
// 입력칸 + 제출 버튼 HTML (renderQuiz4/renderQuiz3의 직접입력 분기에서 사용)
function 직접입력_HTML(screenId){
  return `
    <div style="display:flex;gap:8px;margin:4px 0 10px">
      <input class="nm-inp" id="${screenId}DirectInp" placeholder="정답을 직접 입력하세요" style="flex:1;margin:0"
             onkeydown="if(event.key==='Enter')직접입력_제출('${screenId}')">
      <button class="btn-acc" style="padding:11px 18px" id="${screenId}DirectBtn" onclick="직접입력_제출('${screenId}')">제출</button>
    </div>
    <div id="${screenId}DirectResult"></div>`;
}
// 느슨한 비교 — 공백·문장부호 제거 + 소문자화 (한 글자라도 다르면 오답)
function 직접입력_규격(s){
  return String(s||'').toLowerCase().replace(/[\s.,!?'"“”‘’()\[\]~\-·:;]/g,'');
}
// 제출 처리 — selAns와 동일한 후처리(EXP·복습·마스터리·세션 기록), 문제당 1회 잠금
function 직접입력_제출(screenId){
  const inp = document.getElementById(screenId+'DirectInp');
  if(!inp || inp.dataset.제출완료) return;
  const 입력 = (inp.value||'').trim();
  if(!입력){ showToastMsg('답을 입력해 주세요'); return; }
  inp.dataset.제출완료='1'; inp.disabled = true;
  const btn = document.getElementById(screenId+'DirectBtn'); if(btn) btn.disabled = true;
  활성입력_blur();  // 세션5 버그9: 제출 후 커서 잔존 방지

  const 정답 = 현재퀴즈문제?.opts?.find(o=>o.c)?.t || '';
  const 문제요약 = 현재퀴즈문제?.q || '';
  const 정답여부 = 직접입력_규격(입력) !== '' && 직접입력_규격(입력) === 직접입력_규격(정답);
  const 결과 = document.getElementById(screenId+'DirectResult');

  if(정답여부){
    if(결과) 결과.innerHTML = `<div class="syn-result show"><div class="syn-result-title ok">✓ 정답입니다!</div><div class="syn-result-def">${정답}</div></div>`;
    const 획득 = EXP획득(20, '퀴즈 정답');
    if(결과) showExpFloat(결과,'+'+획득);
    showToastMsg('✓ 정답입니다!');
    연속정답처리(true);
    if(정답) 복습대기열_정답처리(정답);
  } else {
    if(결과) 결과.innerHTML = `<div class="syn-result show"><div class="syn-result-title err">✗ 오답입니다</div><div class="syn-result-def">정답: <b>${정답}</b></div></div>`;
    showToastMsg('✗ 오답입니다');
    연속정답처리(false);
    if(정답) 복습대기열_추가(정답, 문제요약, 현재퀴즈문제?.cat || 현재학습모드);
  }
  if(현재학습모드필드) 마스터리증가(현재학습모드필드);
  마스터리증가('총누적어휘수');
  세션결과_기록(정답여부);
}

/* ━━━ 세션7 항목7: sq1·sq3 공용 「플래시카드」·「역방향」 (문항형 데이터 변환) ━━━ */
// 플래시카드: 앞면 = 문항, 정답 보기 1회(EXP·마스터리 1회 잠금)
let 퀴즈플래시_공개됨 = false;
function 퀴즈_플래시렌더(screenId, q){
  const body = document.getElementById(screenId+'Body');
  퀴즈플래시_공개됨 = false;
  const 정답 = q.opts.find(o=>o.c)?.t || '';
  body.innerHTML = `
    <div class="qcard">
      <div class="qcat"><span class="tag tb">${q.cat}</span></div>
      <div class="q-question">${q.q}</div>
      ${q.hint?`<div class="q-hint">${q.hint}</div>`:''}
    </div>
    <button class="btn-acc" id="${screenId}FlashBtn" style="width:100%;margin-top:12px" onclick="퀴즈_플래시공개('${screenId}')">정답 보기</button>
    <div id="${screenId}FlashAns" class="qcard" style="display:none;margin-top:10px;border-color:var(--acc)">
      <div class="q-hint">정답</div>
      <div class="q-question" style="color:var(--acc)">${정답}</div>
    </div>
    <button class="btn-acc" style="width:100%;margin-top:12px" onclick="다음문제()">다음 문제 →</button>
  `;
}
function 퀴즈_플래시공개(screenId){
  if(퀴즈플래시_공개됨) return;   // 1회 잠금 — EXP 중복 방지
  퀴즈플래시_공개됨 = true;
  const ans = document.getElementById(screenId+'FlashAns');
  const btn = document.getElementById(screenId+'FlashBtn');
  if(ans) ans.style.display = 'block';
  if(btn) btn.style.display = 'none';
  const 획득 = EXP획득(20, '플래시 학습');
  if(ans) showExpFloat(ans, '+'+획득);
  if(현재학습모드필드) 마스터리증가(현재학습모드필드);
  마스터리증가('총누적어휘수');
}
// 역방향: 정답을 제시하고 「이 정답의 문제」를 고르기 (selAns 흐름 그대로 재사용)
function 퀴즈_역방향렌더(screenId, q, data){
  const body = document.getElementById(screenId+'Body');
  const 정답보기 = q.opts.find(o=>o.c)?.t || '';
  const 타문항 = data.filter(x=>x!==q).map(x=>x.q).sort(()=>Math.random()-0.5).slice(0,3);
  const 보기들 = [...타문항.map(t=>({t, c:false})), {t:q.q, c:true}].sort(()=>Math.random()-0.5);
  let optsHtml='';
  보기들.forEach((o,i)=>{
    optsHtml += `<div class="aopt" onclick="selAns(this,${o.c})"><div class="onum">${i+1}</div><div class="otxt">${o.t}</div></div>`;
  });
  body.innerHTML = `
    <div class="qcard">
      <div class="qcat"><span class="tag tb">${q.cat}</span> <span class="tag tp">역방향</span></div>
      <div class="q-question" style="color:var(--acc)">${정답보기}</div>
      <div class="q-hint">위 정답에 해당하는 문제를 고르세요</div>
    </div>
    <div class="aopts">${optsHtml}</div>
    <div class="exp-gain"><div class="egl">정답 시 획득</div><div class="egv">+20 EXP ✨</div></div>
    <button class="btn-acc" style="width:100%" onclick="다음문제()">다음 문제 →</button>
  `;
}

/* 퍼펙트 세션(5문제 전원 정답 → +150, KNOWLEDGE 12) + [불굴의 의지](오답→오답→정답) 판정 */
function 세션결과_기록(정답여부){
  // 불굴의 의지 — 동일 세션 내 오답·오답·정답 패턴
  최근결과.push(정답여부);
  if(최근결과.length > 3) 최근결과.shift();
  if(최근결과.length===3 && !최근결과[0] && !최근결과[1] && 최근결과[2]){
    업적_단발달성('will');
  }
  // 퍼펙트 세션 — 5문제 단위
  퀴즈세션.수++;
  if(!정답여부) 퀴즈세션.오답++;
  if(퀴즈세션.수 >= 5){
    if(퀴즈세션.오답 === 0){
      사용자.퍼펙트세션수 = (사용자.퍼펙트세션수||0) + 1;
      사용자데이터_저장({퍼펙트세션수: 사용자.퍼펙트세션수});
      EXP획득(150, '퍼펙트 세션');
      showToastMsg('🏅 퍼펙트 세션! +150 EXP');
      업적_검사();
    }
    퀴즈세션 = {수:0, 오답:0};
  }
}

function showExpFloat(el, text){
  const r=el.getBoundingClientRect();
  const f=document.createElement('div');
  f.className='exp-float';
  f.textContent=text;
  f.style.left=(r.left+r.width/2-20)+'px';
  f.style.top=r.top+'px';
  document.body.appendChild(f);
  setTimeout(()=>f.remove(),1100);
}

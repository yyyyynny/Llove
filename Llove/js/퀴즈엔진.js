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

/* 배열 제자리 셔플 (Fisher–Yates) — 보기·출제 순서 무작위화 공용.
   ⚠️ sort(()=>Math.random()-0.5)는 쓰지 말 것: 정렬 알고리즘 탓에 분포가 편향된다. */
function 셔플(arr){
  for(let k=arr.length-1; k>0; k--){
    const j = Math.floor(Math.random()*(k+1));
    [arr[k], arr[j]] = [arr[j], arr[k]];
  }
  return arr;
}

/* 학습 화면 상단 진행 표시(Q11 — 2026-09-26 관리자님 결정: "이번 학습에서 푼 문제 수").
   모드에 들어온 뒤 몇 번째 문제인지를 "n문제째"로 세고, 바는 5문제마다 한 바퀴 돈다.
   goLearn이 진입마다 0으로 되돌리고, 각 화면의 출제 함수가 새 문제를 그릴 때마다 부른다
   (폴백으로 다른 출제 함수에 넘기는 경우는 넘겨받은 쪽에서만 세도록 폴백 분기 뒤에서 부른다). */
let 학습진행수 = 0;
// 화면 머리 부제("4지선다")를 현재 학습설정으로
// (2026-09-27: 종전엔 sq1·sq3·sq4 배지가 설정과 무관하게 고정 문구였다)
function 배지_방식표시(배지id, 방식){
  const 배지 = document.getElementById(배지id);
  if(배지 && 방식) 배지.textContent = 방식;   // 머리 부제 — 제목이 모드를 말하므로 아이콘 없이 방식만
}
function 학습진행_다음(screenId){
  학습진행수++;
  const 화면 = document.getElementById(screenId);
  const 글 = 화면?.querySelector('.qct'), 바 = 화면?.querySelector('.qpfill');
  if(글) 글.textContent = 학습진행수 + '문제째';
  if(바) 바.style.width = (((학습진행수 - 1) % 5) + 1) * 20 + '%';
}

// β9: 출제 풀 선택 — AI 선택 시 Grok 미연동 단계에서는 DB로 폴백
// (Grok 활성화 후: 토큰 15 차감 → grok호출('문제생성') → reasoning_note 동시 생성이 이 자리에 연결됨)
function 출제_분기(category){
  const 방식 = 출제방식_결정();
  if(방식 === 'ai' && !GROK_활성화 && !AI대체안내함){
    showToastMsg('AI 출제는 준비 중이라 기본 문제로 냅니다');
    AI대체안내함 = true;
  }
  // DB 풀: data/ JSON 문항 (미적재·로드 실패면 빈 배열 — 렌더 함수들이 빈 배열을 안전하게 처리)
  // (실DB가 채워진 뒤에는 「DB 소진 → 팝업 → AI 강제 전환」 흐름이 의미를 가짐 — KNOWLEDGE 4)
  return DB문제[category] || [];
}

// 「다음 문제」 — 같은 풀에서 랜덤 재출제 (sq1/sq3 공용)
function 다음문제(){
  if(현재퀴즈풀) renderQuiz(현재퀴즈화면, 현재퀴즈풀);
}

/* 재구조화 이후 정리: QUIZ_COMMON·QUIZ_HISTORY·QUIZ_SPELL(각 1건, data/ DB 빈 파일 시절의
   정적 폴백)은 data/상식어원.json·세계사신화.json·맞춤법.json에 이전 완료(각 81번째 항목).
   출제_분기()는 데이터가 없으면 빈 배열을 돌려주므로, 아래 렌더 함수들은 빈 배열을 안전하게
   처리해야 한다(fetch 실패·초기 로드 지연 시 대비). */

/* 선택형 문제 렌더 — sq1(상식·어원/세계사·신화, 4지선다)·sq3(맞춤법, 4지선다) 공용.
   두 화면은 태그 색·AI 출제 표시·힌트 줄·예문형 지원만 다르다. */
function renderQuiz(screenId, data){
  if(!data || !data.length){ showToastMsg('문제를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.'); return; }
  학습진행_다음(screenId);
  const sq1 = screenId === 'sq1', 방식 = 학습설정[screenId];
  배지_방식표시(screenId + 'Mode', 방식);
  const body=document.getElementById(screenId+'Body');
  // 빌드1: 풀에서 랜덤 출제 + 「다음 문제」 실동작
  현재퀴즈풀=data; 현재퀴즈화면=screenId;
  const q=data[Math.floor(Math.random()*data.length)];
  현재퀴즈문제 = q;  // 복습 대기열 연동용
  현재문제_reasoning_note = q.reasoning_note || '';  // β3: DB 문제는 JSON에 직접 작성 (없으면 Grok fallback 예정)
  // 세션7 항목7: 플래시카드/역방향 분기 (문항 부족 시 기본 선다형 폴백)
  if(방식 === '플래시카드'){ 퀴즈_플래시렌더(screenId, q); return; }
  if(방식 === '역방향'){
    if(data.length >= 2){ 퀴즈_역방향렌더(screenId, q, data); return; }
    showToastMsg(`문항이 부족해 ${sq1 ? '4지선다로' : '선다형으로'} 출제합니다`);
  }
  // 세션9: 「예문형」(sq1 전용) — 단어 단답 대신 예문 맥락으로 판단 (유의어 변별과 동일 엔진 재사용)
  if(sq1 && 방식 === '예문형'){
    const 예문풀 = (현재학습모드 === '세계사·신화') ? 예문형_세계사신화 : 예문형_상식어원;
    예문형_렌더('sq1Body', 예문풀[Math.floor(Math.random()*예문풀.length)], ()=>renderQuiz('sq1', data));
    return;
  }
  // 세션5 버그7: 「직접입력」 — 선택지 대신 답 타이핑 + 정답 비교 / 그 밖엔 선택지(1~N번)
  const 답영역 = 방식 === '직접입력' ? 직접입력_HTML(screenId)
    : `<div class="aopts">${q.opts.map((o,i)=>`<div class="aopt" onclick="selAns(this,${o.c})"><div class="onum">${i+1}</div><div class="otxt">${o.t}</div></div>`).join('')}</div>`;
  body.innerHTML=`
    <div class="qcard">
      <div class="qcat">${sq1 && q.ai?'<span class="tag-ai">🤖 AI 출제</span>':''}<span class="tag ${sq1 ? 'tb' : 'tg'}">${q.cat}</span></div>
      <div class="q-question">${q.q}</div>
      ${sq1 ? '' : `<div class="q-hint">${q.hint||''}</div>`}
    </div>
    ${답영역}
    <button class="btn-acc q-next" style="width:100%" onclick="다음문제()"><span class="q-skip">건너뛰기</span><span class="q-go">다음 문제 →</span></button>
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
  } else {
    el.classList.add('wrong');
    aopts.forEach(o=>{
      const oc=o.getAttribute('onclick')||'';
      if(oc.includes('true')){
        o.classList.add('correct');
      }
    });
  }
  // U8: 결과와 해설을 보기 바로 아래에(직접입력·예문형과 같은 결과 상자). 종전엔 토스트 한 줄뿐이었다
  el.parentElement.insertAdjacentHTML('afterend', 결과상자_HTML(isCorrect));
  채점_기록(isCorrect, 정답보기, 문제요약, 현재퀴즈문제?.cat || 현재학습모드);
  aopts.forEach(o=>o.classList.add('disabled'));
}

// 채점 결과 상자 — 선택형·직접입력 공용. 해설은 문항의 출제 근거(reasoning_note, 데이터 JSON)
function 결과상자_HTML(정답여부, 본문){
  const 해설 = 현재문제_reasoning_note ? `<div class="syn-result-reason">${현재문제_reasoning_note}</div>` : '';
  return `<div class="syn-result show"><div class="syn-result-title ${정답여부 ? 'ok' : 'err'}">${정답여부 ? '✓ 정답' : '✗ 오답'}</div>`
    + (본문 ? `<div class="syn-result-def">${본문}</div>` : '') + 해설 + '</div>';
}

/* 채점 공통 후처리 — 연속 정답(10연속 → 토큰 +10)·복습 대기열(정답이면 졸업, 틀리면 추가)·
   모드별 마스터리 +1·누적 어휘 +1(KNOWLEDGE 13)·세션 기록(퍼펙트 세션·[불굴의 의지]).
   EXP·토스트·강조 표시는 화면마다 달라 호출부가 먼저 처리한다. 단어가 비면 복습 연동만 건너뛴다. */
function 채점_기록(정답여부, 단어, 뜻, 모드){
  연속정답처리(정답여부);
  if(단어){
    if(정답여부) 복습대기열_정답처리(단어);
    else 복습대기열_추가(단어, 뜻, 모드);
  }
  if(현재학습모드필드) 마스터리증가(현재학습모드필드);
  마스터리증가('총누적어휘수');
  세션결과_기록(정답여부);
}

/* ━━━ 세션5 버그7: 「직접입력」 공용 구현 (sq1 상식·세계사 / sq3 맞춤법) ━━━ */
// 입력칸 + 제출 버튼 HTML (renderQuiz의 직접입력 분기에서 사용)
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
// 직접입력 공통 — 입력값을 꺼내며 문제당 1회 잠근다(입력칸·버튼 비활성, 키보드 내림).
// 이미 제출했거나 비어 있으면 null (퀴즈·아재개그·복습 3곳 공용)
function 직접입력_꺼내기(입력ID, 버튼ID){
  const inp = document.getElementById(입력ID);
  if(!inp || inp.dataset.제출완료) return null;
  const 입력 = (inp.value||'').trim();
  if(!입력){ showToastMsg('답을 입력해 주세요'); return null; }
  inp.dataset.제출완료='1'; inp.disabled = true;
  const btn = document.getElementById(버튼ID); if(btn) btn.disabled = true;
  활성입력_blur();  // 세션5 버그9: 제출 후 커서 잔존 방지
  return 입력;
}
// 제출 처리 — selAns와 동일한 후처리(EXP·복습·마스터리·세션 기록), 문제당 1회 잠금
function 직접입력_제출(screenId){
  const 입력 = 직접입력_꺼내기(screenId+'DirectInp', screenId+'DirectBtn');
  if(입력 === null) return;

  const 정답 = 현재퀴즈문제?.opts?.find(o=>o.c)?.t || '';
  const 문제요약 = 현재퀴즈문제?.q || '';
  const 정답여부 = 직접입력_규격(입력) !== '' && 직접입력_규격(입력) === 직접입력_규격(정답);
  const 결과 = document.getElementById(screenId+'DirectResult');

  if(결과) 결과.innerHTML = 결과상자_HTML(정답여부, 정답여부 ? 정답 : `정답: <b>${정답}</b>`);
  if(정답여부){
    const 획득 = EXP획득(20, '퀴즈 정답');
    if(결과) showExpFloat(결과,'+'+획득);
  }
  채점_기록(정답여부, 정답, 문제요약, 현재퀴즈문제?.cat || 현재학습모드);
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
    <button class="btn-acc q-next" style="width:100%;margin-top:12px" onclick="다음문제()"><span class="q-skip">건너뛰기</span><span class="q-go">다음 문제 →</span></button>
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
  const 타문항 = 셔플(data.filter(x=>x!==q).map(x=>x.q)).slice(0,3);
  const 보기들 = 셔플([...타문항.map(t=>({t, c:false})), {t:q.q, c:true}]);
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
    <button class="btn-acc q-next" style="width:100%" onclick="다음문제()"><span class="q-skip">건너뛰기</span><span class="q-go">다음 문제 →</span></button>
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
      showToastMsg('퍼펙트 세션! 5문제 모두 정답 · +150 EXP');
      업적_검사();
    } else {
      // U20(10-03): 5문제마다 한 번 끊어 알려 준다 — 종전엔 퍼펙트일 때만 알려 학습에 끝이 없었다
      showToastMsg(`5문제 마침 — ${5 - 퀴즈세션.오답}/5 정답`);
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

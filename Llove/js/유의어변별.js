// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   v3.7 B안: 유의어 변별 출제 (KNOWLEDGE 3-2섹션 + 5섹션 이의있음! 확장)
   - 정적 데이터(유의어변별데이터)로 데모용 출제 1회 시연
   - correct(초록) / acceptable(노랑+이유) / wrong(빨강) 3단계 분기
   - TODO Claude Code: 실제로 동작 — 출제 풀 확장, 4방식 분기, 실사용자 댓글 예문 결합
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let 유의어현재 = null;

/* ━━━ 세션9: 맥락형(예문 빈칸) 퀴즈 공용 엔진 — 원래 유의어 변별 전용이던 로직을 일반화해
   다른 화면(상식·어원/세계사·신화의 신규 「예문형」)에도 재사용한다. 판정 규칙(정답·근사·오답
   3단계 동시 공개 + EXP·복습·마스터리 연동)은 기존과 완전히 동일하다. ━━━ */
function 예문형_렌더(bodyId, item, 다음fn, 이의컨텍스트){
  const body = document.getElementById(bodyId);
  if(!body || !item) return;
  예문형_상태[bodyId] = {item, 다음fn};
  현재문제_reasoning_note = item.reasoning_note || '';

  // 4개 보기 = correct 1 + acceptable + wrong (랜덤 순서)
  const 보기풀 = [
    {w: item.correct.w, kind:'correct'},
    ...item.acceptable.map(a=>({w:a.w, kind:'acceptable'})),
    ...item.wrong.map(w=>({w:w.w, kind:'wrong'}))
  ].slice(0,4);
  for(let k=보기풀.length-1; k>0; k--){
    const j = Math.floor(Math.random()*(k+1));
    [보기풀[k], 보기풀[j]] = [보기풀[j], 보기풀[k]];
  }

  // 예문 빈칸 표시 — 공백 개수 변형에 견디도록 정규식 사용
  const 예문html = item.예문.replace(/\[\s*\]/, '<span class="syn-blank">?</span>');

  body.innerHTML = `
    <div class="syn-card">
      <div class="syn-q">${예문html}</div>
      <div class="syn-opts" id="${bodyId}SynOpts">
        ${보기풀.map(o=>`<button class="syn-opt" data-kind="${o.kind}" data-word="${o.w}" onclick="예문형_선택('${bodyId}', this)">${o.w}</button>`).join('')}
      </div>
      <div class="syn-result" id="${bodyId}SynResult"></div>
      <div class="syn-actions" id="${bodyId}SynActions" style="display:none">
        ${이의컨텍스트 ? `<button class="btn-g" onclick="openObj('${이의컨텍스트}')">⚖️ 이의있음!</button>` : ''}
        <button class="btn-acc" onclick="예문형_다음('${bodyId}')">다음 문제 →</button>
      </div>
    </div>
  `;
}

let 예문형_상태 = {};  // bodyId → {item, 다음fn}
function 예문형_선택(bodyId, btn){
  // 오류 수정: 결과 공개 후 보기 재클릭으로 EXP를 반복 획득하던 문제 — 1문제 1판정 가드
  const resultEl = document.getElementById(bodyId+'SynResult');
  if(resultEl?.classList.contains('show')) return;
  const state = 예문형_상태[bodyId];
  if(!state) return;
  const item = state.item;
  const 선택kind = btn.dataset.kind;
  const 선택word = btn.dataset.word;
  // 정답·근사·오답 색 동시 공개
  const all = document.querySelectorAll('#'+bodyId+'SynOpts .syn-opt');
  all.forEach(el=>{
    el.classList.add('dim');
    const k = el.dataset.kind;
    if(k === 'correct')   el.classList.add('correct');
    if(k === 'acceptable')el.classList.add('acceptable');
    if(k === 'wrong')     el.classList.add('wrong');
  });
  btn.classList.remove('dim');

  // 사용자 선택 결과 헤더
  const 헤더 =
    선택kind === 'correct'    ? `<div class="syn-result-title ok">✅ 정답 — 「${선택word}」를 선택했습니다</div>` :
    선택kind === 'acceptable' ? `<div class="syn-result-title warn">△ 근사 정답 — 「${선택word}」를 선택했습니다</div>` :
                                `<div class="syn-result-title err">✗ 오답 — 「${선택word}」를 선택했습니다</div>`;

  // 버그3 수정: 선택한 1개만이 아니라 보기 전부의 설명을 공개
  const 항목들 = Array.from(all).map(el=>{
    const k = el.dataset.kind;
    const w = el.dataset.word;
    const 선택됨 = (w === 선택word);
    let badge='', cls='', def='', reason='';
    if(k === 'correct'){
      badge='✅ 정답'; cls='ok'; def=item.correct.def;
    } else if(k === 'acceptable'){
      const a = item.acceptable.find(x=>x.w === w);
      badge='△ 근사'; cls='warn'; def=a?.def ?? ''; reason=a?.reason ?? '';
    } else {
      const x = item.wrong.find(y=>y.w === w);
      badge='✗ 오답'; cls='err'; def=x?.def ?? '';
    }
    return `
      <div class="syn-result-item${선택됨 ? ' picked' : ''}">
        <div class="syn-ri-head ${cls}">${badge} · 「${w}」${선택됨 ? ' <span class="syn-ri-pick">← 내 선택</span>' : ''}</div>
        <div class="syn-result-def">${def}</div>
        ${reason ? `<div class="syn-result-reason">${reason}</div>` : ''}
      </div>`;
  }).join('');

  // 세션10-c 항목1: 근사(acceptable) 판정 순간에만 지문 독해로 유도하는 넛지 — 데이터·판정 로직은
  // 그대로 두고(근사=EXP 없음 정책 유지) 더 넓은 맥락으로 변별하는 다른 모드를 안내만 한다.
  const 넛지 = 선택kind === 'acceptable'
    ? `<div class="syn-nudge">🔍 이 문항이 애매하셨나요? 더 넓은 맥락으로 판단하는 <b>지문 독해</b>를 추천합니다.
       <button class="btn-g" onclick="goLearn('지문 독해','sq6',null)">지문 독해로 가기</button></div>`
    : '';

  const res = document.getElementById(bodyId+'SynResult');
  res.innerHTML = 헤더 + `<div class="syn-result-all">${항목들}</div>` + 넛지;
  res.classList.add('show');
  document.getElementById(bodyId+'SynActions').style.display = 'flex';

  // 빌드1: 실제 EXP·마스터리 반영 — 정답 +20, 근사 정답은 EXP 없음 (KNOWLEDGE 3-2)
  if(선택kind === 'correct'){
    EXP획득(20, '예문형 정답');
    연속정답처리(true);
    복습대기열_정답처리(item.correct.w);
  } else {
    연속정답처리(false);
    // 오답·근사 → 정답 단어를 복습 대기열에 (예문 맥락 포함)
    복습대기열_추가(item.correct.w, `${item.correct.def} — 예문: ${item.예문}`, '예문형');
  }
  if(현재학습모드필드) 마스터리증가(현재학습모드필드);
  마스터리증가('총누적어휘수');
  세션결과_기록(선택kind === 'correct');
}
function 예문형_다음(bodyId){
  const state = 예문형_상태[bodyId];
  if(state && state.다음fn) state.다음fn();
}

function 유의어변별_렌더(인덱스){
  // β8: 정령왕 JSON 18건 풀에서 출제 (로드 실패 시 폴백 2건)
  const i = 인덱스 ?? Math.floor(Math.random() * 유의어출제풀.length);
  유의어현재 = 유의어출제풀[i];
  예문형_렌더('sq2Body', 유의어현재, 유의어변별_다음, 'synonym');
}
function 유의어변별_다음(){
  유의어변별_렌더();  // 다음 문제 랜덤
}

/* 세션9: 상식·어원 / 세계사·신화 「예문형」 임시 표본 —
   data/상식어원.json·세계사신화.json이 채워지면 그 풀로 교체 예정(세션3 임시보기와 동일 관리 방침) */
const 예문형_상식어원 = [
  {
    예문: '그는 회의 내내 [   ] 태도를 보이며 반대 의견을 굽히지 않았다.',
    correct:    {w:'완고한', def:'융통성 없이 자기 생각만 굳게 지키는'},
    acceptable: [{w:'고집스러운', def:'자기 뜻을 끝까지 굽히지 않는', reason:'의미는 비슷하나 다소 구어적인 표현'}],
    wrong: [{w:'유순한', def:'성질이 부드럽고 순함'}, {w:'소심한', def:'대담하지 못하고 조심성이 지나침'}]
  },
  {
    예문: '오랜 가뭄 끝에 내린 비는 농부들에게 [   ] 소식이었다.',
    correct:    {w:'반가운', def:'그리워하던 것을 얻어 마음이 즐거운'},
    acceptable: [{w:'기쁜', def:'마음에 즐거운 느낌이 있는', reason:'의미가 유사하나 안도감의 뉘앙스가 약함'}],
    wrong: [{w:'서운한', def:'마음에 모자라 아쉬운'}, {w:'무관심한', def:'관심이나 흥미가 없는'}]
  }
];
const 예문형_세계사신화 = [
  {
    예문: '그 장군은 전세가 불리해지자 [   ] 후퇴를 명령했다.',
    correct:    {w:'전략적', def:'목적 달성을 위한 계획에 따른'},
    acceptable: [{w:'신중한', def:'조심스럽고 깊이 생각하는', reason:'유사하나 계획성보다 조심성에 초점'}],
    wrong: [{w:'무모한', def:'앞뒤를 헤아리지 않고 마구 행동하는'}, {w:'즉흥적', def:'그 자리에서 문득 떠오른 느낌대로 하는'}]
  },
  {
    예문: '신화 속 영웅은 신들의 [   ]을 받아 불사의 몸이 되었다.',
    correct:    {w:'축복', def:'행복을 빎, 또는 신의 은혜'},
    acceptable: [{w:'가호', def:'신이 보호하여 도와줌', reason:'의미는 유사하나 다소 예스러운 표현'}],
    wrong: [{w:'저주', def:'남에게 재앙이나 불행이 일어나도록 빎'}, {w:'시험', def:'재능이나 정도를 알아보기 위해 검사함'}]
  }
];

/* 세션10-c: 문해력 2탄 — 지문 독해(sq6). "빈칸 채우기는 지문이 길어도 결국 단어 고르기일 뿐"이라는
   지적을 받아들여, 예문형 엔진(단어 4개 중 선택)을 버리고 지문+질문+문장형 보기(4개, 정답 1개)로
   교체 — 인지 과제 자체가 다르므로(요지 파악·추론·세부 일치 확인) 신규 엔진(독해_렌더/독해_선택).
   data/지문독해.json이 채워지면 그 풀로 교체 예정(예문형_상식어원과 동일 관리 방침). */
let 지문독해풀 = [
  {
    지문: '동생은 며칠째 방에서 나오지 않았다. 밥도 거의 먹지 않았고, 누가 말을 걸어도 대꾸조차 없었다. 예전엔 작은 일에도 깔깔대며 웃던 아이였는데, 요즘은 표정에 생기가 없었다. 가족들은 그런 동생의 모습에 걱정이 깊어갔지만, 정작 무슨 일이 있었는지는 아무도 알지 못했다.',
    질문: '이 글의 요지로 가장 적절한 것은?', 유형: '요지',
    보기: [
      {문장:'동생에게 생긴 변화의 이유는 알 수 없지만, 가족들은 그 상태를 우려하고 있다.', 정답:true,
       해설:'무기력·무반응·이유 불명·가족의 걱정을 모두 종합한 요지입니다.'},
      {문장:'동생은 원래 조용하고 말이 없는 성격이다.', 정답:false,
       해설:'지문은 "예전엔 잘 웃던 아이"라고 밝혀 원래 성격이 아니라 변화임을 보여줍니다.'},
      {문장:'가족들은 동생이 무슨 일을 겪었는지 이미 알고 있다.', 정답:false,
       해설:'지문은 "아무도 알지 못했다"고 명시합니다.'},
      {문장:'동생은 요즘 부쩍 밝아졌다.', 정답:false,
       해설:'지문 전체가 무기력·침체 상태를 서술해 정반대입니다.'}
    ]
  },
  {
    지문: '신제품 발표 후 초기 반응은 뜨거웠다. 예약 판매는 목표치를 훌쩍 넘겼고, 언론에서도 연일 호평을 쏟아냈다. 하지만 두 달이 지나자 매출 그래프는 완만하게 아래로 향했고, 재구매율도 눈에 띄게 줄었다. 마케팅팀은 초기 반응과 실제 사용 경험 사이에 간극이 있었던 것은 아닌지 점검하기 시작했다.',
    질문: '이 글에서 추론할 수 있는 내용으로 가장 적절한 것은?', 유형: '추론',
    보기: [
      {문장:'제품에 대한 초기 기대와 실제 사용 후 평가가 달랐을 가능성이 있다.', 정답:true,
       해설:'"초기 반응과 실제 사용 경험 사이 간극" 문장에서 직접 추론할 수 있습니다.'},
      {문장:'이 제품은 애초에 시장에서 전혀 주목받지 못했다.', 정답:false,
       해설:'초기 반응은 뜨거웠다고 명시돼 있어 사실과 다릅니다.'},
      {문장:'마케팅팀은 문제의 원인을 이미 파악해 해결책을 내놓았다.', 정답:false,
       해설:'"점검하기 시작했다"는 조사 착수 단계일 뿐, 해결 여부는 언급되지 않습니다.'},
      {문장:'매출은 두 달 내내 꾸준히 상승했다.', 정답:false,
       해설:'매출이 완만하게 하강했다고 명시돼 있어 정반대입니다.'}
    ]
  },
  {
    지문: '양측 대표단은 이른 아침부터 회의장에 모였다. 초반에는 협상이 순조롭게 진행되는 듯 보였고, 몇몇 부수적인 조항에서는 빠르게 합의가 이뤄졌다. 그러나 핵심 쟁점인 비용 분담 문제에 이르자 양측은 한 치도 물러서지 않았다. 결국 회의는 결론 없이 다음 주로 미뤄졌다.',
    질문: '다음 중 이 글의 내용과 일치하는 것은?', 유형: '세부',
    보기: [
      {문장:'핵심 쟁점을 둘러싼 이견 때문에 협상이 이번 회의에서 마무리되지 못했다.', 정답:true,
       해설:'마지막 문장 "결론 없이 다음 주로 미뤄졌다"와 직접 일치합니다.'},
      {문장:'모든 조항에서 합의가 이뤄져 협상이 성공적으로 끝났다.', 정답:false,
       해설:'핵심 쟁점에서는 합의가 이뤄지지 않았습니다.'},
      {문장:'협상은 시작부터 순탄치 않아 대표단이 일찍 자리를 떴다.', 정답:false,
       해설:'초반에는 순조로웠다고 명시돼 있어 사실과 다릅니다.'},
      {문장:'비용 분담 문제는 이번 회의에서 언급되지 않았다.', 정답:false,
       해설:'비용 분담 문제가 핵심 쟁점으로 명시적으로 다뤄졌습니다.'}
    ]
  },
  {
    지문: '오래전 한 마을에서는 우물물이 점점 탁해지는 일이 반복됐다. 주민들은 처음엔 날씨 탓이라 여기고 대수롭지 않게 넘겼다. 그러나 탁한 물이 반년 넘게 이어지자, 몇몇 사람들이 우물 주변 땅을 살피기 시작했고, 근처에 새로 지은 축사에서 흘러나온 물이 지하로 스며들고 있었다는 사실을 알게 되었다.',
    질문: '이 글에서 추론할 수 있는 것은?', 유형: '추론',
    보기: [
      {문장:'주민들은 문제의 원인을 처음엔 잘못 짐작했다가 나중에야 바로잡았다.', 정답:true,
       해설:'"날씨 탓"이라 여겼다가 실제 원인(축사 오염수)을 뒤늦게 발견한 흐름에서 추론할 수 있습니다.'},
      {문장:'우물물은 처음부터 축사 때문에 탁해진다는 것이 알려져 있었다.', 정답:false,
       해설:'처음엔 날씨 탓으로 여겼다고 명시돼 있어 사실과 다릅니다.'},
      {문장:'마을 주민들은 문제를 전혀 해결하지 못했다.', 정답:false,
       해설:'지문은 원인을 알아냈다는 사실까지만 서술해, "전혀 해결 못했다"는 과도한 단정입니다.'},
      {문장:'우물물 문제는 하루 만에 해결되었다.', 정답:false,
       해설:'"반년 넘게 이어졌다"고 명시돼 있어 사실과 다릅니다.'}
    ]
  }
];
let 독해_상태 = {item:null};
function 독해_렌더(){
  if(!지문독해풀.length) return;
  const body = document.getElementById('sq6Body');
  if(!body) return;
  const 항목 = 지문독해풀[Math.floor(Math.random()*지문독해풀.length)];
  독해_상태.item = 항목;
  const 순서 = 항목.보기.map((_,i)=>i);
  for(let k=순서.length-1;k>0;k--){ const j=Math.floor(Math.random()*(k+1)); [순서[k],순서[j]]=[순서[j],순서[k]]; }
  body.innerHTML = `
    <div class="syn-card">
      <div class="rc-tag">${항목.유형}</div>
      <div class="rc-passage">${항목.지문}</div>
      <div class="rc-q">${항목.질문}</div>
      <div class="rc-opts" id="sq6RcOpts">
        ${순서.map(idx=>`<button class="rc-opt" data-idx="${idx}" data-correct="${항목.보기[idx].정답}" onclick="독해_선택(this)">${항목.보기[idx].문장}</button>`).join('')}
      </div>
      <div class="syn-result" id="sq6RcResult"></div>
      <div class="syn-actions" id="sq6RcActions" style="display:none">
        <button class="btn-acc" onclick="독해_렌더()">다음 지문 →</button>
      </div>
    </div>
  `;
}
function 독해_선택(btn){
  const resultEl = document.getElementById('sq6RcResult');
  if(resultEl?.classList.contains('show')) return;  // 1문제 1판정 가드(예문형_선택과 동일 패턴)
  const item = 독해_상태.item;
  if(!item) return;
  const 선택idx = parseInt(btn.dataset.idx, 10);
  const 정답여부 = btn.dataset.correct === 'true';

  document.querySelectorAll('#sq6RcOpts .rc-opt').forEach(el=>{
    el.classList.add('dim');
    el.classList.add(el.dataset.correct === 'true' ? 'correct' : 'wrong');
  });
  btn.classList.remove('dim');

  const 헤더 = 정답여부
    ? `<div class="syn-result-title ok">✅ 정답입니다</div>`
    : `<div class="syn-result-title err">✗ 오답입니다</div>`;
  const 항목들 = item.보기.map((b,i)=>{
    const 선택됨 = i === 선택idx;
    return `
      <div class="syn-result-item${선택됨 ? ' picked' : ''}">
        <div class="syn-ri-head ${b.정답 ? 'ok' : 'err'}">${b.정답 ? '✅ 정답' : '✗ 오답'}${선택됨 ? ' <span class="syn-ri-pick">← 내 선택</span>' : ''}</div>
        <div class="syn-result-def">${b.문장}</div>
        <div class="syn-result-reason">${b.해설}</div>
      </div>`;
  }).join('');
  resultEl.innerHTML = 헤더 + `<div class="syn-result-all">${항목들}</div>`;
  resultEl.classList.add('show');
  document.getElementById('sq6RcActions').style.display = 'flex';

  // 빌드1: 실제 EXP·마스터리 반영 — 정답 +20. 오답은 EXP 없음.
  // 복습대기열은 "단어" 단위 설계라 지문·질문 단위인 독해 문항은 넣지 않음(설계 불일치 — 억지로 끼워맞추지 않음)
  if(정답여부) EXP획득(20, '지문 독해 정답');
  연속정답처리(정답여부);
  if(현재학습모드필드) 마스터리증가(현재학습모드필드);
  세션결과_기록(정답여부);
}

/* 세션10-m: 문해력 2탄 — 문장 배열(D안). 뒤섞인 문장을 탭한 순서대로 배치해 원래(정답) 순서를 맞춘다.
   드래그 대신 "순서대로 탭 → 번호 배지" 방식(.aopt/.onum 재사용) — 모바일 안정성 우선.
   문장들은 정답 순서로 저장하고 화면에서만 셔플 — 탭한 원본 인덱스열이 [0..N-1]이면 정답.
   data/문장배열.json이 채워지면 그 풀로 교체 예정(지문독해풀과 동일 관리 방침). */
let 문장배열풀 = [
  {
    문장들: [
      '회사는 신제품 출시를 앞두고 대대적인 광고를 준비했다.',
      '그러나 출시 하루 전, 핵심 부품 공급에 문제가 생겼다.',
      '결국 출시일은 급하게 2주 연기되었다.',
      '소비자들 사이에서는 아쉬움과 함께 기대감이 오히려 커졌다.'
    ],
    해설: '"그러나"가 준비 단계에서 문제 발생으로의 전환을, "결국"이 그 문제의 결과(연기)를 나타내고, 마지막 문장은 연기 이후의 반응입니다 — 이 순서를 벗어나면 인과관계가 성립하지 않습니다.'
  },
  {
    문장들: [
      '아이는 처음 자전거에 올라탔을 때 몇 번이고 넘어졌다.',
      '그때마다 아버지는 묵묵히 자전거를 다시 세워주었다.',
      '몇 주가 지나자 아이는 혼자서도 균형을 잡을 수 있게 되었다.',
      '그날 저녁, 아이는 동네 한 바퀴를 씽씽 달리며 웃었다.'
    ],
    해설: '"그때마다"는 앞 문장(넘어짐)을 전제로 하고, "몇 주가 지나자"는 시간이 흐른 뒤의 성장을, "그날 저녁"은 그 성장의 결실을 보여주는 마지막 장면입니다.'
  },
  {
    문장들: [
      '가뭄이 계속되자 저수지의 물이 눈에 띄게 줄어들었다.',
      '농민들은 남은 물을 아끼려 순서를 정해 밭에 물을 댔다.',
      '그럼에도 작물 일부는 말라 죽는 것을 피하지 못했다.',
      '다행히 다음 달 초, 오랜만에 단비가 내리며 사정이 나아졌다.'
    ],
    해설: '"그럼에도"는 대응(순서를 정해 물 대기)에도 불구하고 피해가 있었음을, "다행히"는 그 뒤에 상황이 호전됐음을 나타내는 연결어라 순서가 고정됩니다.'
  }
];
let 문장배열_상태 = {item:null, 표시순서:[], 탭순서:[]};

function 문장배열_렌더(){
  if(!문장배열풀.length) return;
  const body = document.getElementById('sq7Body');
  if(!body) return;
  const 항목 = 문장배열풀[Math.floor(Math.random()*문장배열풀.length)];
  let 순서 = 항목.문장들.map((_,i)=>i);
  do{ // 셔플이 우연히 정답 순서와 같으면 재셔플(4문장 기준이라 드물지 않아 방지)
    for(let k=순서.length-1;k>0;k--){ const j=Math.floor(Math.random()*(k+1)); [순서[k],순서[j]]=[순서[j],순서[k]]; }
  }while(순서.every((v,i)=>v===i));
  문장배열_상태 = {item:항목, 표시순서:순서, 탭순서:[]};
  body.innerHTML = `
    <div class="syn-card">
      <div class="rc-tag">문장 배열</div>
      <div class="modal-desc" style="font-size:11px;margin-bottom:10px">읽히는 순서대로 문장을 탭하세요(다시 탭하면 취소). 다 배치했으면 제출하세요.</div>
      <div class="aopts" id="sq7Opts">
        ${순서.map(원본idx=>`<div class="aopt" data-원본="${원본idx}" onclick="문장배열_탭(this)"><div class="onum"></div><div class="otxt">${항목.문장들[원본idx]}</div></div>`).join('')}
      </div>
      <div class="syn-actions" id="sq7Actions">
        <button class="btn-g" style="flex:1" onclick="문장배열_초기화()">↺ 다시 배치</button>
        <button class="btn-acc dim" id="sq7SubmitBtn" style="flex:1" onclick="문장배열_제출()">제출하기</button>
      </div>
      <div class="syn-result" id="sq7Result"></div>
      <div class="syn-actions" id="sq7NextActions" style="display:none"><button class="btn-acc" onclick="문장배열_렌더()">다음 문제 →</button></div>
    </div>
  `;
}
// 이미 순번이 매겨진 문장을 다시 탭하면 그 배치를 취소(splice)하고, 뒤 문장들의 순번을 당겨서 다시 매긴다.
function 문장배열_탭(el){
  const st = 문장배열_상태;
  if(!st.item || el.classList.contains('disabled')) return;
  const 원본idx = parseInt(el.dataset.원본, 10);
  const 위치 = st.탭순서.indexOf(원본idx);
  if(위치 === -1){
    if(st.탭순서.length >= st.item.문장들.length) return;  // 방어 — 이미 다 찼으면 무시
    st.탭순서.push(원본idx);
  } else {
    st.탭순서.splice(위치, 1);  // 재탭 = 배치 취소
  }
  문장배열_번호갱신();
}
// 탭 순서열을 바탕으로 번호 배지·「picked」 표시·제출 버튼 활성 상태를 다시 그린다.
function 문장배열_번호갱신(){
  const st = 문장배열_상태;
  document.querySelectorAll('#sq7Opts .aopt').forEach(el=>{
    const 원본idx = parseInt(el.dataset.원본, 10);
    const 위치 = st.탭순서.indexOf(원본idx);
    el.classList.toggle('picked', 위치 !== -1);
    el.querySelector('.onum').textContent = 위치 === -1 ? '' : (위치 + 1);
  });
  const 제출버튼 = document.getElementById('sq7SubmitBtn');
  if(제출버튼) 제출버튼.classList.toggle('dim', st.탭순서.length !== st.item.문장들.length);
}
function 문장배열_초기화(){
  const st = 문장배열_상태;
  if(!st.item) return;
  st.탭순서 = [];
  문장배열_번호갱신();
}
// 4개 전부 배치했을 때만(제출 버튼이 활성 상태일 때만) 실제 판정으로 넘어간다.
function 문장배열_제출(){
  const st = 문장배열_상태;
  if(!st.item || st.탭순서.length !== st.item.문장들.length) return;
  문장배열_판정();
}
function 문장배열_판정(){
  const st = 문장배열_상태, item = st.item;
  document.getElementById('sq7Actions').style.display = 'none';
  const 전체정답 = st.탭순서.every((v,i)=>v===i);
  // 세션10-n: 이전엔 렌더 시 넣어둔 inline animation-delay(fadeUp 등장 연출용)가 여기서 그대로
  // 남아있어 correctPop/shakeLR 판정 애니메이션까지 문장마다 0.05~0.2초씩 밀려 시작되며 어색하게
  // 보였다 — 렌더 단계에서 inline delay 자체를 넣지 않도록 고쳐(CSS .aopt:nth-child가 이미 등장
  // 연출을 담당) 판정 애니메이션이 4개 전부 동시에 자연스럽게 재생되도록 함.
  document.querySelectorAll('#sq7Opts .aopt').forEach(el=>{
    el.classList.add('disabled');
    // 세션10-o: 'picked'(탭 진행 중 표시)를 남겨두면 같은 특이도의 후속 CSS 규칙(.aopt.picked .onum)이
    // .aopt.correct/.wrong .onum보다 스타일시트 순서상 나중이라 배지 색이 정답/오답으로 안 바뀌는
    // 버그가 있었다 — 판정 시 반드시 picked를 먼저 떼어내야 정답=초록/오답=빨강이 제대로 보인다.
    el.classList.remove('picked');
    const 원본idx = parseInt(el.dataset.원본, 10);
    const 사용자위치 = st.탭순서.indexOf(원본idx);
    el.classList.add(사용자위치 === 원본idx ? 'correct' : 'wrong');
  });
  const 헤더 = 전체정답
    ? `<div class="syn-result-title ok">✅ 정답입니다</div>`
    : `<div class="syn-result-title err">✗ 순서가 틀렸습니다</div>`;
  const 정답나열 = item.문장들.map((s,i)=>`${i+1}. ${s}`).join('<br>');
  const resultEl = document.getElementById('sq7Result');
  resultEl.innerHTML = 헤더 + `<div class="syn-result-def" style="margin-top:8px">${정답나열}</div>` +
    (item.해설 ? `<div class="syn-result-reason">${item.해설}</div>` : '');
  resultEl.classList.add('show');
  document.getElementById('sq7NextActions').style.display = 'flex';

  // 빌드1: 실제 EXP·마스터리 반영 — 전체 정답 시에만 +20(부분 정답 개념 없음, 지문 독해와 동일 규모)
  if(전체정답) EXP획득(20, '문장 배열 정답');
  연속정답처리(전체정답);
  if(현재학습모드필드) 마스터리증가(현재학습모드필드);
  세션결과_기록(전체정답);
}

function initFlashcard(){
  document.getElementById('fcBack')?.classList.remove('show');
  document.getElementById('fcMore')?.classList.remove('show');
  document.getElementById('fcMoreBtn')?.classList.remove('opened');
  // 세션5: 이전 카드의 판정 1회 잠금 해제 — 미해제 시 다음 카드에서 판정 버튼이 먹통이 됨
  document.querySelector('#sq2Body .fc-judge')?.removeAttribute('data-판정완료');
}
/* 플래시카드 앞면 → 뒷면 공개 (① 읽기, ② 뜻) */
function flipCard(){
  document.getElementById('fcBack').classList.add('show');
}
/* 「더 알아보기」 펼침 — ③ 한자 / ④ 직설 / ⑤ 예문 / ⑥ 연상법 */
function showMore(){
  document.getElementById('fcMore').classList.add('show');
  document.getElementById('fcMoreBtn').classList.add('opened');
}
/* 판정 버튼 — 알았다 / 헷갈린다 / 몰랐다 */
function judgeCard(type){
  // 오류 수정: 판정 버튼 연타로 EXP를 반복 획득하던 문제 — 카드당 1회만 판정
  const 판정영역 = document.querySelector('#sq2Body .fc-judge');
  if(판정영역){
    if(판정영역.dataset.판정완료) return;
    판정영역.dataset.판정완료 = '1';
  }
  const messages={
    'know':'알았다 — 복습 대기열 졸업 카운트 +1',
    'confused':'헷갈린다 — 복습 대기열 유지',
    'unknown':'몰랐다 — 복습 대기열 카운트 초기화'
  };
  showToastMsg('✓ ' + messages[type]);
  // 복습 대기열 연동 — 카드 정보 (읽기 (한자) 형식)
  const 카드단어 = 현재플래시카드 ? `${현재플래시카드.reading} (${현재플래시카드.word})` : '';
  const 카드뜻 = 현재플래시카드?.meaning || '';
  const 카드모드 = 현재플래시카드?.cat || 현재학습모드;
  // 빌드1: 실제 EXP 획득 — 알았다 +20 / 헷갈린다 +8 (KNOWLEDGE 12)
  if(type==='know'){
    const 획득 = EXP획득(20, '플래시카드 알았다');
    const btn=document.querySelector('.fc-jbtn.j-know');
    if(btn) showExpFloat(btn,'+'+획득);
    if(카드단어) 복습대기열_정답처리(카드단어);  // 알았다 → 졸업 카운트 +1 (KNOWLEDGE 7)
  } else {
    if(type==='confused') EXP획득(8, '플래시카드 헷갈린다');
    if(카드단어) 복습대기열_추가(카드단어, 카드뜻, 카드모드);  // 헷갈린다·몰랐다 → 대기열 (몰랐다는 카운트 초기화)
  }
  // 모드별 마스터리(언어의뿌리학습수) + 누적 어휘 +1
  if(현재학습모드필드) 마스터리증가(현재학습모드필드);
  마스터리증가('총누적어휘수');
}

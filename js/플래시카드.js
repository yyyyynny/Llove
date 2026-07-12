// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   플래시카드
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const FC_GOSAEONGEO=[
  {
    cat:'고사성어',word:'苛斂誅求',mark:'한자어',
    reading:'가렴주구',
    meaning:'세금을 혹독하게 거두고 재물을 강제로 빼앗음. 가혹한 정치를 비유적으로 이르는 말.',
    hanja:[
      ['苛','가혹할 가'],
      ['斂','거둘 렴'],
      ['誅','벨 주'],
      ['求','구할 구']
    ],
    direct:'나랏님이 백성 등골 빼먹는 거. 옛날 탐관오리들이 세금이라는 명목으로 닥치는 대로 뜯어가던 그 짓이다.',
    example:'그 시대 탐관오리들의 가렴주구에 백성들은 굶주릴 수밖에 없었다.',
    mnemonic:'가혹하게 / 렴치없이 / 주구장창 / 구해(뺏어) 가는 것'
  }
];
const FC_HANJA=[
  {
    cat:'한자어',word:'必然',mark:'한자어',
    reading:'필연',
    meaning:'사물의 관련이나 일의 결과가 반드시 그렇게 될 수밖에 없음. 또는 그런 일.',
    hanja:[
      ['必','반드시 필'],
      ['然','그럴 연']
    ],
    direct:'안 그럴 수가 없는 거. 우연(偶然)의 반대말이다.',
    example:'두 사람의 만남은 단순한 우연이 아니라 운명의 필연이었다.',
    mnemonic:'반드시(必) 그렇게(然) 되는 것'
  }
];

/* ⚠️⚠️ 임시 하드코딩 — 추후 반드시 교체할 것 (최고 관리자님 지시 2026-06-14) ⚠️⚠️
   [사유] sq2 '4지선다'·'역방향'은 오답 보기 3개를 만들 표본이 필요하나,
          data/고사성어속담.json·data/한자우리말.json 이 현재 빈 파일이라
          내장 풀(FC_GOSAEONGEO·FC_HANJA)이 각 1건뿐이다.
          보기 구성을 위해 아래 임시 표본을 둔다. (가상 데이터 아님 — 실제 뜻이지만 임시 배치)
   [교체 방법] data/ JSON DB가 채워지면 sq2_출제풀()이 그 풀을 우선 사용하므로,
          이 두 임시 배열은 그대로 둬도 무방하고(중복 단어 자동 배제) 제거해도 된다.
   [기록] 작업인계_노트.md(다음 세션 인계) + KNOWLEDGE 37 진행현황에 동일 내용 명시함.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const FC_고사성어_임시보기 = [
  {cat:'고사성어',word:'語不成說',mark:'한자어',reading:'어불성설',
   meaning:'말이 조금도 사리에 맞지 아니함.',
   hanja:[['語','말씀 어'],['不','아닐 불'],['成','이룰 성'],['說','말씀 설']],
   direct:'말이 말 같지도 않은 거. 앞뒤가 하나도 안 맞는 소리.',
   example:'증거도 없이 남을 범인이라 우기다니, 어불성설이다.',
   mnemonic:'말(語)이 말(說)을 이루지(成) 못함(不)'},
  {cat:'고사성어',word:'四面楚歌',mark:'한자어',reading:'사면초가',
   meaning:'아무에게도 도움을 받지 못하는 외롭고 곤란한 지경에 빠진 형편.',
   hanja:[['四','넉 사'],['面','낯 면'],['楚','초나라 초'],['歌','노래 가']],
   direct:'사방이 다 적인 막다른 상황. 어디로도 못 빠져나가는 처지.',
   example:'지원군은 끊기고 식량마저 떨어져 그는 사면초가에 몰렸다.',
   mnemonic:'네(四) 방면(面)에서 초나라(楚) 노래(歌)가 들려옴'},
  {cat:'고사성어',word:'塞翁之馬',mark:'한자어',reading:'새옹지마',
   meaning:'인생의 길흉화복은 변화가 많아 예측하기 어렵다는 말.',
   hanja:[['塞','변방 새'],['翁','늙은이 옹'],['之','갈 지'],['馬','말 마']],
   direct:'좋은 일이 나쁜 일 되고 나쁜 일이 좋은 일 되는 게 인생이라는 뜻.',
   example:'시험에 떨어졌지만 새옹지마라고, 덕분에 더 좋은 길을 찾았다.',
   mnemonic:'변방(塞) 노인(翁)의(之) 말(馬) 이야기'},
  {cat:'고사성어',word:'愚公移山',mark:'한자어',reading:'우공이산',
   meaning:'어떤 일이든 끈기 있게 노력하면 마침내 큰일을 이룰 수 있음.',
   hanja:[['愚','어리석을 우'],['公','공평할 공'],['移','옮길 이'],['山','메 산']],
   direct:'미련해 보여도 꾸준히 하면 산도 옮긴다는 뜻.',
   example:'우공이산의 자세로 매일 조금씩 공부해 끝내 합격했다.',
   mnemonic:'우공(愚公)이 산(山)을 옮긴다(移)'},
  {cat:'고사성어',word:'見物生心',mark:'한자어',reading:'견물생심',
   meaning:'어떠한 실물을 보게 되면 그것을 가지고 싶은 욕심이 생김.',
   hanja:[['見','볼 견'],['物','물건 물'],['生','날 생'],['心','마음 심']],
   direct:'물건을 보면 갖고 싶어지는 사람 마음.',
   example:'진열장의 시계를 보자 견물생심으로 지갑을 열고 말았다.',
   mnemonic:'물건(物)을 보면(見) 마음(心)이 생긴다(生)'}
];
const FC_한자_임시보기 = [
  {cat:'한자어',word:'矛盾',mark:'한자어',reading:'모순',
   meaning:'어떤 사실의 앞뒤 또는 두 사실이 이치상 서로 맞지 않음.',
   hanja:[['矛','창 모'],['盾','방패 순']],
   direct:'창과 방패 이야기. 말이 서로 안 맞는 것.',
   example:'그의 주장은 처음과 끝이 모순되어 설득력이 없었다.',
   mnemonic:'창(矛)과 방패(盾)가 부딪힘'},
  {cat:'한자어',word:'杞憂',mark:'한자어',reading:'기우',
   meaning:'앞일에 대해 쓸데없는 걱정을 함. 또는 그런 걱정.',
   hanja:[['杞','나라이름 기'],['憂','근심 우']],
   direct:'하늘이 무너질까 걱정한 기나라 사람처럼 부질없는 걱정.',
   example:'비가 올까 걱정했지만 기우였고 하루 종일 맑았다.',
   mnemonic:'기(杞)나라 사람의 근심(憂)'},
  {cat:'한자어',word:'白眉',mark:'한자어',reading:'백미',
   meaning:'여럿 가운데에서 가장 뛰어난 사람이나 훌륭한 물건.',
   hanja:[['白','흰 백'],['眉','눈썹 미']],
   direct:'그중에서 제일 잘난 것. 하이라이트.',
   example:'이 전시의 백미는 단연 마지막 방의 대형 회화였다.',
   mnemonic:'흰(白) 눈썹(眉)이 가장 뛰어났다는 고사'},
  {cat:'한자어',word:'壓卷',mark:'한자어',reading:'압권',
   meaning:'여럿 가운데 가장 뛰어난 것.',
   hanja:[['壓','누를 압'],['卷','책 권']],
   direct:'단연 최고. 다른 걸 다 눌러버리는 것.',
   example:'공연의 압권은 모두가 함께 부른 마지막 합창이었다.',
   mnemonic:'다른 책(卷)을 눌러(壓) 맨 위에 둠'},
  {cat:'한자어',word:'登龍門',mark:'한자어',reading:'등용문',
   meaning:'어려운 관문을 통과하여 크게 출세하게 됨을 이르는 말.',
   hanja:[['登','오를 등'],['龍','용 룡'],['門','문 문']],
   direct:'잉어가 폭포를 넘어 용이 되는 관문. 출세의 길목.',
   example:'그 대회는 신인 음악가들의 등용문으로 불린다.',
   mnemonic:'용(龍)이 되어 오르는(登) 문(門)'}
];

/* sq2 4지선다·역방향 출제용 통합 풀 — 실제/DB 풀(출제_분기 결과) + 임시 표본을 합쳐
   보기 4개 미달을 방지한다. 단어 중복은 배제한다. (DB가 채워지면 자연히 풍부해짐) */
function sq2_출제풀(category){
  const 기본 = category === '한자·우리말' ? FC_HANJA : FC_GOSAEONGEO;
  const 임시 = category === '한자·우리말' ? FC_한자_임시보기 : FC_고사성어_임시보기;
  const 실풀 = 출제_분기(category, 기본);
  const 합 = Array.isArray(실풀) ? [...실풀] : [];
  임시.forEach(c=>{ if(!합.some(x=>x.word === c.word)) 합.push(c); });
  return 합;
}

/* 배열 제자리 셔플 (Fisher–Yates) — sq2 4지선다·역방향 보기 순서 무작위화 */
function sq2_셔플(arr){
  for(let k=arr.length-1; k>0; k--){
    const j = Math.floor(Math.random()*(k+1));
    [arr[k], arr[j]] = [arr[j], arr[k]];
  }
  return arr;
}

/* sq2 '4지선다' — 뜻을 제시하고 단어 4개 중 정답을 고른다. 정답 처리는 기존 selAns 재사용. */
function sq2_사지선다_렌더(category){
  const body = document.getElementById('sq2Body');
  if(!body) return;
  const 풀 = sq2_출제풀(category);
  if(풀.length < 4){
    // 보기 표본 부족 시 안전 폴백 — 플래시카드로 출제 (기능 누락 방지)
    showToastMsg('보기 표본이 부족해 플래시카드로 출제합니다');
    renderFlashcard(풀.length ? 풀 : (category === '한자·우리말' ? FC_HANJA : FC_GOSAEONGEO));
    return;
  }
  const 정답 = 풀[Math.floor(Math.random()*풀.length)];
  const 오답 = sq2_셔플(풀.filter(c=>c.word !== 정답.word)).slice(0,3);
  const 보기 = sq2_셔플([정답, ...오답]);
  현재플래시카드 = 정답;  // 복습/연동 참고용
  현재문제_reasoning_note = 정답.reasoning_note || '';
  // selAns의 복습 대기열 연동을 위해 현재퀴즈문제를 4지선다 형식으로 구성 (정답보기=단어, 문제=뜻)
  현재퀴즈문제 = { q: 정답.meaning, cat: 정답.cat, opts: 보기.map(c=>({t:c.word, c: c.word===정답.word})) };
  let optsHtml = '';
  보기.forEach((c,i)=>{
    // selAns 오답 강조 로직이 onclick 문자열의 'true'를 찾으므로 boolean(true/false)으로 전달 (기존 4지선다와 동일 규약)
    optsHtml += `<div class="aopt" onclick="selAns(this,${c.word===정답.word ? 'true' : 'false'})"><div class="onum">${i+1}</div><div class="otxt">${c.word} <small style="color:var(--txt2)">${c.reading}</small></div></div>`;
  });
  body.innerHTML = `
    <div class="qcard">
      <div class="qcat"><span class="tag ta">${정답.cat}</span></div>
      <div class="q-question">다음 뜻에 해당하는 말은?<div style="font-weight:400;font-size:14px;color:var(--txt2);margin-top:6px;line-height:1.6">${정답.meaning}</div></div>
    </div>
    <div class="aopts">${optsHtml}</div>
    <div class="exp-gain"><div class="egl">정답 시 획득</div><div class="egv">+20 EXP ✨</div></div>
    <button class="btn-acc" style="width:100%" onclick="sq2_출제_렌더(document.getElementById('sq2Title').textContent)">다음 문제 →</button>
  `;
}

/* sq2 '역방향' — 단어를 제시하고 뜻 4개 중 정답을 고른다. (4지선다의 문제/보기 방향만 반대) */
function sq2_역방향_렌더(category){
  const body = document.getElementById('sq2Body');
  if(!body) return;
  const 풀 = sq2_출제풀(category);
  if(풀.length < 4){
    showToastMsg('보기 표본이 부족해 플래시카드로 출제합니다');
    renderFlashcard(풀.length ? 풀 : (category === '한자·우리말' ? FC_HANJA : FC_GOSAEONGEO));
    return;
  }
  const 정답 = 풀[Math.floor(Math.random()*풀.length)];
  const 오답 = sq2_셔플(풀.filter(c=>c.word !== 정답.word)).slice(0,3);
  const 보기 = sq2_셔플([정답, ...오답]);
  현재플래시카드 = 정답;
  현재문제_reasoning_note = 정답.reasoning_note || '';
  // 역방향은 '뜻'이 보기이므로, 복습 연동상 정답보기=뜻으로 기록됨(단어/뜻 방향만 반대) — 의도된 동작
  현재퀴즈문제 = { q: `${정답.word} (${정답.reading})`, cat: 정답.cat, opts: 보기.map(c=>({t:c.meaning, c: c.word===정답.word})) };
  let optsHtml = '';
  보기.forEach((c,i)=>{
    // 역방향도 동일하게 boolean 전달 (selAns의 'true' 문자열 탐지 규약)
    optsHtml += `<div class="aopt" onclick="selAns(this,${c.word===정답.word ? 'true' : 'false'})"><div class="onum">${i+1}</div><div class="otxt" style="line-height:1.5">${c.meaning}</div></div>`;
  });
  body.innerHTML = `
    <div class="qcard">
      <div class="qcat"><span class="tag ta">${정답.cat} · 역방향</span></div>
      <div class="q-question">${정답.word} <small style="color:var(--txt2);font-weight:400">${정답.reading}</small><div style="font-weight:400;font-size:13px;color:var(--txt2);margin-top:6px">이 말의 뜻으로 옳은 것은?</div></div>
    </div>
    <div class="aopts">${optsHtml}</div>
    <div class="exp-gain"><div class="egl">정답 시 획득</div><div class="egv">+20 EXP ✨</div></div>
    <button class="btn-acc" style="width:100%" onclick="sq2_출제_렌더(document.getElementById('sq2Title').textContent)">다음 문제 →</button>
  `;
}

/* sq2 '뜻 직접 서술' — 단어를 제시하고 사용자가 뜻을 직접 입력한 뒤, 모범 뜻을 공개해 자가 점검.
   설계 의도대로 AI 채점은 없다(Grok 봉인). 자유 입력 → 공개 → 다음 문제. */
let sq2_서술현재 = null;
function sq2_뜻서술_렌더(category){
  const body = document.getElementById('sq2Body');
  if(!body) return;
  const 풀 = sq2_출제풀(category);
  if(!풀.length){ renderFlashcard(category === '한자·우리말' ? FC_HANJA : FC_GOSAEONGEO); return; }
  const 문항 = 풀[Math.floor(Math.random()*풀.length)];
  sq2_서술현재 = 문항;
  현재플래시카드 = 문항;
  현재문제_reasoning_note = 문항.reasoning_note || '';
  body.innerHTML = `
    <div class="qcard">
      <div class="qcat"><span class="tag ta">${문항.cat} · 뜻 직접 서술</span></div>
      <div class="q-question">${문항.word} <small style="color:var(--txt2);font-weight:400">${문항.reading}</small></div>
      <div style="font-size:12px;color:var(--txt2);margin-top:6px">이 말의 뜻을 직접 적어 본 뒤 모범 뜻과 비교해 보세요. (AI 채점 없음)</div>
    </div>
    <textarea id="sq2WriteInput" class="ask-input" style="width:100%;min-height:80px;resize:none;margin-top:4px" placeholder="뜻을 직접 입력해 보세요..."></textarea>
    <div id="sq2WriteReveal" style="display:none;margin-top:10px" class="qcard">
      <div class="egl" style="color:var(--acc);font-weight:700;margin-bottom:6px">모범 뜻</div>
      <div style="font-size:14px;line-height:1.7">${문항.meaning}</div>
      <div style="font-size:12px;color:var(--txt2);margin-top:8px">예문 — ${문항.example}</div>
    </div>
    <button class="btn-acc" id="sq2WriteBtn" style="width:100%;margin-top:10px" onclick="sq2_뜻서술_공개()">뜻 확인하기</button>
  `;
}
function sq2_뜻서술_공개(){
  const reveal = document.getElementById('sq2WriteReveal');
  const btn = document.getElementById('sq2WriteBtn');
  if(!reveal || !btn) return;
  if(reveal.style.display === 'none'){
    reveal.style.display = 'block';
    btn.textContent = '다음 문제 →';
    // 자가 학습 보상 — 플래시카드 자가판정과 동일 맥락의 소량 EXP (KNOWLEDGE: 플래시카드 +8)
    EXP획득(8, '뜻 직접 서술');
    if(현재학습모드필드) 마스터리증가(현재학습모드필드);
    마스터리증가('총누적어휘수');
  } else {
    sq2_출제_렌더(document.getElementById('sq2Title').textContent);
  }
}
function renderFlashcard(data){
  const body=document.getElementById('sq2Body');
  const c=data[Math.floor(Math.random()*data.length)];
  현재플래시카드 = c;  // 복습 대기열 연동용
  현재문제_reasoning_note = c.reasoning_note || '';
  let hanjaHtml='';
  c.hanja.forEach(h=>{
    hanjaHtml+=`<div class="fc-hanja-item">${h[0]} <small>${h[1]}</small></div>`;
  });
  body.innerHTML=`
    <div class="fc-card" id="fcCard">
      <div class="fc-front" id="fcFront" onclick="flipCard()">
        <div class="fc-front-tag"><span class="tag ta">${c.cat}</span></div>
        <div class="fc-word">${c.word}</div>
        <div class="fc-hanja-mark">${c.mark}</div>
        <div class="fc-hint">탭하면 뜻이 공개됩니다</div>
      </div>
      <div class="fc-back" id="fcBack">
        <div class="fc-row"><div class="fc-row-num">① 읽기</div><div class="fc-reading">${c.reading}</div></div>
        <div class="fc-row"><div class="fc-row-num">② 뜻</div><div class="fc-meaning">${c.meaning}</div></div>
        <button class="fc-more-btn" id="fcMoreBtn" onclick="showMore()">더 알아보기 ▾</button>
        <div class="fc-more" id="fcMore">
          <div><div class="fc-row-num">③ 한자</div><div class="fc-hanja-list">${hanjaHtml}</div></div>
          <div><div class="fc-row-num">④ 직설</div><div class="fc-direct">${c.direct}</div></div>
          <div><div class="fc-row-num">⑤ 예문</div><div class="fc-example">${c.example}</div></div>
          <div><div class="fc-row-num">⑥ 연상법</div><div class="fc-mnemonic">${c.mnemonic}</div></div>
          <div class="fc-judge">
            <button class="fc-jbtn j-know" onclick="judgeCard('know')">알았다 ✓</button>
            <button class="fc-jbtn j-confused" onclick="judgeCard('confused')">헷갈린다 △</button>
            <button class="fc-jbtn j-unknown" onclick="judgeCard('unknown')">몰랐다 ✗</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

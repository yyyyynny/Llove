// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   플래시카드
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* 재구조화 이후 정리: FC_GOSAEONGEO·FC_HANJA(각 1건 정적 폴백)와 FC_고사성어_임시보기·
   FC_한자_임시보기(각 5건, sq2_출제풀에서 DB 상태와 무관하게 항상 병합되던 하드코딩 표본)는
   전부 data/고사성어속담.json·한자우리말.json으로 이전 완료(각 파일 82~86번째 항목).
   renderFlashcard()는 빈 배열을 안전하게 처리해야 한다(fetch 실패·초기 로드 지연 시 대비). */

/* sq2 4지선다·역방향 출제용 풀 — DB 풀(출제_분기 결과) 그대로 사용 */
function sq2_출제풀(category){
  const 실풀 = 출제_분기(category, []);
  return Array.isArray(실풀) ? 실풀 : [];
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
    renderFlashcard(풀);
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
    renderFlashcard(풀);
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
  if(!풀.length){ renderFlashcard(풀); return; }
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
  if(!data || !data.length){ showToastMsg('문제를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.'); return; }
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

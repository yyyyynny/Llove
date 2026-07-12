// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   아재개그
   v3.6: 초기 진입 시점부터 DAD_GAGS_BY_DIFFICULTY 사용으로 통일.
   아래 DAD_GAGS 상수는 호환용 잔존이며 실제 렌더에는 더 이상 사용되지 않음.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const DAD_GAGS=[
  {q:'세상에서 가장 빠른 닭은?', a:'치타', e:'치타는 동물 중 가장 빠른 육상동물(시속 약 110km). "치킨"의 "치"와 발음이 같아서 생긴 말장난이다.'}
];
let 현재아재문제 = null;   // 세션5: 직접입력 비교용 현재 문항
let 아재정답공개됨 = false; // 세션5: revealDad 중복 호출 → EXP 반복 획득 방지
/* 세션7 항목7: 아재개그 4지선다용 오답 표본 (임시 — data/아재개그.json이 채워지면
   실제 풀의 정답들로 대체하고 이 배열은 제거. 세션3 임시보기 패턴과 동일한 관리 방침) */
const 아재_오답표본 = ['치타','적운형 구름','데이비드 (또는 루시)','오리너구리','붕어빵','참을 인(忍)','옆집 백구','고구마 라떼'];
function renderDad(data){
  const body=document.getElementById('sq4Body');
  // 빌드1: 풀에서 랜덤 출제 + 「다음 문제」 실동작
  현재아재풀=data;
  const g=data[Math.floor(Math.random()*data.length)];
  현재아재문제 = g;
  아재정답공개됨 = false;
  현재문제_reasoning_note = g.reasoning_note || '';
  // 세션7 항목7: 「4지선다」 실구현 — 오답은 다른 개그 정답+임시 표본에서 구성
  if(학습설정.sq4_input === '4지선다'){
    const 정답텍스트 = g.a;
    const 오답들 = 아재_오답표본
      .filter(t => 직접입력_규격(t) !== 직접입력_규격(정답텍스트))
      .sort(()=>Math.random()-0.5).slice(0,3);
    const 보기들 = [...오답들.map(t=>({t, 정:false})), {t:정답텍스트, 정:true}].sort(()=>Math.random()-0.5);
    body.innerHTML=`
      <div class="dad-card">
        <div class="qcat" style="margin-bottom:8px"><span class="tag tp">아재개그</span></div>
        <div class="dad-q">${g.q}</div>
        <div class="aopts" style="margin-top:6px">${보기들.map((b,i)=>`<div class="aopt" data-정답="${b.정?1:0}" onclick="아재_선다선택(this,${b.정})"><div class="onum">${i+1}</div><div class="otxt">${b.t}</div></div>`).join('')}</div>
        <div class="dad-answer" id="dadAns">
          <div class="dad-a-text">${g.a}</div>
          <div class="dad-a-explain">${g.e}</div>
        </div>
      </div>
      <button class="btn-acc" style="width:100%" onclick="아재_다음문제()">다음 문제 →</button>
    `;
    return;
  }
  // 세션5 버그7: 입력 방식 「직접입력」 — 답을 타이핑한 뒤 정답 공개·비교
  if(학습설정.sq4_input === '직접입력'){
    body.innerHTML=`
      <div class="dad-card">
        <div class="qcat" style="margin-bottom:8px"><span class="tag tp">아재개그</span></div>
        <div class="dad-q">${g.q}</div>
        <div style="display:flex;gap:8px;margin:4px 0 10px">
          <input class="nm-inp" id="dadDirectInp" placeholder="정답을 맞혀보세요" style="flex:1;margin:0"
                 onkeydown="if(event.key==='Enter')아재_직접제출()">
          <button class="btn-acc" style="padding:11px 18px" id="dadDirectBtn" onclick="아재_직접제출()">제출</button>
        </div>
        <div class="dad-answer" id="dadAns">
          <div class="dad-a-text">${g.a}</div>
          <div class="dad-a-explain">${g.e}</div>
        </div>
      </div>
      <button class="btn-acc" style="width:100%" onclick="아재_다음문제()">다음 문제 →</button>
    `;
    return;
  }
  body.innerHTML=`
    <div class="dad-card">
      <div class="qcat" style="margin-bottom:8px"><span class="tag tp">아재개그</span></div>
      <div class="dad-q">${g.q}</div>
      <button class="dad-reveal-btn" id="dadBtn" onclick="revealDad()">정답 보기</button>
      <div class="dad-answer" id="dadAns">
        <div class="dad-a-text">${g.a}</div>
        <div class="dad-a-explain">${g.e}</div>
      </div>
    </div>
    <button class="btn-acc" style="width:100%" onclick="아재_다음문제()">다음 문제 →</button>
  `;
}
/* 아재개그 다음 문제 — 같은 난이도 풀에서 랜덤 재출제 */
function 아재_다음문제(){
  if(현재아재풀) renderDad(현재아재풀);
  setTimeout(initDad,30);
}
function initDad(){
  document.getElementById('dadAns')?.classList.remove('show');
  const btn=document.getElementById('dadBtn');
  if(btn) btn.style.display='block';
}
function revealDad(){
  // 세션5: 문제당 1회만 — 중복 호출 시 EXP 반복 획득 차단
  if(아재정답공개됨) return;
  아재정답공개됨 = true;
  document.getElementById('dadAns').classList.add('show');
  const btn=document.getElementById('dadBtn');
  if(btn) btn.style.display='none';
  // 빌드1: 실제 EXP 획득 + 마스터리(아재개그학습수) +1
  const 획득 = EXP획득(20, '아재개그');
  showExpFloat(document.querySelector('.dad-card'),'+'+획득);
  마스터리증가('아재개그학습수');
  마스터리증가('총누적어휘수');
}
/* 세션7 항목7: 아재개그 4지선다 선택 — 정답/오답 표시 후 해설 공개(EXP는 revealDad 1회 잠금 공유) */
function 아재_선다선택(el, 정답){
  if(el.parentElement.querySelector('.correct,.wrong')) return;
  el.classList.add(정답 ? 'correct' : 'wrong');
  if(!정답) el.parentElement.querySelectorAll('.aopt').forEach(o=>{ if(o.dataset.정답==='1') o.classList.add('correct'); });
  el.parentElement.querySelectorAll('.aopt').forEach(o=>o.classList.add('disabled'));
  showToastMsg(정답 ? '🎉 정답!' : '😄 아쉽! 해설을 확인하세요');
  revealDad();
}
/* 세션5 버그7: 아재개그 직접입력 제출 — 느슨 비교 후 정답 공개(EXP는 revealDad 1회 잠금 공유) */
function 아재_직접제출(){
  const inp=document.getElementById('dadDirectInp');
  if(!inp || inp.dataset.제출완료) return;
  const 입력=(inp.value||'').trim();
  if(!입력){ showToastMsg('답을 입력해 주세요'); return; }
  inp.dataset.제출완료='1'; inp.disabled=true;
  const btn=document.getElementById('dadDirectBtn'); if(btn) btn.disabled=true;
  활성입력_blur();
  // 세션7 항목6: 허용 정답 배열 지원 — 데이터에 허용:[...]이 있으면 그 목록으로 판정
  const 후보 = (현재아재문제 && Array.isArray(현재아재문제.허용) && 현재아재문제.허용.length)
    ? 현재아재문제.허용 : [현재아재문제?.a];
  const 맞음 = 직접입력_규격(입력)!=='' && 후보.some(ans => 직접입력_규격(입력) === 직접입력_규격(ans));
  showToastMsg(맞음 ? '🎉 정답! 센스가 대단합니다' : '😄 아쉽! 정답을 확인하세요');
  revealDad();
}

// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   아재개그
   v3.6: 초기 진입 시점부터 DAD_GAGS_BY_DIFFICULTY 사용으로 통일.
   재구조화 이후 정리: 미사용 잔재였던 DAD_GAGS 상수(치타 1건, DAD_GAGS_BY_DIFFICULTY의
   '아↗그거!'와 완전 중복)를 삭제. 데이터 손실 없음 — js/복습.js에 이미 존재.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let 현재아재문제 = null;   // 세션5: 직접입력 비교용 현재 문항
let 아재정답공개됨 = false; // 세션5: revealDad 중복 호출 → EXP 반복 획득 방지
/* 재구조화 이후 발견한 불일치 수정: data/아재개그.json(DB문제['아재개그'])이 로드돼도
   기존엔 여기 없는 DAD_GAGS_BY_DIFFICULTY(js/복습.js)만 렌더에 쓰여 실제 앱에 반영되지 않았다.
   난이도별 큐레이션 문항은 유지하고, JSON 항목을 항목별 난이도 필드(기본값 '아↗그거!')로
   갈라 합친다. */
function 아재풀_구성(난이도){
  const 기본풀 = DAD_GAGS_BY_DIFFICULTY[난이도] || DAD_GAGS_BY_DIFFICULTY['아↗그거!'];
  const DB풀 = (DB문제['아재개그'] || []).filter(g => (g.난이도 || '아↗그거!') === 난이도);
  return DB풀.length ? [...기본풀, ...DB풀] : 기본풀;
}
// UP¡¿ 난이도는 말장난 파악이 더 까다로워 기본(20)의 1.5배(30) 지급
const 아재_보상 = () => (학습설정.sq4 === 'UP¡¿') ? 30 : 20;
function renderDad(data){
  학습진행_다음('sq4');
  배지_방식표시('sq4Mode', 학습설정.sq4_input);
  document.getElementById('sq4Exp').textContent = '+' + 아재_보상();
  const body=document.getElementById('sq4Body');
  // 빌드1: 풀에서 랜덤 출제 + 「다음 문제」 실동작
  현재아재풀=data;
  const g=출제_뽑기(data);
  현재아재문제 = g;
  아재정답공개됨 = false;
  현재문제_reasoning_note = g.reasoning_note || '';
  // 세션7 항목7: 「4지선다」 — 오답은 같은 풀의 다른 문항 정답 3개(허용 정답과 겹치는 것 제외).
  // 다른 정답이 하나도 없으면(데이터 미로드) 아래 플래시카드로 낸다
  const 정답들 = [g.a, ...(g.허용 || [])].map(직접입력_규격);
  const 오답들 = 학습설정.sq4_input === '4지선다'
    ? 셔플([...new Set(data.map(x=>x.a))].filter(t => !정답들.includes(직접입력_규격(t)))).slice(0,3) : [];
  if(오답들.length){
    const 보기들 = 셔플([...오답들.map(t=>({t, 정:false})), {t:g.a, 정:true}]);
    body.innerHTML=`
      <div class="dad-card">
        <div class="qcat" style="margin-bottom:8px"><span class="tag tp">아재개그</span></div>
        <div class="dad-q">${g.q}</div>
        ${선다_HTML(보기들, '아재_선다선택')}
        <div class="dad-answer" id="dadAns">
          <div class="dad-a-text">${g.a}</div>
          <div class="dad-a-explain">${g.e}</div>
        </div>
      </div>
      <button class="btn-acc q-next" style="width:100%" onclick="아재_다음문제()"><span class="q-skip">건너뛰기</span><span class="q-go">다음 문제 →</span></button>
    `;
    return;
  }
  // 세션5 버그7: 입력 방식 「직접입력」 — 답을 타이핑한 뒤 정답 공개·비교
  if(학습설정.sq4_input === '직접입력'){
    body.innerHTML=`
      <div class="dad-card">
        <div class="qcat" style="margin-bottom:8px"><span class="tag tp">아재개그</span></div>
        <div class="dad-q">${g.q}</div>
        ${직접입력_HTML('dad', '아재_직접제출()')}
        <div class="dad-answer" id="dadAns">
          <div class="dad-a-text">${g.a}</div>
          <div class="dad-a-explain">${g.e}</div>
        </div>
      </div>
      <button class="btn-acc q-next" style="width:100%" onclick="아재_다음문제()"><span class="q-skip">건너뛰기</span><span class="q-go">다음 문제 →</span></button>
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
    <button class="btn-acc q-next" style="width:100%" onclick="아재_다음문제()"><span class="q-skip">건너뛰기</span><span class="q-go">다음 문제 →</span></button>
  `;
}
/* 아재개그 다음 문제 — 같은 난이도 풀에서 랜덤 재출제 */
function 아재_다음문제(){
  if(현재아재풀) renderDad(현재아재풀);
}
/* 정답 공개 — 문제당 1회. 플래시카드(정답여부 없음)는 공개만으로 보상,
   4지선다·직접입력은 맞혔을 때만 EXP를 주고 채점_기록(복습 대기열·연속 정답·세션·마스터리)에 남긴다
   (종전엔 틀려도 EXP를 주고 채점 기록이 없었다) */
function revealDad(정답여부){
  // 세션5: 문제당 1회만 — 중복 호출 시 EXP 반복 획득 차단
  if(아재정답공개됨) return;
  아재정답공개됨 = true;
  document.getElementById('dadAns').classList.add('show');
  const btn=document.getElementById('dadBtn');
  if(btn) btn.style.display='none';
  const 채점 = typeof 정답여부 === 'boolean';
  if(!채점 || 정답여부){
    const 획득 = EXP획득(아재_보상(), '아재개그');
    showExpFloat(document.querySelector('.dad-card'),'+'+획득);
  }
  if(채점) 채점_기록(정답여부, 현재아재문제.a, 현재아재문제.q, '아재개그');
  else { 마스터리증가('아재개그학습수'); 마스터리증가('총누적어휘수'); }
}
/* 세션7 항목7: 아재개그 4지선다 선택 — 정답/오답 표시 후 해설 공개 */
function 아재_선다선택(el, 정답){
  if(선다_표시(el, 정답)) revealDad(정답);   // 맞고 틀림은 보기 색으로, 해설은 아래 정답 공개로 화면 안에 보인다
}
/* 세션5 버그7: 아재개그 직접입력 제출 — 느슨 비교 후 정답 공개(EXP는 revealDad 1회 잠금 공유) */
function 아재_직접제출(){
  const 입력 = 직접입력_꺼내기('dadDirectInp', 'dadDirectBtn');
  if(입력 === null) return;
  // 세션7 항목6: 허용 정답 배열 지원 — 데이터에 허용:[...]이 있으면 그 목록으로 판정
  const 후보 = (현재아재문제 && Array.isArray(현재아재문제.허용) && 현재아재문제.허용.length)
    ? 현재아재문제.허용 : [현재아재문제?.a];
  const 맞음 = 직접입력_규격(입력)!=='' && 후보.some(ans => 직접입력_규격(입력) === 직접입력_규격(ans));
  showToastMsg(맞음 ? '🎉 정답! 센스가 대단합니다' : '😄 아쉽! 정답을 확인하세요');
  revealDad(맞음);
}

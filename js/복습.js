// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   복습
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   학습 화면 상단 설정 패널 (v3.5 신규)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// 모드별 현재 선택값 저장 (Firebase 연동 시 설정 데이터로 이전)
// v3.7 항목3,13: sq2 4방식 확장 + sq4 입력 방식 추가
// 세션7 항목7: '선택지' 명칭을 '4지선다'로 통일 + 플래시카드·역방향 전 모드 확장
// 세션7 항목5: 복습(srp) 방식·순서 키 추가
let 학습설정 = {
  sq1: '4지선다',        // 4지선다 / 직접입력 / 플래시카드 / 역방향
  // 세션9: 기본값을 단어-뜻 암기(4지선다)에서 예문 맥락 판단(유의어 변별)으로 전환 —
  // 앱 취지("표현력 향상")에 맞게 문맥 기반 학습을 기본으로 삼는다.
  // 세션10: 옵션명 "유의어 변별"→"예문형"으로 통일(로직·데이터 변경 없음, 명칭만 정리)
  sq2: '예문형',     // 예문형(기본) / 4지선다 / 뜻 직접 서술 / 역방향 / 플래시카드 (v3.7 항목3)
  sq3: '4지선다',        // 4지선다 / 직접입력 / 플래시카드 / 역방향
  sq4: '아↗그거!',        // 아↗그거! / UP¡¿
  sq4_input: '플래시카드', // 4지선다 / 직접입력 / 플래시카드 (구 '선택지'=탭→공개의 실체가 플래시카드)
  srp: '카드 보기',       // 카드 보기 / 4지선다 / 직접입력 (복습)
  srp_순서: '등록순'      // 등록순 / 섞기 (복습)
};
// 세션7: 구버전 저장값('선택지') 마이그레이션 — 복원 직후 호출
function 학습설정_마이그레이션(){
  if(학습설정.sq1 === '선택지') 학습설정.sq1 = '4지선다';
  if(학습설정.sq3 === '선택지') 학습설정.sq3 = '4지선다';
  if(학습설정.sq4_input === '선택지') 학습설정.sq4_input = '플래시카드';
  // 세션10: 구버전 저장값('유의어 변별') 마이그레이션 — 옵션명 통일
  if(학습설정.sq2 === '유의어 변별') 학습설정.sq2 = '예문형';
}

/* 패널 펼치기/접기 토글 — 세션5 버그8: 회전 대신 ▼/▲ 글자 교체(회전 금지 규칙) */
function toggleLset(id){
  const panel = document.getElementById(id);
  if(!panel) return;
  panel.classList.toggle('open');
  const t = panel.querySelector('.lset-toggle');
  if(t) t.textContent = panel.classList.contains('open') ? '▲' : '▼';
}

/* 세션5 버그7: 저장된 학습설정을 패널 버튼 활성 상태(.on)에 반영 (새로고침 복원 시) */
function 학습설정_UI동기화(){
  document.querySelectorAll('.lset-opt').forEach(b=>{
    const m = (b.getAttribute('onclick')||'').match(/setLsetMode\('([^']+)','([^']+)'/);
    if(m) b.classList.toggle('on', 학습설정[m[1]] === m[2]);
  });
}

/* 모드 선택 */
// v3.7 항목9: sq1·sq2·sq3 동작 미연동 해소 — 각 모드별 분기 처리
// 세션5 버그7: ①plx_학습설정 저장(새로고침 유지) ②sq1·sq3·sq4_input도 즉시 재출제로 실반영
function setLsetMode(screenId, mode, btn){
  학습설정[screenId] = mode;
  try{ localStorage.setItem('plx_학습설정', JSON.stringify(학습설정)); }catch(e){ /* localStorage 차단 환경 무시 */ }

  // 같은 행 내 다른 버튼 활성화 해제 (행 단위 토글: sq4의 「난이도」·「입력 방식」 독립 토글)
  const row = btn.closest('.lset-row');
  if(row) row.querySelectorAll('.lset-opt').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');

  // 분기 처리 — 설정 변경 즉시 현재 문제를 새 방식으로 다시 출제
  if(screenId==='sq1'){
    // 상식·어원, 세계사·신화 — 선택지/직접입력 즉시 반영
    if(현재퀴즈풀 && 현재퀴즈화면==='sq1') renderQuiz4(현재퀴즈풀);
    showToastMsg(`상식·세계사 출제 방식: ${mode}`);
  } else if(screenId==='sq2'){
    // 고사성어·속담 / 한자·우리말 (5방식: 4지선다 기본값)
    // 버그2 수정: 학습설정.sq2는 위에서 이미 mode로 저장됨 → 공통 렌더 함수로 즉시 반영
    sq2_출제_렌더(document.getElementById('sq2Title').textContent);
    showToastMsg(`출제 방식: ${mode}`);
  } else if(screenId==='sq3'){
    // 맞춤법 — 선택지/직접입력 즉시 반영
    if(현재퀴즈풀 && 현재퀴즈화면==='sq3') renderQuiz3(현재퀴즈풀);
    showToastMsg(`맞춤법 출제 방식: ${mode}`);
  } else if(screenId==='sq4'){
    // 아재개그 난이도 즉시 갱신
    renderDad(DAD_GAGS_BY_DIFFICULTY[mode] || DAD_GAGS_BY_DIFFICULTY['아↗그거!']);
    setTimeout(initDad,30);
    showToastMsg(`난이도: ${mode}`);
  } else if(screenId==='sq4_input'){
    // 아재개그 입력 방식 (4지선다 / 직접입력 / 플래시카드) — 즉시 반영
    if(현재아재풀){ renderDad(현재아재풀); setTimeout(initDad,30); }
    showToastMsg(`입력 방식: ${mode}`);
  } else if(screenId==='srp' || screenId==='srp_순서'){
    // 세션7 항목5: 복습 방식·순서 — 진행 중이면 현재 카드부터 즉시 반영
    if(screenId==='srp_순서' && mode==='섞기' && 복습진행){
      const 남은 = 복습진행.목록.slice(복습진행.idx).sort(()=>Math.random()-0.5);
      복습진행.목록 = [...복습진행.목록.slice(0, 복습진행.idx), ...남은];
    }
    if(복습진행) 복습_카드렌더();
    showToastMsg(`복습 ${screenId==='srp'?'방식':'순서'}: ${mode}`);
  } else {
    showToastMsg(`설정 변경: ${mode}`);
  }
}

/* 아재개그 난이도별 데이터 */
const DAD_GAGS_BY_DIFFICULTY = {
  '아↗그거!': [
    {q:'세상에서 가장 빠른 닭은?', a:'치타', e:'치타는 동물 중 가장 빠른 육상동물(시속 약 110km). "치킨"의 "치"와 발음이 같아서 생긴 말장난이다.'}
  ],
  'UP¡¿': [
    {q:'뚱뚱한 구름은?', a:'적운형 구름', e:'적운(積雲)은 위로 솟아 오른 모양의 구름. "쌓인 = 뚱뚱"의 언어유희.'},
    // 세션7 항목6: 정답·해설 교체 — 《사이버펑크: 엣지러너》 오마주 (허용 배열은 내부 판정용, 화면 비노출)
    // 이름만·성+이름 정답 / 성만(마르티네즈·쿠시나다 등)은 목록에 없어 자동 오답
    {q:'함께 달에 가지 못해서 미안해.', a:'데이비드 (또는 루시)',
     허용:['데이비드','루시','David','Lucy','데이비드 마르티네즈','David Martinez','デイビッド・マルティネス','루시나 루시 쿠시나다','루시나 쿠시나다','Lucyna Lucy Kushinada','Lucyna Kushinada'],
     e:'애니메이션 《사이버펑크: 엣지러너》 — 데이비드와 루시의 「달」 약속에서 온 대사. 루시의 꿈은 달에 가는 것이었고, 데이비드는 그 약속을 끝내 함께 지키지 못했다.'}
  ]
};

/* 복습 화면 렌더링 — 모든 탭(대기열/즐겨찾기/휴지통) 한꺼번에 그림 */
function renderReview(){
  // 카운트 갱신
  document.getElementById('rvQCnt').textContent = 복습데이터.대기열.length;
  document.getElementById('rvFCnt').textContent = 복습데이터.즐겨찾기.length;
  document.getElementById('rvBCnt').textContent = 복습데이터.휴지통.length;

  // 사용자 객체와 카운트 동기화
  사용자.복습대기열수 = 복습데이터.대기열.length;
  사용자.즐겨찾기수 = 복습데이터.즐겨찾기.length;
  사용자.휴지통수 = 복습데이터.휴지통.length;

  // 대기열 렌더
  renderQueueTab();
  renderFavTab();
  renderBinTab();
}

/* 대기열 탭 렌더 */
function renderQueueTab(){
  const wrap = document.getElementById('rvQueue');
  const 대기열 = 복습데이터.대기열;
  const 상한 = 사용자.복습대기열상한;

  // 용량 표시 줄
  let html = `
    <div class="rv-cap">
      <span class="rv-cap-lbl">용량</span>
      <div class="cap-bar"><div class="cap-fill" style="width:${Math.min(100,(대기열.length/상한)*100)}%"></div></div>
      <span class="rv-cap-val" onclick="openCapacity()">${대기열.length} / ${상한} ⚙</span>
    </div>
  `;

  // 비어있을 때
  if(대기열.length===0){
    html += `<div style="text-align:center;padding:48px 20px;color:var(--txtm);font-size:13px">📥 대기열이 비어있습니다</div>`;
    wrap.innerHTML = html;
    return;
  }

  // 항목들
  대기열.forEach((item,idx)=>{
    // 세션7 항목5: 졸업 기준 1회 — 점 1개로 축소
    const dots = [0].map(i=>`<div class="rv-dot${i<item.연속정답수?' f':''}"></div>`).join('');
    html += `
      <div class="rv-item fu" style="animation-delay:${idx*0.04}s">
        <div class="rv-idx">${idx}</div>
        <div style="flex:1">
          <div class="rv-word">${item.단어}</div>
          <div class="rv-desc">${item.뜻}</div>
          <div class="rv-meta">
            <span class="tag ${item.모드클래스}" style="font-size:9px">${item.모드}</span>
            <div class="rv-dots">${dots}</div>
            <span style="font-size:10px;color:var(--txtm)">${item.연속정답수}/1</span>
          </div>
        </div>
        <div class="rv-acts">
          <div class="act-btn fav${item.즐겨찾기?' on':''}" onclick="대기열_즐겨찾기토글('${item.id}')" title="즐겨찾기">${item.즐겨찾기?'★':'☆'}</div>
          <div class="act-btn d" onclick="대기열_휴지통이동('${item.id}')" title="삭제">🗑</div>
        </div>
      </div>
    `;
  });

  // 복습 시작 — 대기열 순차 복습 플레이 (완료 시 토큰 +30, 일 3회 — KNOWLEDGE 32)
  html += `<button class="btn-acc" style="width:100%;margin-top:4px" onclick="복습시작()">🔁 복습 시작</button>`;

  wrap.innerHTML = html;
}

/* 즐겨찾기 탭 렌더 */
function renderFavTab(){
  const wrap = document.getElementById('rvFav');
  const 즐겨찾기 = 복습데이터.즐겨찾기;

  let html = `<div class="bin-info">⭐ 즐겨찾기는 무한 보관 가능하며 다른 시스템(대기열·휴지통)의 영향을 받지 않습니다.</div>`;

  if(즐겨찾기.length===0){
    html += `<div style="text-align:center;padding:48px 20px;color:var(--txtm);font-size:13px">⭐ 즐겨찾기가 비어있습니다</div>`;
    wrap.innerHTML = html;
    return;
  }

  즐겨찾기.forEach((item,idx)=>{
    html += `
      <div class="rv-item fu" style="animation-delay:${idx*0.04}s">
        <div class="rv-idx">${idx}</div>
        <div style="flex:1">
          <div class="rv-word">${item.단어}</div>
          <div class="rv-desc">${item.뜻}</div>
          <div class="rv-meta"><span class="tag ${item.모드클래스}" style="font-size:9px">${item.모드}</span></div>
        </div>
        <div class="rv-acts">
          <div class="act-btn" onclick="즐겨찾기_다시풀기('${item.id}')" title="다시 풀기">↻</div>
          <div class="act-btn" onclick="즐겨찾기_유사문제('${item.id}')" title="유사 문제">✨</div>
          <div class="act-btn d" onclick="즐겨찾기_해제('${item.id}')" title="해제">★</div>
        </div>
      </div>
    `;
  });

  wrap.innerHTML = html;
}

/* 휴지통 탭 렌더 */
function renderBinTab(){
  const wrap = document.getElementById('rvBin');
  const 휴지통 = 복습데이터.휴지통;

  let html = `<div class="bin-info">🕒 휴지통의 항목은 <b>20일 후 자동 삭제</b>됩니다. 그 전에 복구하거나 영구삭제할 수 있습니다.</div>`;

  if(휴지통.length===0){
    html += `<div style="text-align:center;padding:48px 20px;color:var(--txtm);font-size:13px">🗑️ 휴지통이 비어있습니다</div>`;
    wrap.innerHTML = html;
    return;
  }

  휴지통.forEach((item,idx)=>{
    html += `
      <div class="rv-item fu" style="animation-delay:${idx*0.04}s">
        <div class="rv-idx">${idx}</div>
        <div style="flex:1">
          <div class="rv-word">${item.단어}</div>
          <div class="rv-desc">${item.뜻}</div>
          <div class="rv-meta">
            <span class="tag ${item.모드클래스}" style="font-size:9px">${item.모드}</span>
            <span style="font-size:10px;color:var(--txtm)">${item.잔여일}일 후 삭제</span>
          </div>
        </div>
        <div class="rv-acts">
          <div class="act-btn" onclick="휴지통_복구('${item.id}')" title="복구">↩</div>
          <div class="act-btn d" onclick="휴지통_영구삭제('${item.id}')" title="영구삭제">✕</div>
        </div>
      </div>
    `;
  });

  // 휴지통 비우기 버튼
  html += `<button class="btn-acc" style="width:100%;margin-top:4px" onclick="휴지통_전체비우기()">🗑️ 휴지통 비우기</button>`;

  wrap.innerHTML = html;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   복습 플레이 — 대기열 항목을 순차적으로 복습 (KNOWLEDGE 7)
   - 기억남 → 연속정답수 +1 (3회 시 졸업) / 까먹음 → 0으로 초기화
   - 1회 완주 시 토큰 +30 충전, 일 3회 한도 (KNOWLEDGE 32 복구 시스템)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let 복습진행 = null;  // {목록, idx} — null이면 비진행

function 복습시작(){
  if(복습데이터.대기열.length === 0){
    showToastMsg('📥 복습할 항목이 없습니다');
    return;
  }
  복습진행 = { 목록: [...복습데이터.대기열], idx: 0 };
  // 세션7 항목5: 순서 「섞기」 설정 시 셔플
  if(학습설정.srp_순서 === '섞기') 복습진행.목록.sort(()=>Math.random()-0.5);
  // 항목10: 좁은 복습칸 인라인이 아니라 전용 화면(srp)으로 이동해 카드에 집중
  goNav('srp', null);
  복습_카드렌더();
}

function 복습_카드렌더(){
  // 항목10: 전용 복습 화면(srpBody)에 렌더 (기존 rvQueue 인라인 → 분리)
  // 세션7 항목5: 복습 방식(카드 보기/4지선다/직접입력) 분기 — 학습설정.srp
  const wrap = document.getElementById('srpBody');
  if(!wrap || !복습진행) return;
  const 항목 = 복습진행.목록[복습진행.idx];
  if(!항목){ 복습_완료(); return; }
  const 진행률 = Math.round((복습진행.idx / 복습진행.목록.length) * 100);
  const 머리 = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:2px 2px 8px">
      <span style="font-size:13px;color:var(--txt2);font-weight:600">🔁 복습 ${복습진행.idx+1} / ${복습진행.목록.length}</span>
    </div>
    <div class="exp-track" style="margin-bottom:14px"><div class="exp-fill instant" style="width:${진행률}%"></div></div>`;

  // ── 4지선다: 단어 제시 → 뜻 4개(대기열의 다른 뜻으로 오답 구성, 후보 부족 시 카드 폴백)
  if(학습설정.srp === '4지선다'){
    const 후보 = 복습데이터.대기열.filter(x=>x.단어!==항목.단어 && x.뜻).map(x=>x.뜻);
    if(후보.length >= 1){
      const 오답 = 후보.sort(()=>Math.random()-0.5).slice(0,3);
      const 보기들 = [...오답.map(t=>({t, 정:false})), {t:항목.뜻, 정:true}].sort(()=>Math.random()-0.5);
      wrap.innerHTML = 머리 + `
        <div class="qcard" style="margin-top:4px">
          <div class="qcat"><span class="tag ${항목.모드클래스}">${항목.모드}</span></div>
          <div class="q-question" style="font-size:calc(20px*var(--글자배율));margin-top:6px">${항목.단어}</div>
          <div class="q-hint">알맞은 뜻을 고르세요</div>
        </div>
        <div class="aopts">${보기들.map((b,i)=>`<div class="aopt" data-정답="${b.정?1:0}" onclick="복습_선다선택(this,${b.정})"><div class="onum">${i+1}</div><div class="otxt">${b.t}</div></div>`).join('')}</div>`;
      return;
    }
    showToastMsg('보기 후보가 부족해 카드 보기로 진행합니다');
  }

  // ── 직접입력: 뜻 제시 → 단어 타이핑
  if(학습설정.srp === '직접입력'){
    wrap.innerHTML = 머리 + `
      <div class="qcard" style="margin-top:4px">
        <div class="qcat"><span class="tag ${항목.모드클래스}">${항목.모드}</span></div>
        <div class="q-question" style="margin-top:6px">${항목.뜻}</div>
        <div class="q-hint">이 뜻에 해당하는 단어를 입력하세요</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <input class="nm-inp" id="rvDirectInp" placeholder="단어 입력" style="flex:1;margin:0" onkeydown="if(event.key==='Enter')복습_직접제출()">
        <button class="btn-acc" style="padding:11px 18px" id="rvDirectBtn" onclick="복습_직접제출()">제출</button>
      </div>`;
    return;
  }

  // ── 기본: 카드 보기 (기존 방식)
  wrap.innerHTML = 머리 + `
    <div class="qcard" style="margin-top:4px;padding:26px 20px">
      <div class="qcat"><span class="tag ${항목.모드클래스}">${항목.모드}</span></div>
      <div class="q-question" style="font-size:calc(20px*var(--글자배율));margin-top:6px">${항목.단어}</div>
      <div id="rvAnswer" style="display:none;margin-top:14px;padding-top:14px;border-top:1px dashed var(--bdr);font-size:14px;color:var(--txt2);line-height:1.8">${항목.뜻}</div>
    </div>
    <button class="btn-acc" id="rvRevealBtn" style="width:100%;margin-top:14px" onclick="복습_뜻공개()">뜻 보기</button>
    <div id="rvJudge" style="display:none;gap:8px;margin-top:12px">
      <button class="btn-acc" style="flex:1" onclick="복습_판정(true)">기억남 ✓</button>
      <button class="btn-g" style="flex:1" onclick="복습_판정(false)">까먹음 ✗</button>
    </div>
  `;
}

/* 세션7 항목5: 복습 4지선다 선택 처리 — 정답/오답 표시 후 기존 판정 흐름으로 위임 */
function 복습_선다선택(el, 정답){
  if(el.parentElement.querySelector('.correct,.wrong')) return;
  el.classList.add(정답 ? 'correct' : 'wrong');
  if(!정답) el.parentElement.querySelectorAll('.aopt').forEach(o=>{ if(o.dataset.정답==='1') o.classList.add('correct'); });
  el.parentElement.querySelectorAll('.aopt').forEach(o=>o.classList.add('disabled'));
  setTimeout(()=>복습_판정(정답), 700);
}
/* 세션7 항목5: 복습 직접입력 제출 — 단어 느슨 비교 후 판정 위임 */
function 복습_직접제출(){
  const inp = document.getElementById('rvDirectInp');
  if(!inp || inp.dataset.제출완료 || !복습진행) return;
  const 입력 = (inp.value||'').trim();
  if(!입력){ showToastMsg('답을 입력해 주세요'); return; }
  inp.dataset.제출완료='1'; inp.disabled = true;
  const btn=document.getElementById('rvDirectBtn'); if(btn) btn.disabled = true;
  활성입력_blur();
  const 항목 = 복습진행.목록[복습진행.idx];
  const 맞음 = 직접입력_규격(입력) !== '' && 직접입력_규격(입력) === 직접입력_규격(항목.단어);
  showToastMsg(맞음 ? '✓ 정답!' : `✗ 정답: ${항목.단어}`);
  setTimeout(()=>복습_판정(맞음), 900);
}

function 복습_뜻공개(){
  const a=document.getElementById('rvAnswer'); if(a) a.style.display='block';
  const b=document.getElementById('rvRevealBtn'); if(b) b.style.display='none';
  const j=document.getElementById('rvJudge'); if(j) j.style.display='flex';
}

function 복습_판정(기억남){
  if(!복습진행) return;
  const 항목 = 복습진행.목록[복습진행.idx];
  if(기억남){
    복습대기열_정답처리(항목.단어);  // 세션7: 정답 1회 즉시 졸업
  } else {
    // 까먹음 → 연속정답수 0으로 초기화
    const 실항목 = 복습데이터.대기열.find(x=>x.단어===항목.단어);
    if(실항목 && 실항목.연속정답수 !== 0){
      실항목.연속정답수 = 0;
      보관함_문서수정('복습대기열', 실항목.id, {연속정답수:0});
    }
  }
  복습진행.idx++;
  if(복습진행.idx >= 복습진행.목록.length) 복습_완료();
  else 복습_카드렌더();
}

function 복습_중단(){
  복습진행 = null;
  goNav('sr', null);   // 항목10: 전용 화면 → 복습 관리 화면으로 복귀
  renderReview();
  showToastMsg('복습을 중단했습니다 (보상 없음)');
}

function 복습_완료(){
  복습진행 = null;
  학습일갱신();
  // 토큰 +30 충전 — 일 3회 한도 (KNOWLEDGE 32). 한도 추적 필드는 한글 신규: 복습복구횟수·복습복구날짜
  const 오늘 = 오늘날짜_로컬(0);
  if(사용자.복습복구날짜 !== 오늘){ 사용자.복습복구날짜 = 오늘; 사용자.복습복구횟수 = 0; }
  if((사용자.복습복구횟수||0) < 3){
    사용자.복습복구횟수 = (사용자.복습복구횟수||0) + 1;
    사용자데이터_저장({복습복구횟수:사용자.복습복구횟수, 복습복구날짜:사용자.복습복구날짜});
    토큰복구(30, `복습 완료 ${사용자.복습복구횟수}/3`);
  } else {
    showToastMsg('🔁 복습 완료! (오늘 토큰 충전 한도 3회 소진)');
  }
  goNav('sr', null);   // 항목10: 전용 화면 → 복습 관리 화면으로 복귀
  renderReview();
}

/* 탭 전환 */
function switchRvTab(idx){
  ['rvT0','rvT1','rvT2'].forEach((id,i)=>{
    document.getElementById(id).classList.toggle('on',i===idx);
  });
  document.getElementById('rvQueue').style.display=idx===0?'flex':'none';
  document.getElementById('rvFav').style.display=idx===1?'flex':'none';
  document.getElementById('rvBin').style.display=idx===2?'flex':'none';
}

/* ━━━ 대기열 액션 ━━━ */

/* 대기열 항목 즐겨찾기 토글 — Firestore 즐겨찾기 서브컬렉션 동기 기록 */
function 대기열_즐겨찾기토글(id){
  const item = 복습데이터.대기열.find(x=>x.id===id);
  if(!item) return;
  item.즐겨찾기 = !item.즐겨찾기;

  if(item.즐겨찾기){
    // 즐겨찾기 목록에 동일 단어가 없으면 추가
    const 중복 = 복습데이터.즐겨찾기.find(x=>x.단어===item.단어);
    if(!중복){
      const 신규 = {
        id: 보관함_임시ID(),
        단어: item.단어,
        뜻: item.뜻,
        모드: item.모드,
        모드클래스: item.모드클래스
      };
      복습데이터.즐겨찾기.push(신규);
      보관함_문서추가('즐겨찾기', 신규, {단어:item.단어, 뜻:item.뜻, 모드:item.모드});
    }
    showToastMsg('⭐ 즐겨찾기에 추가됨');
  } else {
    // 즐겨찾기 목록에서 동일 단어 제거 (Firestore 문서 포함)
    복습데이터.즐겨찾기.filter(x=>x.단어===item.단어).forEach(x=> 보관함_문서삭제('즐겨찾기', x.id));
    복습데이터.즐겨찾기 = 복습데이터.즐겨찾기.filter(x=>x.단어!==item.단어);
    showToastMsg('즐겨찾기에서 제거됨');
  }

  renderReview();
}

/* 대기열 항목 휴지통 이동 — Firestore 양쪽 컬렉션 동기 기록 */
function 대기열_휴지통이동(id){
  const idx = 복습데이터.대기열.findIndex(x=>x.id===id);
  if(idx<0) return;
  const item = 복습데이터.대기열[idx];

  // 휴지통으로 이동 (잔여일 20일로 시작)
  const 휴항목 = {
    id: 보관함_임시ID(),
    단어: item.단어,
    뜻: item.뜻,
    모드: item.모드,
    모드클래스: item.모드클래스,
    잔여일: 20
  };
  복습데이터.휴지통.push(휴항목);
  보관함_문서추가('휴지통', 휴항목, {단어:item.단어, 뜻:item.뜻, 모드:item.모드,
    이동일시: (fbDb ? firebase.firestore.FieldValue.serverTimestamp() : null)});

  // 대기열에서 제거 (Firestore 문서 포함)
  복습데이터.대기열.splice(idx,1);
  보관함_문서삭제('복습대기열', item.id);

  showToastMsg('🗑️ 휴지통으로 이동');
  renderReview();
}

/* ━━━ 즐겨찾기 액션 ━━━ */

function 즐겨찾기_다시풀기(id){
  // 서브컬렉션 연동(즐겨찾기 항목 ↔ 문제 풀 매핑) 후 실제 재출제 연결 예정
  showInfoModal('🔁','다시 풀기','이 문제를 다시 출제합니다.<br><br>🔧 문제 풀 매핑 구축 후 제공됩니다 (다음 빌드).');
}

function 즐겨찾기_유사문제(id){
  if(!GROK_활성화){
    showInfoModal('✨','유사 문제','Grok이 비슷한 유형의 문제를 새로 생성합니다 (토큰 20 차감).<br><br>🔌 Grok 연동(크레딧 구매) 후 활성화됩니다.');
    return;
  }
  // ── Grok 활성화 후 실행 경로 ──
  if(!토큰차감('유사문제', 20)) return;
  // grok호출('문제생성', {유사기준: 항목}) → 새 문제 렌더 (β1 연결 지점)
  showToastMsg('✨ 유사 문제 생성 중...');
}

function 즐겨찾기_해제(id){
  const idx = 복습데이터.즐겨찾기.findIndex(x=>x.id===id);
  if(idx<0) return;
  const 단어 = 복습데이터.즐겨찾기[idx].단어;

  // 즐겨찾기 목록에서 제거 (Firestore 문서 포함)
  보관함_문서삭제('즐겨찾기', id);
  복습데이터.즐겨찾기.splice(idx,1);

  // 대기열에 동일 단어가 있으면 즐겨찾기 플래그 해제
  const 대기열항목 = 복습데이터.대기열.find(x=>x.단어===단어);
  if(대기열항목) 대기열항목.즐겨찾기 = false;

  showToastMsg('즐겨찾기 해제됨');
  renderReview();
}

/* ━━━ 휴지통 액션 ━━━ */

function 휴지통_복구(id){
  const idx = 복습데이터.휴지통.findIndex(x=>x.id===id);
  if(idx<0) return;
  const item = 복습데이터.휴지통[idx];

  // 대기열 상한 체크 (개발자 모드 상한 해제 시 통과 — KNOWLEDGE 14)
  const 상한 = 개발자오버레이?.상한해제 ? Infinity : 사용자.복습대기열상한;
  if(복습데이터.대기열.length >= 상한){
    showInfoModal('🚫','복구 불가',`대기열이 가득 찼습니다 (${사용자.복습대기열상한}개).<br><br>먼저 대기열 항목을 줄여주세요.`);
    return;
  }

  // 대기열로 복구 (연속정답수 0으로 초기화 — KNOWLEDGE 8)
  const 신규 = {
    id: 보관함_임시ID(),
    단어: item.단어,
    뜻: item.뜻,
    모드: item.모드,
    모드클래스: item.모드클래스,
    연속정답수: 0,
    즐겨찾기: false,
    추가시각: Date.now()
  };
  복습데이터.대기열.push(신규);
  보관함_문서추가('복습대기열', 신규, {단어:item.단어, 뜻:item.뜻, 모드:item.모드, 연속정답수:0});

  // 휴지통에서 제거 (Firestore 문서 포함)
  보관함_문서삭제('휴지통', item.id);
  복습데이터.휴지통.splice(idx,1);

  showToastMsg('↩️ 대기열로 복구됨');
  renderReview();
}

function 휴지통_영구삭제(id){
  const idx = 복습데이터.휴지통.findIndex(x=>x.id===id);
  if(idx<0) return;

  보관함_문서삭제('휴지통', id);
  복습데이터.휴지통.splice(idx,1);

  showToastMsg('✕ 영구 삭제됨');
  renderReview();
}

function 휴지통_전체비우기(){
  if(복습데이터.휴지통.length===0){
    showToastMsg('휴지통이 비어있습니다');
    return;
  }
  복습데이터.휴지통.forEach(x=> 보관함_문서삭제('휴지통', x.id));
  복습데이터.휴지통 = [];
  showToastMsg('🧹 휴지통을 비웠습니다');
  업적_단발달성('clean');  // [환경미화원] 단발 +80 (KNOWLEDGE 14)
  renderReview();
}

/* (구) toggleFav — 호환성 유지용. 실제로는 위 새 함수들이 사용됨 */
function toggleFav(el){
  el.classList.toggle('on');
  el.textContent = el.classList.contains('on') ? '★' : '☆';
}
/* 복습 대기열 상한 설정 — 30/40/50/60/70 */
function openCapacity(){
  document.getElementById('selTitle').textContent='⚙️ 복습 대기열 상한';
  document.getElementById('selDesc').textContent='상한 초과 시 가장 오래된 항목이 휴지통으로 자동 이동됩니다. 현재 항목 수보다 작은 값으로는 변경 불가.';

  const list=document.getElementById('selList');
  const opts=[30,40,50,60,70];
  list.innerHTML='';

  opts.forEach(v=>{
    const div=document.createElement('div');
    div.className='select-opt'+(v===사용자.복습대기열상한?' on':'');

    // 현재 항목 수보다 작은 값으로 변경 시도 시 차단
    const 차단여부 = v < 사용자.복습대기열수;

    if(차단여부){
      div.style.opacity='0.4';
      div.style.cursor='not-allowed';
      div.onclick=()=>showInfoModal('🚫','변경 불가',
        `현재 대기열 항목 수(${사용자.복습대기열수}개)가 새 상한(${v}개)보다 많습니다.<br><br>먼저 항목을 줄여주세요.`);
    } else {
      div.onclick=()=>applyCapacity(v);
    }

    div.innerHTML=`<span>${v}개${v===50?' (기본값)':''}${차단여부?' 🚫':''}</span><span class="select-opt-ck">✓</span>`;
    list.appendChild(div);
  });

  document.getElementById('selBg').classList.add('show');
}

/* 상한 실제 적용 */
function applyCapacity(v){
  사용자.복습대기열상한=v;
  사용자데이터_저장({복습상한: v});  // 빌드1: Firestore 설정 동기화 (13-1 필드명 「복습상한」)

  // v3.5: 복습 화면이 표시 중이면 즉시 재렌더
  if(curScreen==='sr') renderReview();

  showToastMsg(`복습 대기열 상한: ${v}개`);
  setTimeout(closeSelect,250);
}

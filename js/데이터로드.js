// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   β8: 콘텐츠 데이터 로드 (data/ 폴더 JSON — KNOWLEDGE 1·3-3·24)
   - 정령왕_통합_v2.json: 구어_교정 27 / 유의어_변별 18 / 오늘의_한문장 7
   - 모드별 DB JSON 6종: 현재 빈 파일({"items":[]}) — 내용이 채워지면 자동으로 출제에 사용
   - fetch 실패 시(오프라인·file:// 직접 실행) 위 폴백 정적 데이터 유지
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let 구어교정풀 = [];           // 정령왕 구어_교정 27건
let 구어교정현재 = null;       // 현재 출제 중인 구어 교정 예문
let 구어교정완료ID = {};       // 같은 예문 반복 제출로 EXP 중복 획득 방지
/* 세션5: 구어 교정 완료 기록을 uid별 localStorage에 영속 — 새로고침 후 EXP 재획득 차단 */
function 구어완료_키(){ return 'plx_구어완료_' + (현재UID || '게스트'); }
function 구어완료_복원(){
  try{ 구어교정완료ID = JSON.parse(localStorage.getItem(구어완료_키())||'{}') || {}; }
  catch(e){ 구어교정완료ID = {}; }
  // 세션6 수정: '자유입력'은 영속 제외 — 예문 풀 미로드 시 모든 자유 제출의 EXP가
  // 영구히 잠기던 부작용(세션5 영속화의 회귀) 해소. 자유입력은 세션 내 1회만 제한.
  delete 구어교정완료ID['자유입력'];
}
function 구어완료_저장(){
  try{
    const 영속 = {...구어교정완료ID};
    delete 영속['자유입력'];   // 세션6: 자유입력은 세션 한정 (영구 잠금 방지)
    localStorage.setItem(구어완료_키(), JSON.stringify(영속));
  }catch(e){ /* 무시 */ }
}
const DB문제 = {};             // 모드명 → JSON items (β9 DB 출제 풀)
const DB파일맵 = {
  '상식·어원':'상식어원', '고사성어·속담':'고사성어속담', '세계사·신화':'세계사신화',
  '아재개그':'아재개그', '한자·우리말':'한자우리말', '맞춤법':'맞춤법'
};

function 예문데이터_로드(){
  return fetch('data/정령왕_통합_v2.json')
    .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(d=>{
      if(Array.isArray(d.유의어_변별) && d.유의어_변별.length) 유의어출제풀 = d.유의어_변별;
      if(Array.isArray(d.오늘의_한문장) && d.오늘의_한문장.length) 한문장풀 = d.오늘의_한문장;
      if(Array.isArray(d.구어_교정) && d.구어_교정.length) 구어교정풀 = d.구어_교정;
      // 세션10-c: 지문 독해 — 키 없으면 무해(정적 임시 표본 4건 유지)
      if(Array.isArray(d.지문_독해) && d.지문_독해.length) 지문독해풀 = d.지문_독해;
      // 세션10-m: 문장 배열 — 키 없으면 무해(정적 임시 표본 3건 유지)
      if(Array.isArray(d.문장_배열) && d.문장_배열.length) 문장배열풀 = d.문장_배열;
      // 홈 화면이 이미 떠 있으면 슬라이드 즉시 재빌드
      if(curScreen==='sh') 슬라이드빌드();
      구어교정_예문표시();
      console.log(`[데이터] 정령왕 JSON 로드 완료 — 구어 ${구어교정풀.length} / 유의어 ${유의어출제풀.length} / 한문장 ${한문장풀.length}`);
    })
    .catch(e=> console.error('[데이터] 정령왕 JSON 로드 실패 — 폴백 정적 데이터 사용', e));
}

function 모드DB_로드(){
  Object.entries(DB파일맵).forEach(([모드, 파일])=>{
    fetch(`data/${encodeURIComponent(파일)}.json`)
      .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(d=>{ DB문제[모드] = Array.isArray(d.items) ? d.items : []; })
      .catch(()=>{ DB문제[모드] = []; });
  });
}

/* 바텀 네비 */
/* 바텀 네비 표시 화면 목록 */
const SHOW_NAV=['sh','sq1','sq2','sq3','sq4','sq5','sq6','sq7','sr','sa','ss','sse','sg'];
/* 바텀 네비 활성 매핑 (학습 모드는 모두 '홈' 강조, sg는 현황 탭 강조) */
const NAV_MAP={'sh':'nb-sh','sr':'nb-sr','sa':'nb-sa','ss':'nb-ss','sse':'nb-sse','sg':'nb-ss','sq1':'nb-sh','sq2':'nb-sh','sq3':'nb-sh','sq4':'nb-sh','sq5':'nb-sh','sq6':'nb-sh','sq7':'nb-sh'};
/* (v3.4 미사용) FAB 표시 대상 학습 화면 — FAB 제거됐으나 호환용 보존 */
const ASK_FAB_SCREENS=['sq1','sq2','sq3','sq4','sq5'];

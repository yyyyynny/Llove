// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   질문하기
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   창조주 달성 시나리오
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   흐름:
   1. 사용자가 학습 화면 하단 AI 챗(또는 질문하기 패널)에서
      '창조주키'에 정의된 문장을 정확히 입력
   2. sendAsk()가 키 일치를 감지하면 창조주시작() 호출
   3. 창조주시작()이 입력창을 숨기고 시나리오 단계 진행
   4. 각 단계는 AI 메시지 또는 1개짜리 선택지 버튼으로 구성
   5. 마지막 단계 종료 시 창조주달성() — 1부 20화 전체화면 연출
   6. 종료 시 창조주종료() — 입력창 복구 + 토스트 안내
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// 89화 긴 버전 대사 시퀀스 (총 10단계)
// type: 'ai' = AI 발화 / 'choice' = 사용자 강제 선택지(버튼 1개)
// narr: true = 서술자 단락(연한 글씨, 이탤릭)
const 창조주시나리오 = [
  { type:'ai',     text:'"남부럽지 않게 어여삐 하는 것은 당연하고, 나 이외엔 누구도 너를 함부로 대할 수 없게 되겠지. 원한다면-"' },
  { type:'choice', text:'"원한다면 언제든 세상을 내 발밑에?"' },
  { type:'ai',     text:'"그건 약간 과하지."' },
  { type:'choice', text:'"바란다면 죽음도 나를 못 삼키게 해 주고?"' },
  { type:'ai',     text:'"……."' },
  { type:'ai',     text:"시종일관 여유만만하던 인물의 안면 근육이 굳어졌다.\n'……뭐지?'\n늘 불변적으로 안정적인 그의 심장 박동이 미세하게 어긋난다.\n몹시 기묘한 감각이었다.\n동시에 그는 어떤 확신이 들었다.", narr:true },
  { type:'ai',     text:'"……반다나를 벗거라. 이번에도 거부하면 강제로 벗겨 낼 테니."' },
  { type:'choice', text:'"어디서 많이 들어 본 말 같아?"' },
  { type:'ai',     text:'"들어 본 것이 아니라, 내가 했던 말 같은데."' },
  { type:'ai',     text:'"누구지, 너는?"' },
];

// 창조주 달성 키 (1부 19화 마지막 두 줄, 【】 포함 정확 일치)
const 창조주키 = '【원한다면 언제든 세계를 너의 발밑에.】\n【바란다면 죽음 또한 감히 그대를 삼키지 못할지니.】';

// 시나리오 진행 상태
let 창조주진행중 = false;
let 창조주단계 = 0;

/**
 * 키 정규화: 공백·줄바꿈 변형을 흡수해서 입력 안정성 확보
 * - 모든 줄바꿈을 \n으로 통일 (CRLF, LF, 단일 CR 모두 처리)
 * - 줄 단위 trim (모바일 음성/IME 입력 시 끝 공백 자주 들어감)
 * - 빈 줄 제거
 */
function 키정규화(s){
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

/* 창조주 시나리오 시작 */
function 창조주시작(){
  창조주진행중 = true;
  창조주달성진행중 = true;  // 토큰 차감 정지 — 세션 변수, Firebase 저장 없음 (KNOWLEDGE 32)
  창조주단계 = 0;

  // 입력창 숨김 (취약 selector 대신 ID 사용)
  const 입력영역 = document.getElementById('askInputArea');
  if(입력영역) 입력영역.style.display = 'none';

  // 중도 포기 버튼 노출
  const 포기버튼 = document.getElementById('askCls창조주');
  if(포기버튼) 포기버튼.style.display = 'flex';

  // 첫 단계로 진입
  창조주다음단계();
}

/* 시나리오 한 단계 진행 후 자동으로 다음 단계 호출 */
function 창조주다음단계(){
  // 모든 단계 완료 시 달성 처리
  if(창조주단계 >= 창조주시나리오.length){
    창조주달성();
    return;
  }

  const step = 창조주시나리오[창조주단계];
  const body = document.getElementById('askBody');
  if(!body){
    console.error('[창조주] askBody 요소를 찾을 수 없음');
    return;
  }

  if(step.type === 'ai'){
    // AI 발화 단계: 0.8초 딜레이 후 메시지 추가, 자동 다음 단계
    setTimeout(()=>{
      // 진행 중 중도 포기됐다면 멈춤 (race condition 방지)
      if(!창조주진행중) return;

      const el = document.createElement('div');
      el.className = 'ask-msg ai';
      el.style.whiteSpace = 'pre-line';
      if(step.narr){
        el.style.fontStyle = 'italic';
        el.style.color = 'var(--txt2)';
        el.style.opacity = '0.8';
      }
      el.textContent = step.text;
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;

      창조주단계++;
      창조주다음단계();
    }, 800);
  } else if(step.type === 'choice'){
    // 사용자 선택 단계: 0.4초 딜레이 후 1개짜리 선택지 버튼 등장
    setTimeout(()=>{
      if(!창조주진행중) return;

      const btn = document.createElement('button');
      btn.className = 'btn-acc';
      btn.style.cssText = 'width:100%;margin:6px 0;font-size:13px;text-align:left;padding:12px 16px;line-height:1.5';
      btn.textContent = step.text;

      btn.onclick = ()=>{
        // 선택한 대사를 사용자 메시지로 변환
        const u = document.createElement('div');
        u.className = 'ask-msg user';
        u.textContent = step.text;
        body.appendChild(u);
        btn.remove();

        창조주단계++;
        창조주다음단계();
      };

      body.appendChild(btn);
      body.scrollTop = body.scrollHeight;
    }, 400);
  }
}

/* 시나리오 완료 시 1부 20화 전체화면 연출 */
function 창조주달성(){
  closeAsk();

  // v3.5: 사용자 객체 + 업적 데이터 동시 갱신
  사용자.창조주달성 = true;
  사용자.개발자모드 = true;

  // 빌드1: 오버레이 레이어 초기화 — 이후 개발자 패널 조작값은 이 객체에만 기록 (실DB 분리)
  개발자오버레이 = {};

  // 업적 데이터에서 [창조주] 항목을 'unl'(달성)로 변경
  ACH_DATA.forEach(sec=>{
    sec.items.forEach(a=>{
      if(a.key==='creator'){
        a.stage = 'unl';
        a.blur = false; // 달성 후 블러 해제
      }
    });
  });

  // 화면 전체 오버레이로 1부 20화 문장 표시
  const overlay = document.createElement('div');
  overlay.id = '창조주달성연출';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:#030208;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:40px;text-align:center;
    animation:fadeUp .8s cubic-bezier(.22,1,.36,1) both;
  `;
  overlay.innerHTML = `
    <div style="font-size:16px;color:#8060c0;letter-spacing:2px;margin-bottom:28px;font-weight:700">👑 [창조주] 달성</div>
    <div style="font-family:'Nanum Myeongjo',serif;font-size:18px;color:#c0a0e0;line-height:2.2;letter-spacing:1px">
      【가장 오래된 약속에 따라 너와 나는 운명을 함께할 것이다.】<br>
      【그대 마지막 최후의 걸음까지 내가 지켜보리라.】
    </div>
    <div style="margin-top:36px;font-size:13px;color:#5a3880">- 랭바서 1부 20화 -</div>
    <button onclick="this.parentElement.remove();창조주종료();" style="margin-top:40px;background:linear-gradient(135deg,#5030a0,#8060c0);color:#fff;border:none;padding:13px 32px;border-radius:11px;font-family:'Noto Sans KR',sans-serif;font-size:14px;font-weight:700;cursor:pointer">계속하기</button>
  `;
  document.body.appendChild(overlay);

  showToastMsg('👑 +2000 EXP · 칭호: 폐하');
}

/* 시나리오 종료 시 입력창 복구 + 안내 + 모든 화면 재렌더 */
function 창조주종료(){
  창조주진행중 = false;
  창조주달성진행중 = false;  // 달성 완료 → 토큰 차감 재개 (KNOWLEDGE 32)
  창조주단계 = 0;
  // 빌드1: 창조주 달성 사항 Firestore 반영 + 개발자 네비 노출 + [창조주] 업적(+2000) 검사
  사용자데이터_저장({창조주달성:true, 개발자모드:true});
  갱신_개발자네비_표시();
  업적_검사();

  // 입력창 복구
  const 입력영역 = document.getElementById('askInputArea');
  if(입력영역) 입력영역.style.display = '';

  // 중도 포기 버튼 숨김
  const 포기버튼 = document.getElementById('askCls창조주');
  if(포기버튼) 포기버튼.style.display = 'none';

  // v3.6: 모든 관련 화면 강제 재렌더 (창조주 달성 반영)
  // 현재 표시 중인 화면이 업적/현황/설정이면 즉시 갱신
  if(curScreen==='sa') renderAchievements();
  if(curScreen==='ss') afterNav('ss');  // 빌드1: 소칭호·칭호 선택·주신 메시지 일괄 재렌더
  if(curScreen==='sse'){ 갱신_설정_개발자모드_UI(); 갱신_음성설정_UI(); }  // 추가기능: 음성 생성 행도 즉시 노출

  showToastMsg('🔓 개발자 모드가 활성화됩니다.');
}

/* 설정 화면 위험 구역의 개발자 모드 항목 표시 갱신 */
function 갱신_설정_개발자모드_UI(){
  const icon = document.getElementById('devModeIcon');
  const label = document.getElementById('devModeLabel');
  const desc = document.getElementById('devModeDesc');
  const arrow = document.getElementById('devModeArrow');
  if(!icon) return;

  if(사용자.개발자모드){
    // 활성화 상태
    icon.textContent = '🔓';
    label.style.color = 'var(--accl)';
    label.textContent = '개발자 모드';
    desc.textContent = '활성화됨 — 탭하여 진입';
    desc.style.color = 'var(--ok)';
    arrow.style.color = 'var(--acc)';
  } else {
    // 잠금 상태
    icon.textContent = '🔒';
    label.style.color = 'var(--txtm)';
    label.textContent = '개발자 모드';
    desc.textContent = '[창조주] 달성 후 활성화';
    desc.style.color = '';
    arrow.style.color = 'var(--txtm)';
  }
}

/* 개발자 모드 항목 탭 처리 — 빌드1: 오버레이 조작 패널로 직행 */
function 개발자모드_탭(){
  if(!사용자.개발자모드){
    showInfoModal('🔒','개발자 모드','[창조주] 업적을 달성하면 활성화됩니다.');
    return;
  }
  개발자패널_열기();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   질문하기 패널 열기/닫기
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// β7: 사고전개 — 기본 OFF, 패널 열 때마다 수동으로 켜야 함 (KNOWLEDGE 5-1)
let 사고전개모드 = false;
let 질문턴수 = 0;   // 질문하기 차감 계산용 — 1턴 시작 차감, 4턴부터 추가 차감 (KNOWLEDGE 32)
let 사고전개시작차감됨 = false;  // 오류 수정: 턴 중간에 사고전개를 켜도 시작 100토큰이 1회 차감되도록 추적
let 사전모드 = false;  // Phase 7: 질문하기 패널의 AI/사전 모드 전환 — 패널 열 때마다 AI로 리셋

/* ━━━ 세션6 항목4: 채팅 기록 — 세션 단위 저장 (최고 관리자님 확정 사양)
   - 세션 = 한 카테고리에서의 연속 대화. 카테고리 이동·「새 대화」 시 마감 후 기록으로 보관.
   - 세션당 메시지(나+AI 합계) 최대 100 — 도달 시 자동 마감 후 새 세션.
   - 보존: 최근 30세션. 로그인 시 Firestore 서브컬렉션 「채팅기록」(문서=세션),
     게스트는 plx_채팅기록(localStorage). 뷰어는 설정 「채팅 내역」 팝업. ━━━ */
let 채팅기록 = [];        // [{카테고리, 시작시각, 메시지:[{역할,내용,시각}], 문서ID?}] — 오래된 순
let 현재채팅세션 = null;  // 진행 중 세션 (마감 전, 미저장)
const 채팅기록_최대세션 = 30;
const 채팅세션_최대메시지 = 100;

// HTML 삽입용 이스케이프 (채팅 뷰어·지침 편집 등 사용자 텍스트 공용)
function 문자열_이스케이프(s){
  return String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function 채팅기록_추가메시지(역할, 내용){
  if(!내용) return;
  if(!현재채팅세션){
    현재채팅세션 = {카테고리: 현재학습모드 || '일반', 시작시각: Date.now(), 메시지: []};
  }
  현재채팅세션.메시지.push({역할, 내용: String(내용), 시각: Date.now()});
  진행중세션_저장();  // 세션10-d: 매 메시지마다 로컬 백업(강제 종료·크래시에도 최신 상태 보존)
  if(현재채팅세션.메시지.length >= 채팅세션_최대메시지){
    채팅세션_마감('상한 도달');
    showToastMsg('💬 대화가 100개에 도달해 기록으로 보관하고 새 대화를 시작합니다');
  }
}

// 진행 중 세션을 기록으로 보관하고 채팅창을 초기화
function 채팅세션_마감(사유){
  if(현재채팅세션 && 현재채팅세션.메시지.length){
    채팅기록.push(현재채팅세션);
    채팅기록_세션저장(현재채팅세션);
    while(채팅기록.length > 채팅기록_최대세션){
      const 제거 = 채팅기록.shift();               // 가장 오래된 세션 삭제 (30개 보존)
      if(제거 && 제거.문서ID) 채팅기록_문서삭제(제거.문서ID);
    }
    if(!현재UID) 채팅기록_게스트저장();             // 게스트는 배열 전체를 localStorage에
  }
  현재채팅세션 = null;
  try{ localStorage.removeItem('plx_진행중대화'); }catch(e){ /* 무시 */ }  // 세션10-d: 깔끔히 닫혔으니 백업 제거
  채팅창_초기화();
}

// ━━━ 세션10-d 항목1: 진행 중 대화 상시 로컬 백업 + 로드 시 복구 ━━━
// 세션10-c의 visibilitychange→채팅세션_마감은 (a)로그인 Firestore 비동기 write가 언로드 시점에 미완료로 끊기고
// (b)백그라운드 전환마다 채팅창을 초기화하는 부작용이 있었다. → 언로드 타이밍 의존을 버리고, 매 메시지마다
// 진행 중 세션을 동기 localStorage에 백업한 뒤 다음 로드에서 복구한다("새 대화 눌러야 저장" 현상 해소).
function 진행중세션_저장(){
  try{
    if(현재채팅세션 && 현재채팅세션.메시지.length){
      localStorage.setItem('plx_진행중대화', JSON.stringify(현재채팅세션));
    } else {
      localStorage.removeItem('plx_진행중대화');
    }
  }catch(e){ /* localStorage 차단 환경 무시 */ }
}
function 진행중세션_복원(){
  // 깔끔히 닫히면 마감 시 키가 제거되므로, 키가 남아 있다 = 지난 세션이 언로드로 중단됨 → 지금(앱 생존 중) flush
  let 백업 = null;
  try{ 백업 = JSON.parse(localStorage.getItem('plx_진행중대화') || 'null'); }catch(e){ 백업 = null; }
  if(백업 && Array.isArray(백업.메시지) && 백업.메시지.length){
    const 중복 = 채팅기록.some(s => s.시작시각 === 백업.시작시각);  // 재복원 중복 방지
    if(!중복){
      채팅기록.push(백업);
      채팅기록_세션저장(백업);
      while(채팅기록.length > 채팅기록_최대세션){
        const 제거 = 채팅기록.shift();
        if(제거 && 제거.문서ID) 채팅기록_문서삭제(제거.문서ID);
      }
      if(!현재UID) 채팅기록_게스트저장();
    }
  }
  try{ localStorage.removeItem('plx_진행중대화'); }catch(e){ /* 무시 */ }
}

// 세션10-d: 언로드 시 최후 백업만 보장(마감·리셋 없음 — 채팅창 초기화 부작용 제거).
// pagehide가 안 오는 모바일 대비 visibilitychange(hidden)도 둔다.
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'hidden') 진행중세션_저장();
});
window.addEventListener('pagehide', () => 진행중세션_저장());

function 채팅창_초기화(){
  const body = document.getElementById('askBody');
  if(body) body.innerHTML = '<div class="ask-msg ai">안녕하세요! 학습 중 궁금한 점이 있으시면 자유롭게 질문해 주세요. Grok이 답변드립니다.</div>';
}

function 새대화_시작(){
  if(현재채팅세션 && 현재채팅세션.메시지.length){
    채팅세션_마감('새 대화');
    showToastMsg('🆕 이전 대화를 기록에 보관했습니다');
  } else {
    채팅창_초기화();
    showToastMsg('🆕 새 대화를 시작합니다');
  }
}

// 저장/로드 — 토큰로그_기록 패턴 (로그인: Firestore / 게스트: localStorage)
function 채팅기록_세션저장(세션){
  if(fbDb && 현재UID){
    fbDb.collection('users').doc(현재UID).collection('채팅기록').add({
      카테고리: 세션.카테고리, 시작시각: 세션.시작시각, 메시지: 세션.메시지,
      보관일시: firebase.firestore.FieldValue.serverTimestamp()
    }).then(doc=>{ 세션.문서ID = doc.id; })
      .catch(e=> console.error('[Firestore] 채팅기록 저장 실패', e));
  } else {
    채팅기록_게스트저장();
  }
}
function 채팅기록_게스트저장(){
  try{ localStorage.setItem('plx_채팅기록', JSON.stringify(채팅기록.slice(-채팅기록_최대세션))); }catch(e){ /* 무시 */ }
}
function 채팅기록_문서삭제(id){
  if(!fbDb || !현재UID || !id) return;
  fbDb.collection('users').doc(현재UID).collection('채팅기록').doc(id).delete().catch(()=>{});
}
// 세션10-l: 계정 삭제·학습 데이터 초기화 시 채팅 기록도 함께 지우는 공용 헬퍼 —
// 기존엔 두 초기화 흐름 모두 채팅 기록을 건드리지 않아 초기화·탈퇴 후에도 대화 내역이 그대로 남아있었음.
// 로그인 사용자는 Firestore 서브컬렉션 문서를 개별 삭제(부모 문서 삭제만으론 서브컬렉션이 안 지워짐),
// 게스트는 localStorage 캐시를 지운다. 진행 중이던 미마감 세션도 함께 정리.
function 채팅기록_전체삭제(){
  채팅기록.forEach(s => { if(s.문서ID) 채팅기록_문서삭제(s.문서ID); });
  채팅기록 = [];
  현재채팅세션 = null;
  try{ localStorage.removeItem('plx_채팅기록'); localStorage.removeItem('plx_진행중대화'); }catch(e){ /* 무시 */ }
  채팅창_초기화();
}
function 채팅기록_로드(){
  if(fbDb && 현재UID){
    fbDb.collection('users').doc(현재UID).collection('채팅기록').get().then(스냅=>{
      const 전체 = 스냅.docs.map(d=>({문서ID:d.id, ...d.data()}))
        .sort((a,b)=>(a.시작시각||0)-(b.시작시각||0));
      // 세션7: 30개 초과 잔여 문서는 로드 시점에 정리 (마감 경로 밖 누적 방지)
      전체.slice(0, Math.max(0, 전체.length - 채팅기록_최대세션)).forEach(s=>{
        if(s.문서ID) 채팅기록_문서삭제(s.문서ID);
      });
      채팅기록 = 전체.slice(-채팅기록_최대세션);
      진행중세션_복원();  // 세션10-d: 언로드로 중단된 지난 세션 복구(로드 완료 후)
    }).catch(e=> console.error('[Firestore] 채팅기록 로드 실패', e));
  } else {
    try{
      const d = JSON.parse(localStorage.getItem('plx_채팅기록')||'null');
      if(Array.isArray(d)) 채팅기록 = d.slice(-채팅기록_최대세션);
    }catch(e){ /* 무시 */ }
    진행중세션_복원();  // 세션10-d: 게스트도 로드 후 복구
  }
}

// 뷰어 — 설정 「채팅 내역」: 세션 목록 → 탭하면 해당 세션 전문
function 채팅세션_전체(){
  const 전체 = [...채팅기록];
  if(현재채팅세션 && 현재채팅세션.메시지.length) 전체.push({...현재채팅세션, 진행중:true});
  return 전체;
}
function 채팅내역_열기(){
  const esc = 문자열_이스케이프;
  const 전체 = 채팅세션_전체();
  if(!전체.length){
    showInfoModal('💬','채팅 내역','저장된 대화가 없습니다.<br>학습 화면의 AI 챗에서 대화하면 자동으로 기록됩니다.<br><span style="font-size:11px;color:var(--txt2)">(최근 30개 대화 보존 · 대화당 메시지 100개 상한)</span>');
    return;
  }
  const 목록 = 전체.slice().reverse().map((s, i)=>{
    const 실idx = 전체.length - 1 - i;
    const 첫질문 = (s.메시지.find(m=>m.역할==='나')||{}).내용 || '(질문 없음)';
    const 일시 = s.시작시각 ? new Date(s.시작시각).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
    return `<div style="padding:8px 2px;border-bottom:1px solid var(--bdr);cursor:pointer;text-align:left" onclick="채팅세션_보기(${실idx})">
      <div style="font-size:12px;font-weight:700">${s.진행중?'🟢 ':''}${esc(s.카테고리||'일반')} <span style="font-weight:400;color:var(--txt2)">· ${일시} · ${s.메시지.length}개</span></div>
      <div style="font-size:11px;color:var(--txt2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(첫질문)}</div>
    </div>`;
  }).join('');
  showInfoModal('💬','채팅 내역', `<div style="max-height:62vh;overflow-y:auto">${목록}</div><div style="font-size:10px;color:var(--txtm);margin-top:6px">최근 ${채팅기록_최대세션}개 대화 보존 · 대화당 ${채팅세션_최대메시지}개 상한</div>`, true);
}
/* ━━━ 세션6 항목5: AI 지침(통합 메모리) — 공백 포함 500자 제한 (최고 관리자님 확정 사양)
   - 자동 수집 없음. 사용자가 직접 작성한 지침 하나를 모든 AI 호출(grok호출 공통 body)에 전달.
   - 500자 초과 시 카운터가 빨간 음수로 표시되고, 저장을 누르면 「저장 실패」 팝업 + 원인 안내. ━━━ */
const AI지침_최대길이 = 500;
function AI지침_열기(){
  const esc = 문자열_이스케이프;
  showInfoModal('🧭','AI 지침',
    `<div style="text-align:left;font-size:11px;color:var(--txt2);margin-bottom:6px">AI에게 항상 함께 전달되는 통합 지침입니다. (공백 포함 ${AI지침_최대길이}자)</div>
     <textarea id="ai지침입력" oninput="AI지침_카운터갱신()" placeholder="예: 답변은 존댓말로, 예시는 2개씩 들어줘" style="width:100%;min-height:110px;background:var(--elev);border:1px solid var(--bdr);border-radius:9px;padding:10px;color:var(--txt);font-family:var(--fn);font-size:12px;line-height:1.6;resize:vertical;outline:none">${esc(사용자.AI지침||'')}</textarea>
     <div id="ai지침카운터" style="text-align:right;font-size:11px;margin-top:4px;color:var(--txt2)"></div>`);
  const btns = document.getElementById('infoBtns');
  if(btns) btns.innerHTML = `<button class="btn-g" style="flex:1" onclick="closeInfoModal()">닫기</button><button class="btn-acc" style="flex:1" onclick="AI지침_저장()">저장</button>`;
  AI지침_카운터갱신();
}
function AI지침_카운터갱신(){
  const t = document.getElementById('ai지침입력');
  const c = document.getElementById('ai지침카운터');
  if(!t || !c) return;
  const 남은 = AI지침_최대길이 - t.value.length;
  if(남은 >= 0){
    c.textContent = `${t.value.length} / ${AI지침_최대길이}자`;
    c.style.color = ''; c.style.fontWeight = '';
  } else {
    // 확정 사양: 초과 시 오버플로우가 아니라 빨간 음수로 표시
    c.textContent = `${남은}자 (제한 초과)`;
    c.style.color = 'var(--err)'; c.style.fontWeight = '700';
  }
}
function AI지침_저장(){
  const t = document.getElementById('ai지침입력');
  if(!t) return;
  const 값 = t.value;
  if(값.length > AI지침_최대길이){
    // 확정 사양: 저장 실패 팝업 + 원인
    showInfoModal('❌','저장 실패', `지침이 <b>${AI지침_최대길이}자 제한을 ${값.length - AI지침_최대길이}자 초과</b>했습니다.<br>내용을 줄인 뒤 다시 저장해 주세요.`);
    return;
  }
  사용자.AI지침 = 값;
  try{ localStorage.setItem('plx_AI지침', 값); }catch(e){ /* 무시 */ }
  사용자데이터_저장({AI지침: 값});
  AI지침_상태갱신();
  closeInfoModal();
  showToastMsg('🧭 AI 지침 저장 완료');
}
function AI지침_상태갱신(){
  const s = document.getElementById('ai지침상태');
  if(s) s.textContent = (사용자.AI지침 && 사용자.AI지침.length) ? `${사용자.AI지침.length}자 저장됨` : '없음';
}

function 채팅세션_보기(idx){
  const esc = 문자열_이스케이프;
  const s = 채팅세션_전체()[idx];
  if(!s) return;
  // 세션10-d 항목2: AI 답변에 개행이 포함되므로 white-space:pre-wrap로 순수 텍스트를 그대로 보존해 표시
  const 본문 = s.메시지.map(m=>
    `<div style="margin:6px 0;text-align:${m.역할==='나'?'right':'left'}"><span style="display:inline-block;max-width:92%;padding:7px 10px;border-radius:8px;background:var(--elev);border:1px solid var(--bdr);font-size:12px;line-height:1.6;text-align:left;color:var(--txt);white-space:pre-wrap;word-break:break-word">${m.역할==='나'?'🙋':'🤖'} ${esc(m.내용)}</span></div>`
  ).join('');
  showInfoModal('💬', esc(s.카테고리||'일반') + ' 대화', `<div style="max-height:62vh;overflow-y:auto;text-align:left">${본문}</div><div style="margin-top:8px"><button class="btn-g" style="width:100%;padding:9px" onclick="채팅내역_열기()">← 목록으로</button></div>`, true);
}

function 사고전개_토글(){
  사고전개모드 = !사고전개모드;
  const b=document.getElementById('thinkToggle');
  if(b){
    b.textContent = 사고전개모드 ? '🧠 사고전개 ON' : '🧠 사고전개 OFF';
    b.style.color = 사고전개모드 ? 'var(--acc)' : '';
    b.style.borderColor = 사고전개모드 ? 'var(--acc)' : '';
  }
  showToastMsg(사고전개모드
    ? '🧠 사고전개 ON — 시작 100토큰, 4턴부터 매 턴 +30'
    : '🧠 사고전개 OFF');
}

function openAsk(){
  // 사고전개 기본값 OFF로 초기화 (매번 수동 ON — KNOWLEDGE 5-1)
  사고전개모드 = false;
  사고전개시작차감됨 = false;
  질문턴수 = 0;
  const b=document.getElementById('thinkToggle');
  if(b){ b.textContent='🧠 사고전개 OFF'; b.style.color=''; b.style.borderColor=''; }
  토큰표시_갱신();
  질문모드_전환('ai');  // Phase 7: 패널 열 때마다 AI 질문 모드로 리셋(사전 모드가 남아있지 않게)
  document.getElementById('askBg').classList.add('show');
  document.getElementById('askPanel').classList.add('show');
  setTimeout(()=>document.getElementById('askInp').focus(),400);
}

// Phase 7: 질문하기 패널의 AI 질문/사전 뜻풀이 모드 전환
function 질문모드_전환(모드){
  사전모드 = (모드 === 'dict');
  const aiTab = document.getElementById('askTabAI');
  const dictTab = document.getElementById('askTabDict');
  if(aiTab) aiTab.classList.toggle('on', !사전모드);
  if(dictTab) dictTab.classList.toggle('on', 사전모드);
  const inp = document.getElementById('askInp');
  if(inp) inp.placeholder = 사전모드 ? '뜻을 찾을 단어를 입력하세요...' : '질문을 입력하세요...';
}

function closeAsk(){
  document.getElementById('askBg').classList.remove('show');
  document.getElementById('askPanel').classList.remove('show');
  활성입력_blur();  // 항목4: 패널을 닫아도 입력 포커스가 남아 커서가 깜빡이던 문제 해소

  // 시나리오 진행 중 강제 종료 = 중도 포기
  if(창조주진행중){
    창조주진행중 = false;
    창조주달성진행중 = false;  // 중도 포기 → 토큰 차감 재개
    창조주단계 = 0;

    // UI 복구 (ID 기반)
    const 입력영역 = document.getElementById('askInputArea');
    if(입력영역) 입력영역.style.display = '';
    const 포기버튼 = document.getElementById('askCls창조주');
    if(포기버튼) 포기버튼.style.display = 'none';

    // askBody 초기화
    const body = document.getElementById('askBody');
    if(body) body.innerHTML = '<div class="ask-msg ai">안녕하세요! 학습 중 궁금한 점이 있으시면 자유롭게 질문해 주세요. Grok이 답변드립니다.</div>';

    showToastMsg('중도 포기 — 처음부터 다시 시도해야 합니다.');
  }
}

/* 버그4 수정: 질문 입력창 높이 자동 조절 — 내용 줄 수에 맞춰 확장(최대 120px) */
function 질문입력_높이조절(el){
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// 세션10-h: 모바일에서 Shift+Enter로 줄바꿈하기가 매우 불편해 대부분의 채팅 앱처럼 예외 처리 —
// 터치 우선(정밀 포인터 없음) 기기에서는 Enter가 그냥 줄바꿈되고, 전송은 버튼(.ask-send)으로만 한다.
function 모바일_입력환경(){
  try{ return window.matchMedia && matchMedia('(pointer: coarse)').matches; }catch(e){ return false; }
}
function 질문입력_Enter처리(ev){
  if(ev.key === 'Enter' && !ev.shiftKey && !모바일_입력환경()){
    ev.preventDefault();
    sendAsk();
  }
  // 모바일이거나 Shift+Enter면 기본 동작(줄바꿈) 그대로 둠
}

/* 메시지 전송: 창조주 키 감지 + 일반 응답 */
function sendAsk(){
  if(사전모드){ sendAsk_사전(); return; }  // Phase 7: 사전 모드는 완전히 별개 흐름(토큰·창조주 로직 없음)

  const inp=document.getElementById('askInp');
  const q=inp.value.trim();
  if(!q) return;

  // [심연을 들여다보는 자] — 자아·존재·너는 누구냐 키워드 감지 (KNOWLEDGE 14 히든)
  if(/자아|존재|너는 누구/.test(q)) 업적_단발달성('abyss');

  // 창조주 키 감지 (정규화 후 비교)
  if(키정규화(q) === 키정규화(창조주키)){
    // 세션5 버그6(방식A — 완전 차단): 이미 창조주면 퀘스트 재진입 불가.
    // ※ 재감상 허용(방식B)으로 바꾸려면 이 if 블록만 제거하고 창조주달성()에 멱등 처리를 넣으면 된다.
    if(사용자.창조주달성){
      inp.value='';
      inp.style.height='auto';
      // 세션6 항목3: 최고 관리자님 지정 문구로 교체 (맞춤법 교정 반영)
      showInfoModal('👑','알현','시스템의 창조자이자 최고 권력자이신, 드높으신 폐하를 알현합니다.<br><br><span style="font-size:11px;color:var(--txt2)">창조주 퀘스트는 최초 1회만 진행됩니다.</span>');
      return;
    }
    inp.value='';
    inp.style.height='auto';  // 버그4: 전송 후 입력창 높이 초기화
    const body=document.getElementById('askBody');

    // 사용자가 입력한 키 문장을 메시지로 표시
    const u=document.createElement('div');
    u.className='ask-msg user';
    u.style.whiteSpace='pre-line';
    u.textContent=q;
    body.appendChild(u);
    body.scrollTop=body.scrollHeight;

    // 시나리오 진입
    setTimeout(창조주시작, 800);
    return;
  }

  // 일반 질문 처리 — β1 연결 지점 (Grok 게이트)
  const body=document.getElementById('askBody');
  const u=document.createElement('div');
  u.className='ask-msg user';
  u.textContent=q;
  body.appendChild(u);
  inp.value='';
  inp.style.height='auto';  // 버그4: 전송 후 입력창 높이 초기화
  body.scrollTop=body.scrollHeight;
  // 세션10-j/k: 【】(창조주 키 문장 전용 특수기호, 앱 내 다른 곳엔 쓰이지 않음)가 포함된 메시지는
  // 정확한 키와 완전히 일치하지 않아도(오타·부분 복사·재시도 등) 사실상 창조주 시도이므로, 화면엔
  // 그대로 보여주되 정식 채팅 내역엔 저장하지 않는다. 창조주 달성 여부와 무관하게 항상 적용 —
  // (세션10-j에서는 미달성 상태에만 한정했으나, 실기기 확인 결과 이미 달성한 계정에서 키 문장을
  // 재입력(재확인·복사 오차 등)해도 매칭 실패 시 여전히 저장돼 같은 문제가 재현됨(세션10-k)).
  const 창조주시도중 = /[【】]/.test(q);
  if(!창조주시도중) 채팅기록_추가메시지('나', q);  // 세션6 항목4: 대화 기록 축적

  if(!GROK_활성화){
    // 크레딧 미구매 단계: 호출·토큰 차감 없이 안내만 출력
    setTimeout(()=>{
      const a=document.createElement('div');
      a.className='ask-msg ai';
      // 세션6 항목2: 사고전개 ON 상태 안내 병기
      const 안내 = '🔌 Grok 연동 준비 중입니다.<br>API 크레딧 구매 후 활성화되면 실제 답변이 제공됩니다. (토큰 차감 없음)'
        + (사고전개모드 ? '<br><br>🧠 사고전개가 켜져 있습니다 — 활성화 후 답변과 함께 사고 과정이 표시됩니다.' : '');
      a.innerHTML = 안내;
      body.appendChild(a);
      body.scrollTop=body.scrollHeight;
      // 세션10-d 항목2: 요약 라벨이 아니라 화면에 뿌린 안내문 그대로 저장(태그만 개행으로 치환한 순수 텍스트)
      if(!창조주시도중) 채팅기록_추가메시지('AI', 안내.replace(/<br\s*\/?>/gi,'\n'));
    },400);
    return;
  }

  // ── 이하 Grok 활성화 후 실행 경로 ──
  // 토큰 차감: 시작 차감 1턴 / 2~3턴 무료 / 4턴부터 매 턴 추가 차감 (KNOWLEDGE 32)
  // 사고전개는 켠 시점이 몇 턴이든 첫 사용 시 100 시작 차감, 이후 4턴~ +30
  질문턴수++;
  const 기능 = 사고전개모드 ? '사고전개' : '질문하기';
  let 비용;
  if(사고전개모드 && !사고전개시작차감됨){
    비용 = 100;
    사고전개시작차감됨 = true;
  } else if(질문턴수 === 1){
    비용 = 20;
  } else {
    비용 = (질문턴수 >= 4) ? (사고전개모드 ? 30 : 15) : 0;
  }
  if(비용>0 && !토큰차감(기능, 비용)){
    질문턴수--;
    if(사고전개모드 && 비용===100) 사고전개시작차감됨 = false;  // 차감 실패 시 시작 차감 상태 되돌림
    return;
  }
  // 질문하기 통계 (KNOWLEDGE 13-1) + [질문쟁이] 누적 카운터
  const 오늘 = 오늘날짜_로컬(0);
  if(사용자.질문날짜 !== 오늘){ 사용자.질문날짜=오늘; 사용자.오늘질문횟수=0; }
  사용자.오늘질문횟수++;
  사용자.총질문수 = (사용자.총질문수||0) + 1;
  사용자데이터_저장({오늘질문횟수:사용자.오늘질문횟수, 질문날짜:오늘, 총질문수:사용자.총질문수});
  업적_검사();

  grok호출(기능, {질문:q}).then(res=>{
    const a=document.createElement('div');
    a.className='ask-msg ai';
    if(res && res.답변){
      // 세션6 항목2: 사고전개 블록 — 응답에 사고전개가 오면 답변 위에 접힌 형태로 표시 (기본 글자색으로 가독 확보)
      const 사고블록 = (사고전개모드 && res.사고전개)
        ? `<div class="ask-think">🧠 <b>사고 전개</b><br>${res.사고전개}</div>`
        : '';
      // 이의있음! 버튼은 답변 생성 후에만 노출 (KNOWLEDGE 5 표시 조건)
      a.innerHTML = 사고블록 + res.답변 + '<br><br><button class="ask-objection-btn" onclick="openObj()">⚖️ 이의있음!</button>';
      // 세션10-d 항목2: 가공 라벨 없이 순수 텍스트(사고전개 있으면 답변 위에 그대로) 저장
      if(!창조주시도중) 채팅기록_추가메시지('AI', (res.사고전개 ? res.사고전개 + '\n\n' : '') + res.답변);
    } else {
      a.textContent = UI_TEXT.rate_limit.문구;
      if(!창조주시도중) 채팅기록_추가메시지('AI', UI_TEXT.rate_limit.문구);
    }
    body.appendChild(a);
    body.scrollTop=body.scrollHeight;
  });
}

// Phase 7: 사전 모드 전송 — AI 챗과 완전히 분리된 흐름(토큰 차감·창조주 시나리오·사고전개 없음).
// 국립국어원(우리말샘/표준국어대사전) API가 돌려주는 뜻풀이를 그대로 표시하는 결정론적 조회라
// AI/LLM이 전혀 관여하지 않는다 — 그래서 AI 챗 버블(.ask-msg.ai)이 아닌 .ask-msg.dict로 렌더링해
// 시각적으로도 "AI가 답한 것"처럼 보이지 않게 구분한다.
async function sendAsk_사전(){
  const inp=document.getElementById('askInp');
  const q=inp.value.trim();
  if(!q) return;
  const body=document.getElementById('askBody');
  const u=document.createElement('div');
  u.className='ask-msg user';
  u.textContent=q;
  body.appendChild(u);
  inp.value='';
  inp.style.height='auto';
  body.scrollTop=body.scrollHeight;

  if(!국어원_활성화){
    const a=document.createElement('div');
    a.className='ask-msg dict';
    a.innerHTML='📖 사전 연동 준비 중입니다.<br>국립국어원 API 준비가 끝나면 실제 뜻풀이가 표시됩니다.';
    body.appendChild(a);
    body.scrollTop=body.scrollHeight;
    return;
  }

  const 결과 = await 사전_단어조회(q);
  const a=document.createElement('div');
  a.className='ask-msg dict';
  a.innerHTML = 사전결과_HTML(결과);
  body.appendChild(a);
  body.scrollTop=body.scrollHeight;
}

// 조회 결과 → 표시용 HTML 문자열. 게이트/네트워크와 분리된 순수 렌더링 함수라 단위 테스트가 쉽다.
// CC BY-SA 2.0 KR 저작자 표시 — 뜻풀이 원문을 그대로 노출하므로 결과가 있을 때마다 표기.
// 2026-08-19: 동음이의어(어원이 다른 같은 철자, 예: 필연=必然/筆硯) 표시 개선 — 종전엔 그룹
// 구분 없이 모든 뜻을 1·2·3…으로 섞어 보여줬다. 그룹이 하나뿐이면 기존과 동일하게 번호
// 목록만, 둘 이상이면 ①/②로 나눠 보여준다(js/사전.js의 뜻풀이그룹_정규화()가 구 계약
// { 뜻풀이:[...] } 도 1그룹으로 감싸주므로 여기서는 결과.뜻풀이그룹만 보면 된다).
const 사전_동그라미 = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨'];
function 사전결과_HTML(결과){
  const 그룹 = 뜻풀이그룹_정규화(결과);
  if(!그룹.length) return '사전에서 찾을 수 없는 단어입니다.';
  const 출처 = '<div style="font-size:11px;color:var(--txtm);margin-top:8px">출처: 국립국어원 우리말샘·표준국어대사전 (CC BY-SA 2.0 KR)</div>';
  if(그룹.length === 1){
    const 목록 = 그룹[0].뜻풀이.map((뜻,i)=>`${i+1}. ${뜻}`).join('<br>');
    return `${목록}${출처}`;
  }
  const 블록들 = 그룹.map((g,gi)=>{
    const 표식 = 사전_동그라미[gi] || `(${gi+1})`;
    const 목록 = g.뜻풀이.map((뜻,i)=>`${i+1}. ${뜻}`).join('<br>');
    return `<div${gi?' style="margin-top:8px"':''}><b>${표식}</b> ${목록}</div>`;
  }).join('');
  return `${블록들}${출처}`;
}

function openObj(컨텍스트){
  // v3.7 항목5: 이의있음! 컨텍스트 분기 (general/synonym/speak)
  이의제기_컨텍스트_설정(컨텍스트 || 'general');
  // β3: reasoning_note 패널 — 항상 상단 표시 (KNOWLEDGE 33)
  const note=document.getElementById('objNote');
  if(note){
    note.style.display='block';
    note.innerHTML = `<div class="obj-note-lbl">${UI_TEXT.이의있음.출제근거라벨}</div>` +
      (현재문제_reasoning_note
        ? 현재문제_reasoning_note
        : '(이 문제는 출제 근거가 아직 등록되지 않았습니다 — Grok 연동 후 자동 생성됩니다)');
  }
  // 토큰 소진 시 이의있음! 비활성화 (KNOWLEDGE 5 표시 조건)
  if(!사용자.개발자모드 && (사용자.보유토큰||0) <= 0){
    showToastMsg('💎 토큰 소진 — 이의있음!은 충전 후 사용 가능합니다');
    return;
  }
  document.getElementById('objBg').classList.add('show');
  setTimeout(()=>document.getElementById('objInp').focus(),300);
}
function closeObj(){
  document.getElementById('objBg').classList.remove('show');
  document.getElementById('objInp').value='';
  활성입력_blur();  // 항목4: 이의있음 모달 닫을 때 입력 포커스(커서) 해제
  // 버그E 수정: 닫을 때 컨텍스트를 general로 복귀 → 다음 호출 시 잔존 컨텍스트(synonym/speak) 방지
  이의제기_컨텍스트_설정('general');
}
// β6: 이의있음! 멀티턴 — 시작 70토큰, 매 턴 +30, 턴 제한 없음 (KNOWLEDGE 5·32)
let 이의턴수 = 0;
function submitObj(){
  const 내용 = document.getElementById('objInp').value.trim();
  if(!내용){
    showToastMsg('반박 내용을 입력해 주세요');
    return;
  }
  if(!GROK_활성화){
    // 크레딧 미구매 단계: 가짜 판정 폐기 — 호출·차감 없이 안내만 (구 데모의 거짓 「반박의 화신 +1」 제거)
    closeObj();
    showToastMsg('🔌 이의있음!은 Grok 연동 후 사용 가능합니다 (토큰 차감 없음)');
    return;
  }
  // ── 이하 Grok 활성화 후 실행 경로 ──
  이의턴수++;
  const 비용 = (이의턴수===1) ? 70 : 30;
  if(!토큰차감('이의있음', 비용)){ 이의턴수--; return; }
  마스터리증가('이의제기횟수');
  // grok호출('이의있음', {반박:내용, 컨텍스트:이의제기_컨텍스트, 출제근거:현재문제_reasoning_note})
  //   → 최종 판정 인정 시: 마스터리증가('반박성공횟수') + EXP획득(100, '반박 성공') (KNOWLEDGE 12)
  //   → 이의제기로그 서브컬렉션 기록 (KNOWLEDGE 13-1)
  closeObj();
  showToastMsg('⚖️ 반박 제출 — Grok 교차검증 중...');
}

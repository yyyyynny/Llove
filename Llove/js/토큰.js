// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   β2: 토큰 시스템 (KNOWLEDGE 32) + β5: 토큰 UI (KNOWLEDGE 35)
   - 기본 1,500 / 소진 시 2시간 락 → 전량 충전
   - 차감: 문제생성 15 · 질문하기 20(+15/4턴~) · 사고전개 100(+30/4턴~)
           구어교정 30 · 유사문제 20 · 이의있음 70(+30/턴~)
   - 복구: 2시간 대기 전량 · 복습 1회 +30(일 3회) · 10연속 정답 +10
   - GROK_활성화=false인 동안 실차감 발생 경로 없음 (호출 자체가 봉인)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// 토큰 관련 UI 문구 — 전부 한글 변수로 관리 (KNOWLEDGE 32 UI_TEXT 그대로)
const UI_TEXT = {
  토큰: {
    소진안내: "토큰이 소진되었습니다",
    락안내: "2시간 후 충전됩니다",
    경고75: "토큰이 75% 남았습니다",
    경고50: "토큰이 절반 남았습니다",
    경고25: "토큰이 거의 소진되었습니다",
    차감내역제목: "최근 차감 내역",
    기능명: {
      문제생성: "문제 생성",
      질문하기: "질문하기",
      사고전개: "사고전개",
      구어교정: "구어 교정",
      이의있음: "이의있음!",
      유사문제: "유사 문제"
    }
  },
  이의있음: {
    출제근거라벨: "📋 출제 근거",
    반박입력플레이스홀더: "어디가 틀렸나요?",
    위협감지: "?? 위협 감지??",
    락안내: "10분 후 해제됩니다"
  },
  소진흐름: {
    ai끄기안내: "토큰 소진. AI 출제를 끄면 계속 학습 가능합니다.",
    db소진안내: "더 풀 수 있는 문제가 없습니다. 히스토리를 초기화하거나 충전을 기다려 주세요.",
    끄기버튼: "AI 출제 끄기",
    기다리기버튼: "기다리기",
    히스토리초기화버튼: "히스토리 초기화"
  },
  rate_limit: {
    문구: "Oops, 그록이 뻗었어요!"
  }
};

// 창조주 충돌 해결 — 세션 변수만, Firebase 저장 없음 (KNOWLEDGE 32 확정)
let 창조주달성진행중 = false;
let 토큰경고단계 = 0;       // 0=없음 1=75% 2=50% 3=25% (같은 단계 중복 토스트 방지)
let 토큰로그세션 = [];       // 드롭다운용 최근 차감 내역 (Firestore 토큰로그 서브컬렉션 미러)

// 토큰 바 색상 단계 (KNOWLEDGE 35 구현 참고 코드 그대로)
function 토큰색상계산(잔량){
  if(잔량 > 1125) return '#4caf50'; // 초록
  if(잔량 > 750)  return '#ffeb3b'; // 노랑
  if(잔량 > 375)  return '#ff9800'; // 주황
  return '#f44336';                  // 빨강
}

// 2시간 락 만료 검사 — 만료 시 전량 충전 (소진 「시점」부터 2시간, 앱 실행 시점 아님)
function 토큰락_체크(){
  if(사용자.토큰락해제시각 && Date.now() >= new Date(사용자.토큰락해제시각).getTime()){
    사용자.보유토큰 = 1500;
    사용자.토큰소진시각 = null;
    사용자.토큰락해제시각 = null;
    토큰경고단계 = 0;
    사용자데이터_저장({보유토큰:1500, 토큰소진시각:null, 토큰락해제시각:null});
    토큰표시_갱신();
    showToastMsg('💎 토큰이 전량 충전되었습니다 (1,500)');
  }
}

// 토큰 차감 — 성공 시 true. 개발자 모드 무제한 / 창조주 달성 흐름 중 차감 정지
function 토큰차감(기능명, 양){
  if(사용자.개발자모드) return true;        // 개발자 모드: 토큰 제한 해제 (KNOWLEDGE 14)
  if(창조주달성진행중) return true;          // 창조주 달성 흐름 중 차감 정지 (KNOWLEDGE 32)
  토큰락_체크();
  if(사용자.토큰락해제시각){ showToastMsg('🔒 ' + UI_TEXT.토큰.락안내); return false; }
  if((사용자.보유토큰 || 0) < 양){ showToastMsg(UI_TEXT.토큰.소진안내); return false; }
  사용자.보유토큰 -= 양;
  사용자.총소비토큰 = (사용자.총소비토큰 || 0) + 양;
  const 저장필드 = {보유토큰:사용자.보유토큰, 총소비토큰:사용자.총소비토큰};
  if(사용자.보유토큰 <= 0){
    // 소진 → 2시간 락 시작
    사용자.보유토큰 = 0;
    사용자.토큰소진시각 = new Date().toISOString();
    사용자.토큰락해제시각 = new Date(Date.now() + 2*3600*1000).toISOString();
    저장필드.보유토큰 = 0;
    저장필드.토큰소진시각 = 사용자.토큰소진시각;
    저장필드.토큰락해제시각 = 사용자.토큰락해제시각;
    showToastMsg(UI_TEXT.토큰.소진안내 + ' — ' + UI_TEXT.토큰.락안내);
  } else {
    토큰경고_검사();
  }
  사용자데이터_저장(저장필드);
  토큰로그_기록(기능명, 양);
  토큰표시_갱신();
  return true;
}

// 잔량 경고 3단계 — 임계 통과 시 1회만 토스트 (KNOWLEDGE 32 경고 시스템)
function 토큰경고_검사(){
  const 잔량 = 사용자.보유토큰;
  let 단계 = 0;
  if(잔량 <= 375) 단계 = 3;
  else if(잔량 <= 750) 단계 = 2;
  else if(잔량 <= 1125) 단계 = 1;
  if(단계 > 토큰경고단계){
    토큰경고단계 = 단계;
    const 문구 = 단계===3 ? UI_TEXT.토큰.경고25 : 단계===2 ? UI_TEXT.토큰.경고50 : UI_TEXT.토큰.경고75;
    showToastMsg('💎 ' + 문구);
  } else if(단계 < 토큰경고단계){
    토큰경고단계 = 단계;  // 복구로 상향 시 경고 단계 되감기
  }
}

// 토큰 복구 (+30 복습 일3회 / +10 10연속 정답) — 상한 1,500, 락 중에는 무시
function 토큰복구(양, 사유){
  if(사용자.토큰락해제시각) return;
  const 이전 = 사용자.보유토큰 || 0;
  사용자.보유토큰 = Math.min(1500, 이전 + 양);
  if(사용자.보유토큰 === 이전) return;
  사용자데이터_저장({보유토큰: 사용자.보유토큰});
  토큰경고_검사();
  토큰표시_갱신();
  showToastMsg(`💎 +${양} 토큰 (${사유})`);
}

// 차감 내역 기록 — 세션 미러 + Firestore 토큰로그 서브컬렉션 (KNOWLEDGE 13-1)
function 토큰로그_기록(기능명, 차감량){
  const 항목 = {
    기능명: UI_TEXT.토큰.기능명[기능명] || 기능명,
    차감량, 잔여토큰: 사용자.보유토큰,
    일시: new Date()
  };
  토큰로그세션.unshift(항목);
  if(토큰로그세션.length > 5) 토큰로그세션.length = 5;
  if(fbDb && 현재UID){
    fbDb.collection('users').doc(현재UID).collection('토큰로그').add({
      기능명: 항목.기능명, 차감량, 잔여토큰: 사용자.보유토큰,
      일시: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(e=> console.error('[Firestore] 토큰로그 기록 실패', e));
  }
}

// 토큰 UI 일괄 갱신 — 학습 화면 5곳 토큰 바 + AI 챗 미니바 + 질문 패널 + 설정 행
function 토큰표시_갱신(){
  const 잔량 = 사용자.보유토큰 ?? 1500;
  const 잠금 = !!사용자.토큰락해제시각;
  const 포맷 = n => n.toLocaleString('ko-KR');
  let 라벨 = `${포맷(잔량)} / 1,500`;
  if(잠금){
    const 남은분 = Math.max(0, Math.ceil((new Date(사용자.토큰락해제시각).getTime() - Date.now())/60000));
    라벨 = `🔒 충전까지 ${Math.floor(남은분/60)}시간 ${남은분%60}분`;
  }
  document.querySelectorAll('.tkb').forEach(bar=>{
    bar.classList.toggle('tkb-lock', 잠금);
    const fill = bar.querySelector('.tkb-fill');
    if(fill){
      fill.style.width = (잠금 ? 0 : (잔량/1500*100)) + '%';
      fill.style.background = 토큰색상계산(잔량);
    }
    const val = bar.querySelector('.tkb-val');
    if(val) val.textContent = 라벨;
  });
  document.querySelectorAll('.ask-chat-now').forEach(el=> el.textContent = 포맷(잔량));
  const aq = document.getElementById('askQuotaNow'); if(aq) aq.textContent = 포맷(잔량);
  const st = document.getElementById('tokenSetTxt'); if(st) st.textContent = 잠금 ? 라벨 : `${포맷(잔량)} / 1,500`;
}

// 토큰 바 탭 → 최근 5개 차감 내역 드롭다운 (KNOWLEDGE 35)
function 토큰드롭다운_토글(bar){
  const drop = bar.querySelector('.tkb-drop');
  if(!drop) return;
  if(!bar.classList.contains('open')){
    if(토큰로그세션.length === 0){
      drop.innerHTML = `<b>${UI_TEXT.토큰.차감내역제목}</b><br>아직 차감 내역이 없습니다.`;
    } else {
      drop.innerHTML = `<b>${UI_TEXT.토큰.차감내역제목}</b><br>` + 토큰로그세션.map(l=>{
        const t = l.일시 instanceof Date ? l.일시.toTimeString().slice(0,5) : '';
        return `${l.기능명} | -${l.차감량} | 잔여 ${l.잔여토큰.toLocaleString('ko-KR')} | ${t}`;
      }).join('<br>');
    }
  }
  bar.classList.toggle('open');
}

// [? 차감 안내] 팝업 — 기능별 차감량 + 충전 방법 (KNOWLEDGE 35 차감 안내 팝업)
function 토큰차감안내_모달(){
  showInfoModal('💎','토큰 차감 안내',
    `<div style="text-align:left;font-size:12px;line-height:2">` +
    `문제 생성 <b>-15</b><br>` +
    `질문하기 <b>-20</b> (시작) · +15 / 4턴~<br>` +
    `사고전개 <b>-100</b> (시작) · +30 / 4턴~<br>` +
    `구어 교정 <b>-30</b><br>` +
    `유사 문제 <b>-20</b><br>` +
    `이의있음! <b>-70</b> (시작) · +30 / 턴~<br>` +
    `<hr style="border-color:var(--bdr);margin:8px 0">` +
    `충전: 2시간 대기 → 전량 (1,500)<br>` +
    `복습 1회 완료 → +30 (일 3회)<br>` +
    `10연속 정답 → +10 (무제한)` +
    `</div>`);
}

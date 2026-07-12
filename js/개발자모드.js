// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   빌드1: 개발자 모드 — 오버레이/실DB 분리 (KNOWLEDGE 14섹션 확정 구조)
   - 강제 조작값은 「개발자오버레이」 세션 객체에만 존재 (Firebase 미저장)
   - 실제 계정 DB(사용자·curLv·curExp)는 개발자 모드 중에도 정상 학습으로 계속 갱신됨
   - 화면 표시 = 오버레이 값 ?? 실제 값 (표시레벨/표시EXP/표시마스터리)
   - 봉인 = 오버레이 제거뿐 — 실DB는 그동안 쌓인 그대로 유지 (구 스냅샷 롤백 폐기)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let 개발자오버레이 = null;  // null = 비활성. {레벨, 현재EXP, 마스터리증분, 업적풀돌, 상한해제}

// 표시용 합성 값 — 오버레이 활성 시 오버레이 값 우선
function 표시레벨(){
  return (사용자.개발자모드 && 개발자오버레이 && 개발자오버레이.레벨 != null) ? 개발자오버레이.레벨 : curLv;
}
function 표시EXP(){
  const lv = 표시레벨();
  const v = (사용자.개발자모드 && 개발자오버레이 && 개발자오버레이.현재EXP != null) ? 개발자오버레이.현재EXP : curExp;
  return Math.min(v, expForLevel(lv));
}
function 표시마스터리(필드){
  const 실값 = 사용자[필드] || 0;
  return 실값 + ((사용자.개발자모드 && 개발자오버레이?.마스터리증분) || 0);
}

// 개발자 패널 — 오버레이 조작 컨트롤 (KNOWLEDGE 14 「수정 가능」 목록)
function 개발자패널_열기(){
  if(!개발자오버레이) 개발자오버레이 = {};
  const o = 개발자오버레이;
  showInfoModal('🔓','개발자 모드',
    `<div style="text-align:left;font-size:12px;line-height:2.1">` +
    `<b>오버레이 레이어</b> — 조작값은 화면에만 반영되고 실DB는 계속 실시간 기록됩니다.<br>` +
    `봉인 시 오버레이와 <b>[창조주] 업적</b>이 초기화됩니다 (학습 기록·EXP는 유지).<br>` +
    `<hr style="border-color:var(--bdr)">` +
    `레벨 (현재 표시 Lv.${표시레벨()} / 실제 Lv.${curLv}) — 확장 Lv.120까지<br>` +
    `<button class="btn-g" style="padding:5px 11px" onclick="개발자_레벨조정(-10)">-10</button> ` +
    `<button class="btn-g" style="padding:5px 11px" onclick="개발자_레벨조정(-1)">-1</button> ` +
    `<button class="btn-g" style="padding:5px 11px" onclick="개발자_레벨조정(1)">+1</button> ` +
    `<button class="btn-g" style="padding:5px 11px" onclick="개발자_레벨조정(10)">+10</button><br>` +
    `EXP (표시 ${표시EXP()}) <button class="btn-g" style="padding:5px 11px" onclick="개발자_EXP추가(500)">+500</button> ` +
    `마스터리 증분 (+${o.마스터리증분||0}) <button class="btn-g" style="padding:5px 11px" onclick="개발자_마스터리증분(10)">+10</button><br>` +
    `<button class="btn-g" style="padding:5px 11px" onclick="개발자_업적풀돌토글()">업적 풀돌 강제: ${o.업적풀돌?'ON':'OFF'}</button> ` +
    `<button class="btn-g" style="padding:5px 11px" onclick="개발자_상한해제토글()">상한 해제: ${o.상한해제?'ON':'OFF'}</button><br>` +
    `<button class="btn-g" style="padding:5px 11px" onclick="개발자_오버레이초기화()">오버레이 값 전체 초기화</button> ` +
    `<button class="btn-g" style="padding:5px 11px" onclick="개발자_네비토글()">상단 바로가기: ${사용자.개발자네비표시?'ON':'OFF'}</button><br>` +
    `<span style="color:var(--txt2);font-size:11px">※ 토큰은 개발자 모드 중 자동 무제한 (KNOWLEDGE 14)<br>` +
    `※ 오버레이 값은 새로고침 시 사라집니다(표시 전용 — 실제 달성 기록은 유지)</span>` +
    `</div>`);
  const btnArea = document.getElementById('infoBtns');
  if(btnArea){
    btnArea.innerHTML = `
      <button class="btn-g" style="flex:1" onclick="closeInfoModal()">닫기</button>
      <button class="btn-acc" style="flex:1.4;background:linear-gradient(135deg,#5030a0,#8060c0);border-color:#8060c0" onclick="개발자모드_봉인_실행()">🔒 봉인하기</button>
    `;
  }
}
function 개발자_화면갱신(){
  if(['sh','ss','sg','sa'].includes(curScreen)) afterNav(curScreen);
  개발자패널_열기();  // 패널 수치 갱신
}
function 개발자_레벨조정(d){
  const o = 개발자오버레이 || (개발자오버레이 = {});
  o.레벨 = Math.max(1, Math.min(120, (o.레벨 ?? curLv) + d));  // 확장 Lv.71~120 (KNOWLEDGE 14)
  개발자_화면갱신();
}
function 개발자_EXP추가(n){
  const o = 개발자오버레이 || (개발자오버레이 = {});
  o.현재EXP = (o.현재EXP ?? curExp) + n;
  개발자_화면갱신();
}
function 개발자_마스터리증분(n){
  const o = 개발자오버레이 || (개발자오버레이 = {});
  o.마스터리증분 = (o.마스터리증분 || 0) + n;
  개발자_화면갱신();
}
function 개발자_업적풀돌토글(){
  const o = 개발자오버레이 || (개발자오버레이 = {});
  o.업적풀돌 = !o.업적풀돌;
  개발자_화면갱신();
}
function 개발자_상한해제토글(){
  const o = 개발자오버레이 || (개발자오버레이 = {});
  o.상한해제 = !o.상한해제;
  개발자_화면갱신();
}
function 개발자_오버레이초기화(){
  개발자오버레이 = {};
  개발자_화면갱신();
  showToastMsg('오버레이 값이 초기화되었습니다 (실DB 무관)');
}

// 봉인 실행 — 오버레이 레이어만 제거. 실DB(레벨·EXP·기록)는 쌓인 그대로 유지 (KNOWLEDGE 14)
function 개발자모드_봉인_실행(){
  개발자오버레이 = null;
  사용자.개발자모드 = false;
  사용자.창조주달성 = false;  // 재활성화는 [창조주] 달성 흐름을 처음부터 (KNOWLEDGE 14)
  // 세션7 항목1: [창조주] 업적까지 완전 리셋 — 업적 화면은 업적진행도 기준이라 함께 지워야 잔존하지 않음
  if(사용자.업적진행도) delete 사용자.업적진행도['창조주'];
  ACH_DATA.forEach(sec=>{ sec.items.forEach(a=>{ if(a.key==='creator'){ a.stage='lck'; a.blur=true; } }); });
  // Firestore 업적로그의 '창조주' 문서도 삭제 (재도전 시 처음처럼)
  if(fbDb && 현재UID){
    fbDb.collection('users').doc(현재UID).collection('업적로그').where('업적명','==','창조주').get()
      .then(스냅=>스냅.docs.forEach(d=>d.ref.delete().catch(()=>{})))
      .catch(()=>{ /* 오프라인 등 — 다음 봉인 시 재시도 */ });
  }
  사용자데이터_저장({개발자모드:false, 창조주달성:false, 업적진행도:사용자.업적진행도||{}});
  갱신_개발자네비_표시();

  // 갱신
  갱신_설정_개발자모드_UI();
  if(curScreen === 'ss') afterNav('ss');  // 소칭호 색상·글리치 포함 재렌더
  if(curScreen === 'sh') afterNav('sh');  // 홈 EXP·레벨 갱신

  // 봉인 멘트 표시 (KNOWLEDGE 14섹션 「최상위 성위 [이름]이 봉인됩니다.」)
  closeInfoModal();
  setTimeout(()=>{
    showInfoModal('🔒','봉인 완료',
      `「최상위 성위 ${userName}이(가) 봉인됩니다.」<br><br>` +
      `오버레이 레이어와 [창조주] 업적이 초기화되었습니다.<br>` +
      `정당하게 얻은 학습 기록·EXP는 그대로 유지됩니다.<br><br>` +
      `재활성화하려면 [창조주] 달성 흐름을 처음부터 진행해야 합니다.`
    );
  }, 300);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   (구) 음성 입력 차단 — 항목8에서 정책 변경: 음성 입력을 허용한다.
   실제 음성 인식은 switchSpkMode/음성인식_토글(Web Speech API)에서 처리한다.
   아래 함수는 호출 위치 호환을 위해 남겨두되 동작은 비활성화한다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function 음성입력_차단_부착(){
  // 항목8: 음성 입력을 허용하도록 정책 변경 — 더 이상 텍스트 필드의 받아쓰기를 차단하지 않는다.
  //   (호출 위치는 그대로 두고 동작만 무력화. 이전 차단 로직은 git 이력에서 확인 가능)
}

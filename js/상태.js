// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   사용자 런타임 상태 객체 (KNOWLEDGE 13-1 루트 문서 미러)
   - 로그인 시 Firebase Auth/Firestore 값으로 덮어씀 (인증상태_변경 → 사용자데이터_적용)
   - 아래 값은 로그인 전 초기 placeholder. 실DB 로드 시 교체됨.
   - 변수명은 전부 한글 유지 (KNOWLEDGE 13·13-1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const 사용자 = {
  // 기본 정보 — 로그인 전 중립 기본값 (빌드1: 홍길동/Lv.15 데모 더미 제거)
  이름: '학습자',
  이메일: '',          // 버그7: 하드코딩 제거 — 로그인 시 Firebase Auth의 currentUser.email 주입
  프로필이미지: '⚔️',

  // 성장 데이터
  레벨: 1,
  현재EXP: 0,
  총누적EXP: 0,
  연속학습일: 0,
  총학습일: 0,
  마지막학습일: '',

  // 마스터리 카운터 (KNOWLEDGE 13섹션)
  상식어원학습수: 0,
  언어의뿌리학습수: 0,
  세계사신화학습수: 0,
  아재개그학습수: 0,
  맞춤법학습수: 0,
  구어교정횟수: 0,
  문해력학습수: 0,  // 세션10-c: 지문 독해
  이의제기횟수: 0,
  반박성공횟수: 0,
  퍼펙트세션수: 0,
  총누적어휘수: 0,

  // 토큰 (KNOWLEDGE 32 — 기본 1,500)
  보유토큰: 1500,
  토큰소진시각: null,
  토큰락해제시각: null,
  총소비토큰: 0,

  // 보관함 카운트 (renderReview가 복습데이터와 동기화)
  복습대기열수: 0,
  복습대기열상한: 50,
  즐겨찾기수: 0,
  휴지통수: 0,

  // 질문하기 (통계)
  오늘질문횟수: 0,
  질문날짜: '',

  // 업적/창조주
  업적진행도: {},
  창조주달성: false,
  개발자모드: false,
  선택칭호: '',   // 세션5: 창조주 칭호 선택(폐하/주신) — 초기값 명시
  AI지침: '',        // 세션6: AI 통합 지침 (500자)
  개발자네비표시: false,  // 세션6: 상단 개발자 바로가기 — 기본 숨김(패널 토글로만)
  배너이미지: '',    // 세션7: 현황 배너 (''=테마 그라디언트 기본)
  글자범위: '학습',  // 세션7: 글자 크기 적용 범위 (학습/전체)
};
/* 빌드1: 위 객체는 로그인 전 placeholder — 로그인 시 사용자데이터_적용()이 Firestore 값으로 덮어씀 */

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   보관함 데이터 — Firestore 서브컬렉션 미러 (KNOWLEDGE 13-1)
   - 로그인 시 보관함_로드()가 복습대기열·즐겨찾기·휴지통을 채움
   - 항목 id = Firestore 문서 ID (미로그인 시 '로컬N' 임시 ID, 세션 한정)
   - 모든 변경은 보관함_문서추가/삭제/수정으로 Firestore에 즉시 반영
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let 복습데이터 = {
  대기열: [],
  즐겨찾기: [],
  휴지통: []
};
let 복습데이터다음ID = 1;  // 미로그인 임시 ID 발급용

// 모드명 → 태그 색상 클래스 (Firestore에는 모드명만 저장 — KNOWLEDGE 13-1)
function 모드클래스계산(모드){
  if(!모드) return 'ta';
  if(모드.includes('맞춤법')) return 'tg';
  if(모드.includes('우리말')) return 'tp';
  return 'ta';
}

// 임시 ID 발급 (Firestore 미연결 상태 전용)
function 보관함_임시ID(){ return '로컬' + (복습데이터다음ID++); }

/* 세션5: 게스트(비로그인) 보관함 localStorage 폴백 — 새로고침 시 복습 데이터 전량 소실 방지 */
function 게스트보관함_저장(){
  if(현재UID) return;  // 로그인 상태에선 Firestore가 원본
  try{
    localStorage.setItem('plx_게스트보관함', JSON.stringify({
      대기열:복습데이터.대기열, 즐겨찾기:복습데이터.즐겨찾기, 휴지통:복습데이터.휴지통
    }));
  }catch(e){ /* localStorage 차단 환경 무시 */ }
}
function 게스트보관함_복원(){
  try{
    const d = JSON.parse(localStorage.getItem('plx_게스트보관함')||'null');
    if(d) ['대기열','즐겨찾기','휴지통'].forEach(k=>{ if(Array.isArray(d[k])) 복습데이터[k]=d[k]; });
  }catch(e){ /* 무시 */ }
}

// Firestore 서브컬렉션 문서 추가 — 성공 시 로컬 항목의 id를 문서 ID로 교체
// 세션5: 비로그인 시 localStorage 폴백 저장(게스트 데이터 소실 방지)
function 보관함_문서추가(컬렉션, 항목, 필드){
  if(!fbDb || !현재UID){ 게스트보관함_저장(); return; }
  fbDb.collection('users').doc(현재UID).collection(컬렉션).add({
    ...필드,
    추가일시: firebase.firestore.FieldValue.serverTimestamp()
  }).then(doc=>{ 항목.id = doc.id; })
    .catch(e=> console.error(`[Firestore] ${컬렉션} 추가 실패`, e));
}
function 보관함_문서삭제(컬렉션, id){
  if(!fbDb || !현재UID || String(id).startsWith('로컬')){ 게스트보관함_저장(); return; }
  fbDb.collection('users').doc(현재UID).collection(컬렉션).doc(id).delete()
    .catch(e=> console.error(`[Firestore] ${컬렉션} 삭제 실패`, e));
}
function 보관함_문서수정(컬렉션, id, 부분){
  if(!fbDb || !현재UID || String(id).startsWith('로컬')){ 게스트보관함_저장(); return; }
  fbDb.collection('users').doc(현재UID).collection(컬렉션).doc(id).set(부분, {merge:true})
    .catch(e=> console.error(`[Firestore] ${컬렉션} 수정 실패`, e));
}

// 로그인 후 보관함 전체 로드 + 휴지통 20일 만료분 자동 삭제 (KNOWLEDGE 8)
// 세션5: ①uid별 구어 교정 완료 기록 복원 ②로드 완료 전 학습으로 추가된 로컬 항목을 덮어쓰지 않고 병합
function 보관함_로드(){
  구어완료_복원();  // 세션5: EXP 재획득 방지 기록 (uid별)
  채팅기록_로드();  // 세션6: 채팅 기록 (uid별 서브컬렉션 / 게스트 localStorage)
  if(!fbDb || !현재UID) return;
  const ref = fbDb.collection('users').doc(현재UID);
  Promise.all([
    ref.collection('복습대기열').get(),
    ref.collection('즐겨찾기').get(),
    ref.collection('휴지통').get()
  ]).then(([큐, 즐, 휴])=>{
    const 시각 = v => (v && v.toDate) ? v.toDate().getTime() : 0;
    // 세션5: 서버 응답 대기 중 사용자가 학습해서 생긴 로컬 항목(id '로컬…') 보존
    const 로드전로컬 = 복습데이터.대기열.filter(x=>String(x.id).startsWith('로컬'));
    복습데이터.대기열 = 큐.docs.map(d=>{
      const v=d.data();
      return {id:d.id, 단어:v.단어, 뜻:v.뜻, 모드:v.모드, 모드클래스:모드클래스계산(v.모드),
              연속정답수:v.연속정답수||0, 즐겨찾기:false, 추가시각:시각(v.추가일시)};
    }).sort((a,b)=>a.추가시각-b.추가시각);  // 오래된 순 — 상한 초과 자동 이동 기준
    복습데이터.즐겨찾기 = 즐.docs.map(d=>{
      const v=d.data();
      return {id:d.id, 단어:v.단어, 뜻:v.뜻, 모드:v.모드, 모드클래스:모드클래스계산(v.모드)};
    });
    // 휴지통: 이동일시 + 20일 경과분은 Firestore에서도 제거 (들어온 순서대로 자동 삭제)
    const 지금 = Date.now();
    복습데이터.휴지통 = [];
    휴.docs.forEach(d=>{
      const v=d.data();
      const 이동 = 시각(v.이동일시 || v.추가일시);
      const 잔여일 = 이동 ? Math.max(0, 20 - Math.floor((지금-이동)/86400000)) : 20;
      if(이동 && 잔여일 <= 0){
        d.ref.delete().catch(()=>{});  // 20일 만료 — 영구 삭제
      } else {
        복습데이터.휴지통.push({id:d.id, 단어:v.단어, 뜻:v.뜻, 모드:v.모드,
                               모드클래스:모드클래스계산(v.모드), 잔여일});
      }
    });
    // 세션5: 로드 중 추가된 로컬 항목 병합 — 서버에 같은 단어가 없으면 메모리에 되살림
    // 세션6: 여기서 Firestore add를 재발사하지 않음 — 최초 추가 시 이미 add가 발사되어
    //        진행 중이므로, 재기록하면 문서가 중복 생성된다(중복 방지).
    로드전로컬.forEach(x=>{
      if(!복습데이터.대기열.some(y=>y.단어===x.단어)) 복습데이터.대기열.push(x);
    });
    // 세션6: 게스트 시절 보관함(plx_게스트보관함) 승계 — 서버에 없는 단어만 추가 후 정리
    try{
      const 게스트 = JSON.parse(localStorage.getItem('plx_게스트보관함')||'null');
      if(게스트 && Array.isArray(게스트.대기열)){
        게스트.대기열.forEach(x=>{
          if(x && x.단어 && !복습데이터.대기열.some(y=>y.단어===x.단어)){
            복습데이터.대기열.push(x);
            보관함_문서추가('복습대기열', x, {단어:x.단어, 뜻:x.뜻, 모드:x.모드, 연속정답수:x.연속정답수||0});
          }
        });
        localStorage.removeItem('plx_게스트보관함');
        console.log('[보관함] 게스트 데이터 승계 완료');
      }
    }catch(e){ /* 무시 */ }
    // 대기열 항목의 즐겨찾기 별 표시 동기화 (동일 단어 기준)
    const 즐단어 = new Set(복습데이터.즐겨찾기.map(x=>x.단어));
    복습데이터.대기열.forEach(x=>{ x.즐겨찾기 = 즐단어.has(x.단어); });
    if(curScreen==='sr') renderReview();
    console.log(`[보관함] 로드 — 대기열 ${복습데이터.대기열.length} · 즐겨찾기 ${복습데이터.즐겨찾기.length} · 휴지통 ${복습데이터.휴지통.length}`);
  }).catch(e=> console.error('[Firestore] 보관함 로드 실패', e));
}

// 학습 흐름 → 대기열 추가 (오답·몰랐다·헷갈린다 시) — 상한 초과 시 가장 오래된 항목 휴지통 이동 (KNOWLEDGE 7)
function 복습대기열_추가(단어, 뜻, 모드){
  if(!단어) return;
  // 이미 대기열에 있으면 연속정답수만 초기화 (몰랐다 규칙)
  const 기존 = 복습데이터.대기열.find(x=>x.단어===단어);
  if(기존){
    if(기존.연속정답수 !== 0){
      기존.연속정답수 = 0;
      보관함_문서수정('복습대기열', 기존.id, {연속정답수:0});
    }
    return;
  }
  // 상한 초과 → 가장 오래된 항목(즐겨찾기 제외 — KNOWLEDGE 9) 휴지통 자동 이동
  const 상한 = 개발자오버레이?.상한해제 ? Infinity : 사용자.복습대기열상한;
  while(복습데이터.대기열.length >= 상한){
    const 오래된idx = 복습데이터.대기열.findIndex(x=>!x.즐겨찾기);
    if(오래된idx < 0) break;  // 전부 즐겨찾기면 이동 불가
    const 옮김 = 복습데이터.대기열.splice(오래된idx,1)[0];
    보관함_문서삭제('복습대기열', 옮김.id);
    const 휴항목 = {id:보관함_임시ID(), 단어:옮김.단어, 뜻:옮김.뜻, 모드:옮김.모드, 모드클래스:옮김.모드클래스, 잔여일:20};
    복습데이터.휴지통.push(휴항목);
    보관함_문서추가('휴지통', 휴항목, {단어:옮김.단어, 뜻:옮김.뜻, 모드:옮김.모드,
      이동일시: firebase?.firestore ? firebase.firestore.FieldValue.serverTimestamp() : null});
    showToastMsg('📥 대기열 초과 — 가장 오래된 항목이 휴지통으로 이동');
  }
  const 항목 = {id:보관함_임시ID(), 단어, 뜻, 모드, 모드클래스:모드클래스계산(모드), 연속정답수:0, 즐겨찾기:false, 추가시각:Date.now()};
  복습데이터.대기열.push(항목);
  보관함_문서추가('복습대기열', 항목, {단어, 뜻, 모드, 연속정답수:0});
  // 상한 5개 이내 경고 알람 (KNOWLEDGE 7)
  const 남은자리 = 사용자.복습대기열상한 - 복습데이터.대기열.length;
  if(남은자리 >= 0 && 남은자리 <= 5 && (사용자.알림설정 ?? true)){
    showToastMsg(`⚠️ 복습 대기열 자리가 ${남은자리}개 남았습니다`);
  }
  if(curScreen==='sr') renderReview();
}

/// 학습 흐름 → 정답 처리: 대기열에 있으면 정답 1회로 즉시 졸업(영구 삭제)
// 세션7 항목5: 최고 관리자님 지시 — 졸업 기준 3연속 → 1회로 완화
function 복습대기열_정답처리(단어){
  const idx = 복습데이터.대기열.findIndex(x=>x.단어===단어);
  if(idx < 0) return;
  const 항목 = 복습데이터.대기열[idx];
  항목.연속정답수++;
  if(항목.연속정답수 >= 1){
    복습데이터.대기열.splice(idx,1);
    보관함_문서삭제('복습대기열', 항목.id);
    showToastMsg(`🎓 「${항목.단어}」 복습 졸업!`);
  } else {
    보관함_문서수정('복습대기열', 항목.id, {연속정답수:항목.연속정답수});
  }
  if(curScreen==='sr') renderReview();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   상태 변수
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let curScreen='sl';
let userName=사용자.이름;
let curExp=사용자.현재EXP, curLv=사용자.레벨;
let curTheme='antique';
// 버그D 수정: 'gowun'은 FONTS 배열에 없는 유령 키였음 → 기본 글꼴(나눔스퀘어 Neo) 실제 키로 교정 (KNOWLEDGE 8·19)
let curFont='nanum_square';

// 레벨업 공식: 110 + (레벨-1) × 28
// α3: 하급신 구간(Lv.36~46)은 ×1.123 적용 — 성장 정체 의도 (KNOWLEDGE 11)
// α2: Lv.70 하드 캡 (개발자 모드 Lv.120 확장은 오버레이 구현 단계에서)
// 세션10: "레벨업이 너무 빠르다" 피드백 → 전체 요구량 ×1.45 디버프 (체감 40~50% 느리게, KNOWLEDGE 11)
const 최대레벨 = 70;
function expForLevel(lv){
  const 기본 = Math.round((110 + (lv-1)*28) * 1.45);
  return (lv>=36 && lv<=46) ? Math.round(기본*1.123) : 기본;
}
let maxExp=expForLevel(curLv);

// 등급 계산 (레벨로부터 자동 산출) — α13: Lv.70까지 확장 (KNOWLEDGE 11 등급 체계)
function 등급정보(lv){
  if(lv>=70) return {등급:'강림자', 세부:'강림자'};
  if(lv>=65) return {등급:'도래자', 세부:'응시자'};
  if(lv>=60) return {등급:'도래자', 세부:'도래자'};
  if(lv>=55) return {등급:'현자', 세부:'사유자'};
  if(lv>=50) return {등급:'현자', 세부:'마에스트로'};
  if(lv>=45) return {등급:'통찰가', 세부:'통달자'};
  if(lv>=40) return {등급:'통찰가', 세부:'철학가'};
  if(lv>=30) return {등급:'통찰가', 세부:'탐험가'};
  if(lv>=25) return {등급:'논객', 세부:'전략가'};
  if(lv>=20) return {등급:'논객', 세부:'분석가'};
  if(lv>=15) return {등급:'문장가', 세부:'표현가'};
  if(lv>=10) return {등급:'문장가', 세부:'조율사'};
  if(lv>=5) return {등급:'견습생', 세부:'길드는 자'};
  return {등급:'견습생', 세부:'새싹'};
}

// 소칭호 계산 (현황 탭 전용)
// α1: KNOWLEDGE 11섹션 7단계 확정표로 교체 (구 3단계 '성위' 폐기)
// α5: 창조주 달성 시 선택 칭호 반환 — 기본 「폐하」, 글리치 없는 깨끗한 「주신」 전환 가능
function 소칭호계산(lv, 창조주달성){
  if(창조주달성) return 사용자.선택칭호 || '폐하';
  if(lv>=69) return '주҉신҉';
  if(lv>=58) return '최고신';
  if(lv>=47) return '중급신';
  if(lv>=36) return '하급신';
  if(lv>=26) return '시련';
  if(lv>=16) return '초월자';
  return '필멸자';
}

// α7: 소칭호 7단계 색상표 (KNOWLEDGE 11 — 기본 10팔레트 회피색)
// 주҉신҉은 색상 대신 CSS 무지개 글리치 클래스(.sub-jushin)로 처리
// 세션5 버그4: 어두운 테마 배경에 묻히던 저명도 색(시련·최고신 등) 명도 상향 — 계열 색감은 유지
const 소칭호색상표 = {
  '필멸자':'#b4b4c4', '초월자':'#58dcc2', '시련':'#e06080', '하급신':'#cdcde0',
  '중급신':'#e3c455', '최고신':'#c078d8', '폐하':'#ffd700', '주신':'#ffd700'
};

// 소칭호를 화면 요소에 적용 — 텍스트 + 색상 + 주신 글리치 (α7·α8)
function 소칭호적용(el, lv, 창조주달성){
  if(!el) return;
  const 칭호 = 소칭호계산(lv, 창조주달성);
  el.textContent = '(' + 칭호 + ')';
  el.classList.toggle('sub-jushin', 칭호==='주҉신҉');
  el.classList.toggle('creator', !!창조주달성);
  el.style.color = (칭호==='주҉신҉') ? '' : (소칭호색상표[칭호] || '');
}

// 설정
let histFilter='off'; // off / 30 / 50 / 80 / 100 / 120
let aiOnly=false;

// 온보딩
// v3.6: KNOWLEDGE 23섹션 4장 확정 일치 (구 5장에서 '레벨업' 슬라이드 삭제)
let obIdx=0;
const OB_TOTAL=4;

// 명언 풀
// v3.7 항목11: 「오늘 한 문장」 슬라이드 배너 데이터 (KNOWLEDGE 24섹션)
// 문장 안에 학습 단어가 자연스럽게 녹아있는 구조. 단어 탭 → 해당 플래시카드로 이동.
// {t: 본문(단어를 [필연] 형태로 표시), a: 출처, words: 추출된 단어 매핑}
// β8: 실데이터는 data/정령왕_통합_v2.json의 오늘의_한문장 7건을 fetch하여 사용 (KNOWLEDGE 24)
//     아래 배열은 fetch 실패 시(오프라인·file:// 직접 실행)에만 쓰이는 폴백이다.
const QUOTES=[
  {t:'"우리는 우리가 반복하는 행위로 만들어진다. 그러므로 [탁월함]이란 행위가 아니라 [습관]이다."', a:'— 아리스토텔레스'},
  {t:'"[언어]의 한계는 곧 내 [세계]의 한계이다."', a:'— 비트겐슈타인'},
  {t:'"[운명]의 별이 이어준 우리의 우연 같은 [필연]"', a:'— 작자 미상'},
  {t:'"[독서]는 충실한 사람을 만들고, [글쓰기]는 정확한 사람을 만든다."', a:'— 프랜시스 베이컨'},
  {t:'"우리가 사용하는 [언어]가 우리가 누구인지를 결정한다."', a:'— 토니 모리슨'},
  {t:'"[문자]는 인간 정신의 거울이다."', a:'— 라이프니츠'},
];
// β8: 한문장 출제 풀 — 예문데이터_로드() 성공 시 정령왕 JSON 7건으로 교체됨
let 한문장풀 = QUOTES;

// v3.7 항목7: 이름 미입력 시 기본값 풀 (KNOWLEDGE 27섹션)
// 빈 입력으로 학습 시작 누르면 풀에서 랜덤 1개 선택
const 기본이름풀=[
  '이름은 나중에','그냥 지나가는 학습자','아무거나요','미확정',
  '학습 중인 그 누군가','null','undefined','noname','N/A'
];
// 희귀 닉네임 풀 보류 — 코드에 주석 보존 (KNOWLEDGE 27섹션)
// 웹툰 캐릭터 이름 기반 아이디어. 추후 결정.
// 예: '한로아의 그림자','시이나의 메아리','김정구의 잔향' 등

// 폰트 확정 10종 (KNOWLEDGE 19섹션)
// 버그A 수정: v3.8 눈누 CDN 전환 반영. 하단 6종은 base64 임베딩이 아니라 style.css의 눈누 @font-face CDN이다 (재구조화로 분리).
//   - family명을 @font-face/KNOWLEDGE 19와 일치시키고, 출처 표기를 '임베딩' → '눈누 CDN'으로 정정.
//   - mona: KNOWLEDGE 19 기준 family명은 'Mona'. CDN 직접 검증 불가하여 'Mona-Sans' 폴백을 함께 둠.
//   - weight: 단일 굵기로 배포된 폰트(평창평화체 Light=300)의 미리보기 굵기 지정용 (버그B 연동).
const FONTS=[
  // ━━━ CDN 4종 ━━━
  {key:'nanum_gothic',   name:'나눔고딕',          css:"'NanumGothic',sans-serif",             sample:'한국어 어휘력과 표현력을', src:'CDN · jsDelivr · OFL', credit:'OFL'},
  {key:'nanum_myeongjo', name:'나눔명조',          css:"'NanumMyeongjo',serif",                sample:'한국어 어휘력과 표현력을', src:'CDN · jsDelivr · OFL', credit:'OFL'},
  {key:'nanum_square',   name:'나눔스퀘어 Neo',    css:"'NanumSquareNeoVariable',sans-serif",  sample:'한국어 어휘력과 표현력을', src:'CDN · jsDelivr · OFL', credit:'OFL'},
  // 모나 family명 실측 확정 (세션 2 — CDN 검증 완료): mona.css에는 'Mona'·'Mona-Sans'가 존재하지 않음.
  // 실제 제공 family는 Mona10/Mona12/'Mona12 Text KR' 등이며, 한글은 'Mona12 Text KR'가 담당.
  // 라틴은 Mona12 → 한글 글리프는 Mona12 Text KR로 글자 단위 폴백되는 스택으로 교정.
  {key:'mona',           name:'모나 (Mona)',        css:"'Mona12','Mona12 Text KR',sans-serif",  sample:'Language & 언어 1234', src:'CDN · jsDelivr · 한글 지원 커스텀(MonadABXY)', credit:'OFL'},
  // ━━━ 눈누 CDN 6종 (style.css @font-face) ━━━
  // 항목2: 사용자 노출 출처에서 '상업 사용 가능' 등 상업적 이용 문구 제거 (라이선스 관리는 내부 주석/문서로)
  {key:'asummer',        name:'Asummerflowertree', css:"'EarlySummerFloweringTreeV20JangHyeri',sans-serif",       sample:'한국어 어휘력과 표현력을', src:'눈누 CDN · 스스로넷', credit:'스스로넷'},
  {key:'round',          name:'라운드앤라운드',    css:"'RoundedKimGyuri',sans-serif",           sample:'한국어 어휘력과 표현력을', src:'눈누 CDN · 스스로넷', credit:'스스로넷'},
  {key:'taebaek',        name:'태백체',            css:"'TaebaekMilkyWay',sans-serif",                 sample:'한국어 어휘력과 표현력을', src:'눈누 CDN · 태백시 · 공공누리 1유형', credit:'공공누리 1유형'},
  {key:'leeseoyun',      name:'이서윤체',          css:"'IsYun',sans-serif",               sample:'한국어 어휘력과 표현력을', src:'눈누 CDN · 흥국생명', credit:'흥국생명'},
  {key:'songam',         name:'송암 이형식',       css:"'SongamLeeHyeongSik',serif",            sample:'한국어 어휘력과 표현력을', src:'눈누 CDN · 공유마당 · 공공누리', credit:'공공누리'},
  {key:'pyeongchang',    name:'평창평화체 Light',  css:"'PyeongchangPeace',sans-serif",   weight:300, sample:'한국어 어휘력과 표현력을', src:'눈누 CDN · 평창군 · 공공누리', credit:'공공누리'},
];

// v3.7 항목4: 유의어 변별 데이터 (KNOWLEDGE 3-2섹션, 3단계 구조)
// correct(정답/초록) / acceptable(근사 정답/노랑) / wrong(오답/빨강)
// β8: 실데이터는 data/정령왕_통합_v2.json의 유의어_변별 18건 — 아래 2건은 fetch 실패 시 폴백
const 유의어변별데이터=[
  {
    예문: '그 일은 일어날 수밖에 없는 [   ]이었다.',
    correct:    {w:'필연', def:'반드시 일어날 수밖에 없는 일'},
    acceptable: [
      {w:'숙명', def:'태어날 때부터 정해진 운명', reason:'의미가 겹치지만 「운명적 색채」가 강하여 맥락에 따라 덜 정확함'}
    ],
    wrong: [
      {w:'우연', def:'뜻하지 않게 어쩌다가 일어남'},
      {w:'추측', def:'미루어 짐작함'}
    ]
  },
  {
    예문: '그 시절을 [   ]하며 미소 지었다.',
    correct:    {w:'회상', def:'지나간 일을 돌이켜 생각함'},
    acceptable: [
      {w:'추억', def:'지나간 일을 돌이켜 생각함, 또는 그런 생각', reason:'명사적 의미는 동일하나 동작 동사로 자연스럽지 못함'}
    ],
    wrong: [
      {w:'예상', def:'어떤 일이 있기 전에 미리 생각함'},
      {w:'환상', def:'현실에 없는 것을 있는 것처럼 느끼는 인식'}
    ]
  }
];
// β8: 유의어 출제 풀 — 예문데이터_로드() 성공 시 정령왕 JSON 18건으로 교체됨
let 유의어출제풀 = 유의어변별데이터;

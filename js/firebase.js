// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Firebase — 구글 로그인 + Firestore 사용자 데이터 동기화
   (KNOWLEDGE 13·13-1·28) · Compat SDK(전역 firebase 객체)
   - 미설정/오프라인 시: 콘솔 에러만 출력, 별도 폴백 없음 (지시 사항)
   - 필드명·변수명 전부 한글 유지 (KNOWLEDGE 13)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// Firebase 프로젝트 설정 (콘솔 제공값). apiKey는 Firebase 웹 클라이언트 식별자로 공개 전제 — 보안은 Firestore 규칙·승인 도메인으로 제어.
const firebaseConfig = {
  apiKey: "AIzaSyCXJoknAhLI8gGJs8o0R5B8rdQCLENlz8Q",
  authDomain: "llove-djsdj.firebaseapp.com",
  projectId: "llove-djsdj",
  storageBucket: "llove-djsdj.firebasestorage.app",
  messagingSenderId: "395917310027",
  appId: "1:395917310027:web:4f28f55c3d52084c19b5ce",
  measurementId: "G-7W3G1T7ZY2"
};

let fbApp = null, fbAuth = null, fbDb = null;
let 현재UID = null;

function Firebase초기화(){
  try{
    if(typeof firebase === 'undefined'){
      console.error('[Firebase] SDK가 로드되지 않았습니다.');
      return;
    }
    if(!firebaseConfig.apiKey){
      console.error('[Firebase] config 미설정 — 구글 로그인/동기화 비활성. firebaseConfig 값을 입력하세요.');
      return;
    }
    fbApp  = firebase.initializeApp(firebaseConfig);
    fbAuth = firebase.auth();
    fbDb   = firebase.firestore();
    // 로그인 상태 변화 감지 (재방문 시 자동 로그인 포함)
    fbAuth.onAuthStateChanged(인증상태_변경);
  }catch(e){
    console.error('[Firebase] 초기화 실패', e);
  }
}

// 로그인 화면 「Google 계정으로 시작하기」 — 구글 로그인 강제화 (KNOWLEDGE 28)
function 구글로그인(){
  if(!fbAuth){
    console.error('[Firebase] auth 미초기화 — 로그인 불가');
    showToastMsg('로그인 모듈이 초기화되지 않았습니다');
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  fbAuth.signInWithPopup(provider).catch(e=>{
    console.error('[Firebase] 구글 로그인 실패', e);
    // 팝업이 테두리만 뜨고 닫히는 대표 원인 = 승인 도메인 미등록. 사용자에게 원인을 표면화.
    let 안내;
    switch(e && e.code){
      case 'auth/unauthorized-domain':
        안내 = '이 도메인이 Firebase 승인 목록에 없어 로그인 창이 닫혔습니다. (콘솔 → Authentication → 승인된 도메인에 현재 주소 추가 필요)';
        break;
      case 'auth/popup-blocked':
        안내 = '브라우저가 팝업을 차단했습니다. 팝업 허용 후 다시 시도해 주세요.';
        break;
      case 'auth/popup-closed-by-user':
        안내 = '로그인 창이 닫혔습니다. 다시 시도해 주세요.';
        break;
      case 'auth/operation-not-allowed':
        안내 = 'Firebase 콘솔에서 Google 로그인 제공업체가 비활성 상태입니다.';
        break;
      default:
        안내 = '구글 로그인 실패: ' + ((e && e.code) || (e && e.message) || '알 수 없는 오류');
    }
    showToastMsg(안내);
  });
}

// 로그아웃 (설정 화면)
function 로그아웃(){
  showConfirmModal('🚪','로그아웃','정말 로그아웃 하시겠습니까?','로그아웃', 로그아웃실행);
}
function 로그아웃실행(){
  if(!fbAuth){ console.error('[Firebase] auth 미초기화'); return; }
  fbAuth.signOut().then(()=>{
    현재UID = null;
    goNav('sl', null);
    showToastMsg('로그아웃되었습니다');
  }).catch(e=> console.error('[Firebase] 로그아웃 실패', e));
}

// 인증 상태 변경 — 로그인 성공 시 Firestore 사용자 문서 로드(기존) 또는 이름 입력(신규)
function 인증상태_변경(user){
  if(!user){ 현재UID = null; return; }
  현재UID = user.uid;
  사용자.이메일 = user.email || '';
  if(!fbDb){ console.error('[Firestore] db 미초기화'); return; }
  fbDb.collection('users').doc(user.uid).get().then(snap=>{
    if(snap.exists){
      사용자데이터_적용(snap.data(), user);
      document.getElementById('onboarding')?.classList.add('gone'); // 자동 로그인 시 온보딩 건너뜀
      goNav('sh', null);
    } else {
      // 신규 사용자: 이름 입력 화면
      사용자.프로필이미지 = 사용자.프로필이미지 || '⚔️';
      goNav('sn', null);
    }
  }).catch(e=> console.error('[Firestore] 사용자 문서 로드 실패', e));
}

// Firestore 루트 문서 → 사용자 런타임 객체 + 상태 변수 반영 (KNOWLEDGE 13-1)
function 사용자데이터_적용(data, authUser){
  Object.assign(사용자, data);
  사용자.이메일 = (authUser && authUser.email) || data.이메일 || '';
  userName = 사용자.이름 || userName;
  curLv  = 사용자.레벨    ?? curLv;
  curExp = 사용자.현재EXP ?? curExp;
  maxExp = expForLevel(curLv);
  // 빌드1: 설정 데이터 복원 — Firestore 값 우선 (KNOWLEDGE 13-1 설정 데이터)
  // 항목3: Firestore 커스텀 색·슬롯 복원 (테마 적용 전에 변수 세팅)
  if(data.커스텀슬롯 && Array.isArray(data.커스텀슬롯)) 커스텀슬롯 = data.커스텀슬롯.filter(Boolean).slice(0,10);
  if(data.커스텀테마) 커스텀_복원(data.커스텀테마);
  if(data.테마) setTheme(data.테마, true);
  // 세션5: Firestore 화면 크기 복원 / 세션10-g 항목1: 저장된 값이 없으면(=아직 설정을 만진 적 없음)
  // 설정 화면의 기본 선택칩·문구는 "100%"로 그대로 두고, 실제 zoom만 조용히 0.9로 적용한다.
  // setFontScale()을 그대로 쓰면 칩·문구도 "90%"로 바뀌어버려 표기가 달라지므로 여기선 zoom만 직접 설정.
  if(data.화면배율) setFontScale(data.화면배율, true);
  else document.documentElement.style.zoom = '0.9';
  if(data.글자배율) set글자크기(data.글자배율, true);   // 세션5: Firestore 글자 크기 복원(텍스트 전용)
  if(data.폰트) applyFont(data.폰트, true);
  // 추가기능: 음성 생성 서버 주소 복원 (창조주 전용, 코드 비저장)
  if(typeof data.음성엔드포인트 === 'string') 음성엔드포인트 = data.음성엔드포인트;
  // 세션6: AI 지침·개발자 네비 표시 복원
  if(typeof data.AI지침 === 'string'){ 사용자.AI지침 = data.AI지침; AI지침_상태갱신(); }
  if(typeof data.개발자네비표시 === 'boolean') 사용자.개발자네비표시 = data.개발자네비표시;
  // 세션7: 글자범위·랜덤설정 복원 (배너이미지는 현황 진입 시 렌더)
  if(data.글자범위) set글자범위(data.글자범위, true);
  if(data.랜덤설정 && data.랜덤설정.가중치) 랜덤설정 = data.랜덤설정;
  if(data.히스토리필터){
    histFilter = data.히스토리필터;
    const t=document.getElementById('histFilterTxt');
    if(t) t.textContent = (histFilter==='off') ? '사용 안함' : `최근 ${histFilter}개`;
  }
  if(typeof data.AI문제만 === 'boolean'){
    aiOnly = data.AI문제만;
    const tg=document.getElementById('aiOnlyToggle'); if(tg) tg.checked=aiOnly;
    const tx=document.getElementById('aiOnlyTxt');   if(tx) tx.textContent=aiOnly?'켜짐':'꺼짐';
  }
  if(data.복습상한) 사용자.복습대기열상한 = data.복습상한;
  // 빌드1: 토큰 락 만료 검사 + 토큰 UI·개발자 네비 갱신
  토큰락_체크();
  토큰표시_갱신();
  갱신_개발자네비_표시();
  보관함_로드();   // 복습대기열·즐겨찾기·휴지통 서브컬렉션 로드 (KNOWLEDGE 13-1)
  업적_검사();     // 로드된 카운터 기준 업적 단계 정합화
}

// 신규 사용자 Firestore 루트 문서 생성 (KNOWLEDGE 13-1 기본값, 전부 한글 필드명)
function 신규사용자_생성(){
  if(!fbDb || !현재UID){
    console.error('[Firestore] 미초기화 — 신규 사용자 저장 생략');
    return Promise.resolve();
  }
  const authUser = fbAuth && fbAuth.currentUser;
  사용자.이메일 = (authUser && authUser.email) || '';
  const 신규데이터 = {
    // 기본 정보
    이름: 사용자.이름,
    이메일: 사용자.이메일,
    프로필이미지: 사용자.프로필이미지 || '⚔️',
    가입일: firebase.firestore.FieldValue.serverTimestamp(),
    // 성장 데이터
    레벨: 1, 현재EXP: 0, 총누적EXP: 0,
    연속학습일: 0, 총학습일: 0, 마지막학습일: '',
    // 마스터리 (KNOWLEDGE 13)
    상식어원학습수: 0, 언어의뿌리학습수: 0, 세계사신화학습수: 0,
    아재개그학습수: 0, 맞춤법학습수: 0, 구어교정횟수: 0, 문해력학습수: 0,
    이의제기횟수: 0, 반박성공횟수: 0, 퍼펙트세션수: 0, 총누적어휘수: 0,
    // 토큰 (KNOWLEDGE 32, 기본 1500)
    보유토큰: 1500, 토큰소진시각: null, 토큰락해제시각: null, 총소비토큰: 0,
    // 설정
    테마: 'antique', 폰트: 'nanum_square',
    // 세션10-g 항목1: 화면배율은 신규 사용자도 저장하지 않음(미저장 = 기본칩 100% 유지 + 실제는 0.9 조용히 적용)
    히스토리필터: 'off', AI문제만: false, 복습상한: 50, 알림설정: true,
    음성엔드포인트: '',   // 추가기능: 음성 생성 서버 주소(창조주가 입력) — 기본 빈 값
    // 업적
    업적진행도: {}, 창조주달성: false, 개발자모드: false, 선택칭호: '',
    // 세션6: AI 지침·개발자 네비 표시
    AI지침: '', 개발자네비표시: false,
    // 세션7: 배너·글자범위·랜덤 설정
    배너이미지: '', 글자범위: '학습', 랜덤설정: {가중치:{}},
    // 질문하기 (통계)
    오늘질문횟수: 0, 질문날짜: ''
  };
  Object.assign(사용자, 신규데이터);
  curLv = 1; curExp = 0; maxExp = expForLevel(1);
  return fbDb.collection('users').doc(현재UID).set(신규데이터, {merge:true})
    .catch(e=> console.error('[Firestore] 신규 사용자 저장 실패', e));
}

// 사용자 루트 문서 부분 동기화 저장 (변경된 필드만 merge)
function 사용자데이터_저장(부분){
  if(!fbDb || !현재UID){
    console.error('[Firestore] 미초기화 — 저장 생략');
    return Promise.resolve();
  }
  return fbDb.collection('users').doc(현재UID).set(부분, {merge:true})
    .catch(e=> console.error('[Firestore] 사용자 저장 실패', e));
}

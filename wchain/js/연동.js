// '잇는' — Llove 연동 (Phase 4: 게임 데이터 삭제 → 잇는개방 재잠금 / Phase 6: 음성엔드포인트 읽기)
// Llove와 같은 Firebase 프로젝트·같은 도메인이라 로그인 세션이 자동 공유된다(별도 로그인 불필요,
// firebase.auth()가 이미 인증된 세션을 그대로 이어받음 — Phase 1 계획의 "로그인 자동 공유").
// 원본 파이썬 게임엔 없는 웹 전용 기능(계획서 "재잠금" 항목) — 클래식 스크립트, 가장 마지막 로드.

const firebaseConfig = {
  apiKey: "AIzaSyCXJoknAhLI8gGJs8o0R5B8rdQCLENlz8Q",
  authDomain: "llove-djsdj.firebaseapp.com",
  projectId: "llove-djsdj",
  storageBucket: "llove-djsdj.firebasestorage.app",
  messagingSenderId: "395917310027",
  appId: "1:395917310027:web:4f28f55c3d52084c19b5ce",
  measurementId: "G-7W3G1T7ZY2"
};

let fbAuth = null, fbDb = null;

(function 연동_초기화(){
  try{
    if(typeof firebase === 'undefined'){ console.warn('[연동] Firebase SDK 미로드'); return; }
    firebase.initializeApp(firebaseConfig);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    // 로그인 상태만 읽는다 — wchain은 Llove처럼 사용자 데이터 전체를 동기화하지 않고,
    // "게임 데이터 삭제" 시 현재 로그인된 사용자 문서의 잇는개방 필드만 되돌린다.
    // 예외: 음성엔드포인트는 Llove 설정 패널에서 이미 관리자님이 입력·저장해 둔 같은 문서의
    // 필드를 읽기 전용으로 재사용한다(중복 설정 UI를 wchain에 새로 만들지 않기 위함 — Phase 6).
    // js/음성.js의 음성생성_활성화가 false인 동안은 이 값이 채워져도 실제 호출로 이어지지 않는다.
    fbAuth.onAuthStateChanged(user => {
      if(!user) return;
      fbDb.collection('users').doc(user.uid).get().then(doc => {
        const data = doc.data();
        if(data && typeof data.음성엔드포인트 === 'string') 음성엔드포인트 = data.음성엔드포인트;
      }).catch(e => console.warn('[연동] 음성엔드포인트 읽기 실패', e));
    });
  }catch(e){ console.warn('[연동] 초기화 실패(오프라인 등) — 삭제 시 로컬 초기화만 진행', e); }
})();

/* ── 게임 데이터 삭제 2중 확인 (원본에 없는 웹 전용 기능) ── */
function 게임데이터_확인모달(제목, 설명, 버튼문구, onConfirm){
  document.getElementById('삭제확인아이콘제목').textContent = 제목;
  document.getElementById('삭제확인설명').innerHTML = 설명;
  const btn = document.getElementById('삭제확인버튼');
  btn.textContent = 버튼문구;
  btn.onclick = () => { 게임데이터삭제_닫기(); setTimeout(onConfirm, 240); };
  document.getElementById('삭제확인Bg').classList.add('show');
}
function 게임데이터삭제_닫기(){ document.getElementById('삭제확인Bg').classList.remove('show'); }

function 게임데이터삭제_1단계(){
  게임데이터_확인모달('⚠️ 게임 데이터 삭제 (1/2)',
    '이 세계로 통하는 문(포탈)이 다시 잠기고, 학습 세계에서 \'잇\' 퍼즐을 처음부터 다시 풀어야 합니다.<br><br>계속하시겠습니까?',
    '계속', 게임데이터삭제_2단계);
}
function 게임데이터삭제_2단계(){
  게임데이터_확인모달('🗑️ 게임 데이터 삭제 (2/2)',
    '<b>마지막 확인</b>입니다. 정말로 삭제하시겠습니까?<br><br>이 작업은 되돌릴 수 없습니다.',
    '영구 삭제', 게임데이터삭제_실행);
}
function 게임데이터삭제_실행(){
  // 로컬 게임 상태 초기화 (God Mode·페르소나까지 전부 — Llove full_reset과 동일하게 전면 초기화)
  게임_세대올리기();   // 진행 중이던 턴의 비동기 결과가 초기화 뒤에 되살아나지 않게(서바이벌.js)
  gs.god_mode_active = false;
  full_reset(gs);

  const 학습세계로 = () => { location.href = '../Llove/'; };

  if(fbAuth && fbAuth.currentUser && fbDb){
    fbDb.collection('users').doc(fbAuth.currentUser.uid).update({ 잇는개방: false })
      .then(학습세계로)
      .catch(e => { console.error('[연동] 잇는개방 재잠금 실패', e); 학습세계로(); });
  } else {
    // 비로그인(게스트)이면 Firestore에 애초에 저장된 상태가 없으므로 로컬 초기화만으로 충분
    학습세계로();
  }
}

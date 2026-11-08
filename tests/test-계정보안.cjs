// 2026-11-08 계정·동기화·보안 결함 수정 회귀 검증 (로그아웃 정리·창조주 봉인 서버 반영·손상 저장값·이스케이프)
const { load, makeHarness } = require('./load.cjs');

load(async (window) => {
  const { assert, finish } = makeHarness('계정·보안 결함 수정');
  const doc = window.document;
  const ls = window.localStorage;
  const ev = (code) => window.eval(code);
  const 대기 = (ms) => new Promise(r => setTimeout(r, ms));

  // 1·2) 로그아웃: 첫 접속의 비로그인 통지는 아무것도 안 지우고, 실제 로그아웃은 개인 키만 지운다
  ls.setItem('plx_AI지침', '비밀 지침'); ls.setItem('plx_진행중대화', '{}'); ls.setItem('plx_테마', 'antique');
  ev('인증상태_변경(null)');
  assert('로그아웃: 첫 비로그인 통지는 개인 키를 지우지 않는다', ls.getItem('plx_AI지침') === '비밀 지침');
  ev('fbDb = null; 인증상태_변경({uid:"u1", email:""}); 인증상태_변경(null);');
  assert('로그아웃: 로그인했다가 나가면 개인 키(AI지침·진행중대화)를 지운다',
    ls.getItem('plx_AI지침') === null && ls.getItem('plx_진행중대화') === null);
  assert('로그아웃: 테마 같은 기기 설정 키는 남긴다', ls.getItem('plx_테마') === 'antique');
  assert('로그아웃: 현재UID가 비워진다', ev('현재UID') === null);

  // 1) 로그아웃 실행: 진행 중 대화를 마감하고, 남은 쓰기를 기다린 뒤 signOut
  ev(`window.__순서 = [];
    fbDb = {waitForPendingWrites: () => { __순서.push('대기'); return Promise.resolve(); }};
    fbAuth = {signOut: () => { __순서.push('로그아웃'); return Promise.resolve(); }};
    현재채팅세션 = {카테고리:'일반', 시작시각: 1, 메시지:[{역할:'나', 내용:'안녕', 시각:1}]};
    로그아웃실행();`);
  await 대기(50);
  assert('로그아웃 실행: 진행 중 대화를 먼저 마감한다', ev('현재채팅세션') === null && ls.getItem('plx_진행중대화') === null);
  assert('로그아웃 실행: 남은 쓰기를 기다린 뒤 로그아웃', ev('__순서.join(",")') === '대기,로그아웃', ev('__순서.join(",")'));

  // 3) 봉인: 서버의 창조주 진행도는 병합이 아니라 삭제 표지로 지운다
  ev(`window.__저장 = null; window.__원래저장 = 사용자데이터_저장; window.__원래fb = firebase;
    사용자데이터_저장 = (d) => { __저장 = d; return Promise.resolve(); };
    firebase = {firestore:{FieldValue:{delete: () => '삭제표지'}}};
    사용자.업적진행도 = {창조주: 1, 질문쟁이: 2};
    개발자모드_봉인_실행();
    사용자데이터_저장 = __원래저장; firebase = __원래fb;`);
  assert('봉인: 창조주 진행도에 삭제 표지를 보낸다', ev('__저장.업적진행도.창조주') === '삭제표지');
  assert('봉인: 다른 업적 진행도는 서버로 덮어쓰지 않는다', ev('__저장.업적진행도.질문쟁이') === undefined);
  assert('봉인: 로컬에서도 창조주 진행도 제거', ev('사용자.업적진행도.창조주') === undefined);
  ev('closeInfoModal()');

  // 4) 손상된 저장값
  ls.setItem('plx_게스트보관함', JSON.stringify({대기열:[null, {단어:'가'}], 즐겨찾기:[null], 휴지통:[]}));
  ev('게스트보관함_복원()');
  assert('게스트보관함: null 원소를 버린다', ev('복습데이터.대기열.length') === 1 && ev('복습데이터.즐겨찾기.length') === 0);
  const 전 = ev('JSON.stringify(커스텀색)');
  ls.setItem('plx_커스텀', JSON.stringify({bg:'#000000'}));
  ev('커스텀_복원()');
  assert('커스텀 테마: 색이 빠진 손상값은 무시', ev('JSON.stringify(커스텀색)') === 전);

  // 5·6) 이스케이프 — 이름·슬롯 이름·출제 근거가 태그로 실행되지 않는다
  ev(`userName = '<img src=x id=악성>'; 렌더_성장상세();`);
  assert('성장상세: 이름이 글자로 나온다', !doc.getElementById('악성') && doc.getElementById('sgBody').textContent.includes('<img src=x id=악성>'));
  ev(`커스텀슬롯 = [{이름:'"><img id=악성2>', bg:'#000000', card:'#111111', acc:'#222222', txt:'#ffffff'}]; 커스텀_슬롯렌더();`);
  assert('커스텀 슬롯: 이름이 속성을 탈출하지 못한다', !doc.getElementById('악성2'));
  ev(`사용자.보유토큰 = 100; 현재문제_reasoning_note = '<b id=악성3>근거</b>'; openObj('general');`);
  assert('이의있음: 출제 근거가 글자로 나온다', !doc.getElementById('악성3') && doc.getElementById('objNote').textContent.includes('<b id=악성3>'));
  ev('closeObj()');

  process.exit(finish() ? 1 : 0);
});

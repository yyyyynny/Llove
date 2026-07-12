// 세션10-l — 계정 삭제·학습 데이터 초기화 시 채팅 기록도 함께 삭제되는지 검증
const { load, makeHarness } = require('./load.cjs');
load((window) => {
  const { assert, finish } = makeHarness('세션10-l 계정삭제·초기화 채팅 기록 삭제 테스트');
  const doc = window.document, ev = (c) => window.eval(c);

  function 채팅더미준비(){
    ev(`
      채팅기록 = [
        {카테고리:'일반', 시작시각:1, 메시지:[{역할:'나',내용:'테스트1',시각:1}], 문서ID:'doc1'},
        {카테고리:'일반', 시작시각:2, 메시지:[{역할:'나',내용:'테스트2',시각:2}], 문서ID:'doc2'}
      ];
      현재채팅세션 = {카테고리:'일반', 시작시각:3, 메시지:[{역할:'나',내용:'진행중',시각:3}]};
      try{ localStorage.setItem('plx_채팅기록', JSON.stringify(채팅기록)); localStorage.setItem('plx_진행중대화', JSON.stringify(현재채팅세션)); }catch(e){}
    `);
  }

  /* ── 공용 헬퍼: 채팅기록_전체삭제() 단독 동작 ── */
  채팅더미준비();
  const 삭제된문서 = [];
  ev(`
    window.__origFbDb = fbDb; 현재UID = 'test-uid';
    fbDb = { collection: () => ({ doc: () => ({ collection: () => ({ doc: (id) => ({ delete: () => { window.__삭제됨 = window.__삭제됨||[]; window.__삭제됨.push(id); return Promise.resolve(); } }) }) }) }) };
  `);
  ev('채팅기록_전체삭제();');
  assert('채팅기록_전체삭제: 배열 비워짐', ev('채팅기록.length') === 0);
  assert('채팅기록_전체삭제: 진행 중 세션도 초기화됨', ev('현재채팅세션') === null);
  assert('채팅기록_전체삭제: localStorage plx_채팅기록 제거', !window.localStorage.getItem('plx_채팅기록'));
  assert('채팅기록_전체삭제: localStorage plx_진행중대화 제거', !window.localStorage.getItem('plx_진행중대화'));
  assert('채팅기록_전체삭제: Firestore 서브컬렉션 문서 각각 삭제 요청됨(doc1·doc2)',
    ev('window.__삭제됨 && window.__삭제됨.includes("doc1") && window.__삭제됨.includes("doc2")'));
  assert('채팅기록_전체삭제: 채팅창이 초기 인사말로 리셋됨',
    doc.getElementById('askBody').innerHTML.includes('안녕하세요'));
  ev('fbDb = window.__origFbDb;');

  /* ── 학습 데이터 초기화 흐름에도 채팅 기록 삭제가 포함됐는지 ── */
  채팅더미준비();
  ev(`
    fbDb = { collection: () => ({ doc: () => ({ set: () => Promise.resolve(), update: () => Promise.resolve(), collection: () => ({ doc: () => ({ delete: () => Promise.resolve() }) }) }) }) };
    현재UID = 'test-uid';
  `);
  ev('학습데이터초기화_실행();');
  assert('학습 데이터 초기화 후 채팅기록 배열 비워짐', ev('채팅기록.length') === 0);
  assert('학습 데이터 초기화 후 진행 중 세션도 비워짐', ev('현재채팅세션') === null);
  assert('학습 데이터 초기화 후 localStorage 채팅 캐시 제거', !window.localStorage.getItem('plx_채팅기록'));

  /* ── 계정 삭제 흐름에도 채팅 기록 삭제가 포함됐는지(Auth 계정 삭제보다 먼저 호출되는지) ── */
  채팅더미준비();
  ev(`
    window.__호출순서 = [];
    현재UID = 'test-uid';
    fbAuth = { currentUser: { uid:'test-uid', delete: () => { window.__호출순서.push('auth삭제'); return Promise.resolve(); } } };
    fbDb = {
      collection: () => ({
        doc: () => ({
          delete: () => { window.__호출순서.push('user문서삭제'); return Promise.resolve(); },
          collection: () => ({ doc: (id) => ({ delete: () => { window.__호출순서.push('채팅문서삭제:'+id); return Promise.resolve(); } }) })
        })
      })
    };
    window.__origGoNav = goNav; goNav = (s)=>{ window.__호출순서.push('nav:'+s); };
  `);
  ev('계정삭제_실행();');
  assert('계정 삭제 실행 직후(동기) 채팅기록 배열이 이미 비워짐', ev('채팅기록.length') === 0);
  setTimeout(() => {
    const 순서 = ev('window.__호출순서');
    assert('계정 삭제: 채팅 문서 삭제가 Auth 계정 삭제보다 먼저 호출됨',
      순서.some(s => s.startsWith('채팅문서삭제')) && 순서.indexOf(순서.find(s=>s.startsWith('채팅문서삭제'))) < 순서.indexOf('auth삭제'));
    assert('계정 삭제: Auth 계정도 정상적으로 삭제됨', 순서.includes('auth삭제'));
    ev('goNav = window.__origGoNav;');

    process.exit(finish() > 0 ? 1 : 0);
  }, 100);
});

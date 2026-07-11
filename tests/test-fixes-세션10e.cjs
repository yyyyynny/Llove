// 세션10-e 7차 피드백 검증 — 초기화 이중확인+실제리셋·반응형 모달·랜덤 넘어가기
const { load, makeHarness } = require('./load.cjs');
load((window) => {
  const { assert, finish } = makeHarness('세션10-e 7차 피드백 수정 테스트');
  const doc = window.document, ev = (c) => window.eval(c);
  const css = Array.from(doc.querySelectorAll('style')).map(s=>s.textContent).join('\n');

  /* ── 항목2: 반응형 모달(clamp) — 먼저(비동기 없음) ── */
  assert('#2: .modal-bx clamp 반응형', /\.modal-bx\{[^}]*max-width:clamp\(320px, 46vw, 520px\)/.test(css));
  assert('#2: .modal-bx.wide clamp 반응형', /\.modal-bx\.wide\{max-width:clamp\(340px, 72vw, 680px\)/.test(css));

  /* ── 항목3: 랜덤 넘어가기 ── */
  ev("goLearn('맞춤법','sq3',null);");
  assert('#3: 일반 진입 시 랜덤진입=false', ev('랜덤진입') === false);
  assert('#3: 일반 진입 시 넘어가기 버튼 숨김', Array.from(doc.querySelectorAll('.random-skip')).every(el=>el.style.display==='none'));

  // 맞춤법만 남기고 나머지 가중치 0 — 랜덤 결과를 결정론적으로 만듦
  ev(`랜덤설정.가중치 = {}; 랜덤학습_모드목록.forEach(m=>{ 랜덤설정.가중치[m[0]] = (m[0]==='맞춤법') ? 1 : 0; });`);
  ev("랜덤학습();");
  assert('#3: 랜덤 진입 시 랜덤진입=true', ev('랜덤진입') === true);
  assert('#3: 랜덤 진입 시 넘어가기 버튼 표시', Array.from(doc.querySelectorAll('.random-skip')).every(el=>el.style.display==='block'));
  assert('#3: 랜덤 결과가 지정한 모드(맞춤법)로 진입', ev('현재학습모드') === '맞춤법' && ev('curScreen') === 'sq3');

  const 문제전 = doc.getElementById('sq3Body').innerHTML;
  ev("랜덤_넘어가기();");
  assert('#3: 넘어가기 후에도 랜덤진입 유지(버튼 계속 표시)', ev('랜덤진입') === true);
  assert('#3: 넘어가기 시 같은 화면(sq3) 유지, 재출제', ev('curScreen') === 'sq3' && doc.getElementById('sq3Body').innerHTML.length > 0);
  void 문제전; // 재출제 내용은 랜덤이라 동일할 수도 있어 존재 여부만 확인

  // 다시 일반 진입하면 꺼짐(다음 항목1 테스트 전에 원상복구 겸 확인)
  ev("goLearn('맞춤법','sq3',null);");
  assert('#3: 이후 일반 진입 시 다시 숨김', Array.from(doc.querySelectorAll('.random-skip')).every(el=>el.style.display==='none'));

  /* ── 항목1: 초기화 이중확인 + 실제 리셋 ── */
  // Firestore 로그인 모킹 — 업적진행도 update() 호출 여부 검증용
  ev(`
    window.__updateCalls = [];
    fbDb = { collection: () => ({ doc: () => ({
      set: () => Promise.resolve(),
      update: (v) => { window.__updateCalls.push(v); return Promise.resolve(); }
    }) }) };
    현재UID = 'test-uid';
    사용자.레벨 = 42; 사용자.업적진행도 = {growth: 7, steady: 3};
    curScreen = 'sse';
  `);
  ev("학습데이터초기화_1단계();");
  assert('#1: 1단계 모달 제목에 (1/2)', doc.getElementById('infoTitle').textContent.includes('1/2'));
  // [취소][계속] 중 마지막(확인) 버튼 클릭
  doc.querySelectorAll('#infoBtns button')[1].click();

  setTimeout(() => {
    assert('#1: 확인 클릭 후 2단계 모달로 전환(이중 확인 체인 동작)', doc.getElementById('infoTitle').textContent.includes('2/2'));
    doc.querySelectorAll('#infoBtns button')[1].click();

    setTimeout(() => {
      assert('#1: 2단계 확인 후 레벨 리셋(실제 초기화 반영)', ev('사용자.레벨') === 1);
      assert('#1: 업적진행도 update() 호출(딥머지 아닌 통째 교체)', ev('window.__updateCalls.length') > 0 && ev('JSON.stringify(window.__updateCalls[0])') === '{"업적진행도":{}}');
      assert('#1: 실행 후 홈 화면으로 이동(재렌더 보장)', ev('curScreen') === 'sh');

      process.exit(finish() > 0 ? 1 : 0);
    }, 350);
  }, 350);
});

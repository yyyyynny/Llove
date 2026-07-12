// 세션10-j/k — 창조주 업적 시도(【】 포함, 오타·부분 복사·재시도 등) 채팅 기록 저장 방지
// 세션10-k: 실기기 확인 결과 창조주 달성 후에도 매칭 실패 시 저장되는 동일 문제가 재현되어
// 달성 여부와 무관하게 항상 저장하지 않도록 가드를 넓힘(구 !사용자.창조주달성 조건 제거).
const { load, makeHarness } = require('./load.cjs');
load((window) => {
  const { assert, finish } = makeHarness('세션10-j/k 창조주 시도 채팅 미저장 테스트');
  const doc = window.document, ev = (c) => window.eval(c);

  function ask(text){
    ev(`
      현재채팅세션 = null; try{localStorage.removeItem('plx_진행중대화')}catch(e){}
      document.getElementById('askInp').value = ${JSON.stringify(text)};
    `);
    ev('sendAsk();');
  }

  /* ── 정상 질문: 【】 없음 → 그대로 저장됨 ── */
  ev('사용자.창조주달성 = false;');
  ask('맞춤법이 헷갈려요');
  setTimeout(() => {
    const s1 = ev('현재채팅세션');
    assert('정상 질문(【】 없음)은 채팅 기록에 저장됨', !!s1 && s1.메시지.some(m => m.내용 === '맞춤법이 헷갈려요'));

    /* ── 창조주 미달성 + 【】 포함(오타·부분 복사 등 실패한 시도) → 저장 안 됨 ── */
    ev('사용자.창조주달성 = false;');
    ask('【원한다면 언제든 세상을 내 발밑에】');
    setTimeout(() => {
      const s2 = ev('현재채팅세션');
      assert('창조주 미달성 + 【】 포함 시도는 채팅 기록에 저장되지 않음(세션 자체가 안 생김)', s2 === null);
      assert('창조주 미달성 + 【】 시도가 화면(DOM)에는 그대로 보임(사용자 경험은 유지)',
        Array.from(doc.querySelectorAll('#askBody .ask-msg.user')).some(el => el.textContent.includes('원한다면 언제든 세상을 내 발밑에')));

      /* ── 정확한 키 일치는 원래도 저장 안 됨(회귀 확인) — 이미 달성 상태가 아니어야 시나리오 진입 ── */
      ev('사용자.창조주달성 = false; 창조주진행중 = false;');
      ask('【원한다면 언제든 세계를 너의 발밑에.】\n【바란다면 죽음 또한 감히 그대를 삼키지 못할지니.】');
      const s3 = ev('현재채팅세션');
      assert('정확한 창조주 키 일치 시에도 여전히 채팅 기록 저장 안 됨(회귀 없음)', s3 === null);

      // 창조주시작()은 setTimeout(800) 뒤에 호출되므로 그만큼 기다린 뒤 시나리오 진입 확인
      setTimeout(() => {
        assert('정확한 키 일치 시 창조주 시나리오 진입(창조주진행중=true)', ev('창조주진행중') === true);
        ev('창조주진행중 = false; 창조주달성진행중 = false;'); // 원복(다음 테스트 영향 방지)

        /* ── 세션10-k: 창조주 이미 달성한 계정도 【】 포함 + 매칭 실패 메시지는 저장 안 됨(실기기 재현 케이스) ── */
        ev('사용자.창조주달성 = true;');
        ask('【원한다면 언제든 세상을 내 발밑에】'); // 살짝 다른 문구 → 매칭 실패
        setTimeout(() => {
          const s4 = ev('현재채팅세션');
          assert('창조주 달성 후에도 【】 포함 + 매칭 실패 메시지는 저장되지 않음(세션10-k)', s4 === null);

          process.exit(finish() > 0 ? 1 : 0);
        }, 600);
      }, 900);
    }, 600);
  }, 600);
});

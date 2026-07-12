// 세션10-k — 다크/라이트 모드 토글 삭제(라이트=페이퍼 1개뿐이라 테마 그리드와 중복, 최고 관리자님 확정)
const { load, makeHarness } = require('./load.cjs');
load((window) => {
  const { assert, finish } = makeHarness('세션10-k 다크·라이트 토글 삭제 테스트');
  const doc = window.document, ev = (c) => window.eval(c);

  assert('#modeToggle DOM 삭제됨', !doc.getElementById('modeToggle'));
  assert('#modeSubTxt DOM 삭제됨', !doc.getElementById('modeSubTxt'));
  assert('#lblD/#lblL DOM 삭제됨', !doc.getElementById('lblD') && !doc.getElementById('lblL'));
  assert('toggleMode 함수 삭제됨', typeof ev('typeof toggleMode') === 'string' && ev('typeof toggleMode') === 'undefined');
  assert('LIGHTS 상수 삭제됨', ev('typeof LIGHTS') === 'undefined');

  // 테마 선택 그리드는 그대로 유지·정상 동작(다크/라이트 토글 삭제와 무관한 회귀 없음 확인)
  assert('테마 선택 그리드 존재', doc.querySelectorAll('.th-grid .tc').length >= 5);
  ev("setTheme('paper', true);");
  assert('setTheme 정상 동작(토글 관련 DOM 참조 없이도 에러 없이 테마 전환)', doc.body.getAttribute('data-theme') === 'paper');
  ev("setTheme('antique', true);"); // 원복

  // 같은 .mt/.mtt 스위치 컴포넌트를 쓰는 다른 토글(AI 문제만 출제)은 영향 없이 유지
  assert('공용 토글 스위치 컴포넌트(aiOnlyToggle)는 영향 없이 유지', !!doc.getElementById('aiOnlyToggle'));

  process.exit(finish() > 0 ? 1 : 0);
});

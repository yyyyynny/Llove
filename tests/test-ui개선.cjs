// 2026-10-03 UI 개선(인계 노트 13절, docs/UI감사_2026-10-03.md) — 고친 동작 회귀 검증
const { load, makeHarness } = require('./load.cjs');

load((window) => {
  const { assert, finish } = makeHarness('UI 개선 — 감사 지적 수정');
  const doc = window.document;
  const ev = (code) => window.eval(code);
  const 보임 = (id) => doc.getElementById(id).classList.contains('show');

  // U18: 첫 화면부터 첫 슬라이드 상태(이전 버튼 숨김), 한 번 보면 기억
  assert('U18: 처음부터 이전 버튼이 숨겨져 있다', doc.getElementById('obPrev').classList.contains('inv'));
  ev('finishOb()');
  assert('U18: 온보딩을 마치면 다시 안 띄우도록 기억', window.localStorage.getItem('plx_온보딩봄') === '1');

  // U2: 레벨업과 업적이 한꺼번에 오면 겹치지 않고 하나씩, 업적 둘째 것도 잃지 않는다
  ev("레벨업팝업(5); 업적_팝업표시(ACH_DATA[0].items[0].key, 0, 10); 업적_팝업표시(ACH_DATA[0].items[1].key, 0, 20);");
  assert('U2: 처음엔 레벨업만 보인다', 보임('lvupOv') && !보임('achOv'));
  ev('closeLvUp()');
  assert('U2: 레벨업을 닫으면 첫 업적', 보임('achOv') && doc.getElementById('ppExp').textContent === '+10 EXP');
  ev('closeAchOv()');
  assert('U2: 둘째 업적도 이어서 보인다', 보임('achOv') && doc.getElementById('ppExp').textContent === '+20 EXP');
  ev('closeAchOv()');
  assert('U2: 다 닫으면 아무것도 안 보인다', !보임('achOv') && !보임('lvupOv'));

  // U3: 봉인 중 이의있음 — 열 때부터 제출이 막혀 있고, 제출을 시도해도 쓴 글이 남는다
  ev("사용자.보유토큰 = 100; openObj('general');");
  const 제출 = doc.getElementById('objSubmit');
  assert('U3: 봉인 중엔 열자마자 제출 버튼이 막혀 있다', 제출.disabled && 제출.textContent.includes('연동 후'), 제출.textContent);
  doc.getElementById('objInp').value = '근거가 틀렸습니다';
  ev('submitObj()');
  assert('U3: 제출 시도 후에도 쓴 글이 남는다', doc.getElementById('objInp').value === '근거가 틀렸습니다');
  ev('closeObj()');

  // U17: 사실과 다른 문구
  const 모드수 = doc.querySelectorAll('#sh .mc[onclick*="goLearn"]').length;
  const 온보딩 = doc.querySelectorAll('.ob-slide[data-i="1"] .ob-feat').length;
  assert('U17: 온보딩 모드 수 = 홈 모드 카드 수', 온보딩 === 모드수 && doc.querySelector('.ob-slide[data-i="1"] .ob-title').textContent.startsWith(모드수 + '가지'), 온보딩 + '/' + 모드수);
  assert('U17: 맞춤법 카드는 실제 보기 수(4)', doc.querySelector('[onclick*="\'sq3\'"] .mc-desc').textContent.includes('4지선다'));
  ev("학습설정.sq4='UP¡¿'; renderDad(아재풀_구성('UP¡¿'));");
  assert('U17: UP¡¿ 난이도면 상단 보상도 +30', doc.getElementById('sq4Exp').textContent === '+30');
  ev("학습설정.sq4='아↗그거!'; renderDad(아재풀_구성('아↗그거!'));");
  assert('U17: 기본 난이도는 +20', doc.getElementById('sq4Exp').textContent === '+20');
  ev("setTheme('paper')");
  const 토스트 = doc.getElementById('toast').textContent;
  assert('U17: 테마 토스트는 한글 이름', 토스트.includes('페이퍼') && !토스트.includes('paper'), 토스트);
  ev("setTheme('antique', true)");
  assert('U17: 첫 채팅 인사에 내부 용어(Grok) 없음', !doc.querySelector('#askBody .ask-msg.ai').textContent.includes('Grok'));

  process.exit(finish() > 0 ? 1 : 0);
});

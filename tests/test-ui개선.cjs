// 2026-10-03 UI 개선(인계 노트 13절, docs/UI감사_2026-10-03.md) — 고친 동작 회귀 검증
const fs = require('fs');
const path = require('path');
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

  // 글꼴 정책: 기본은 테마 글꼴, 고른 글꼴은 버튼까지 적용, 「테마 기본」으로 되돌릴 수 있다
  const 버튼글꼴 = () => window.getComputedStyle(doc.querySelector('.btn-acc')).getPropertyValue('--fn');  // jsdom은 var()를 안 풀어 변수값으로 확인
  assert('글꼴: 기본 선택은 테마 기본', ev('curFont') === 'theme' && doc.getElementById('fontTxt').textContent === '테마 기본');
  ev("applyFont('nanum_gothic', true)");
  assert('글꼴: 고른 글꼴이 버튼에도 적용', 버튼글꼴().includes('Nanum Gothic'), 버튼글꼴());
  ev("applyFont('theme', true)");
  assert('글꼴: 테마 기본으로 되돌리면 덮어쓰기 해제', !doc.body.style.getPropertyValue('--fn') && !버튼글꼴().includes('Nanum Gothic'), 버튼글꼴());
  ev('openFontSelect()');
  assert('글꼴: 선택 목록 맨 위가 테마 기본', doc.querySelector('#fontList .fo').dataset.key === 'theme');
  ev('closeFont()');

  // U14: 닫힌 모달은 Tab 순서에서 빠지고(visibility), Esc로 맨 위 모달이 닫힌다
  const 가시성 = (id) => window.getComputedStyle(doc.getElementById(id)).visibility;
  assert('U14: 닫힌 이의있음 모달은 숨김(Tab 제외)', 가시성('objBg') === 'hidden', 가시성('objBg'));
  ev("showInfoModal('ℹ️','안내','내용'); openObj('general');");
  assert('U14: 열린 모달은 보임', 가시성('objBg') === 'visible' && 가시성('infoBg') === 'visible');
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert('U14: Esc는 맨 위(이의있음)만 닫는다', !보임('objBg') && 보임('infoBg'));
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert('U14: Esc 한 번 더 누르면 아래 모달도 닫힌다', !보임('infoBg'));

  // U8: 선택형 채점 결과와 해설이 화면 안(보기 아래)에 보인다
  ev(`DB문제['상식·어원']=[{cat:'상식',q:'문제',opts:[{t:'가',c:true},{t:'나',c:false},{t:'다',c:false},{t:'라',c:false}],reasoning_note:'가인 까닭'}];`);
  ev("학습설정.sq1='4지선다'; goLearn('상식·어원','sq1',null);");
  assert('U5: 답하기 전 다음 단추는 건너뛰기', doc.querySelector('#sq1Body .q-next .q-skip').textContent === '건너뛰기');
  ev("document.querySelector('#sq1Body .aopt').click()");
  const 결과상자 = doc.querySelector('#sq1Body .aopts + .syn-result');
  assert('U8: 보기 바로 아래 결과 상자', !!결과상자 && /정답|오답/.test(결과상자.textContent), 결과상자?.textContent);
  assert('U8: 해설(출제 근거)이 함께 보인다', 결과상자?.querySelector('.syn-result-reason')?.textContent === '가인 까닭');
  // U6: 플래시카드 자기 평가는 접힌 「더 알아보기」 밖(뜻 바로 아래)
  ev("renderFlashcard([{cat:'고사성어',word:'漁夫之利',mark:'',reading:'어부지리',meaning:'뜻',hanja:[],direct:'',example:'',mnemonic:''}]);");
  assert('U6: 자기 평가가 더 알아보기 밖에 있다', !!doc.querySelector('#fcBack > .fc-judge') && !doc.querySelector('#fcMore .fc-judge'));

  // U19: 상태색(정답·오답·경고·정보)이 고서 테마 값으로 박혀 있지 않다 — 테마 토큰에서 파생
  const css = fs.readFileSync(path.join(__dirname, '..', 'Llove', 'style.css'), 'utf8');
  const 박힌색 = css.match(/rgba\((120,184,120|192,112,112|224,144,96|90,152,200|120,180,255)/g) || [];
  assert('U19: 상태색 고정 rgba가 남아 있지 않다', 박힌색.length === 0, 박힌색.join(' '));

  process.exit(finish() > 0 ? 1 : 0);
});

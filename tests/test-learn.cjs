// 항목7: 학습 모드 출제 분기(sq2 5방식 + 구어 교정 sq5) 동작 검증
const { load, makeHarness } = require('./load.cjs');
load((window) => {
  const { assert, finish } = makeHarness('학습 모드 동작 테스트');
  const doc = window.document, ev = (c) => window.eval(c);
  const css = Array.from(doc.querySelectorAll('style')).map(s => s.textContent).join('\n');

  // 재구조화 이후: sq2_출제풀()이 코드 속 하드코딩 표본 없이 DB문제[category]만 쓰도록 정리됨
  // (해당 표본은 data/고사성어속담.json·한자우리말.json으로 이전). fetch가 항상 실패하는 이
  // 테스트 환경(no-net-in-test)에서는 DB문제가 비므로, "DB 로드 성공" 상황을 직접 재현해
  // sq2 4지선다·역방향·뜻서술·플래시카드가 실제 데이터로 정상 동작하는지 검증한다.
  ev(`DB문제['고사성어·속담']=[
    {cat:'고사성어',word:'苛斂誅求',mark:'한자어',reading:'가렴주구',meaning:'세금을 혹독하게 거두고 재물을 강제로 빼앗음.',hanja:[['苛','가혹할 가']],direct:'d1',example:'e1',mnemonic:'m1'},
    {cat:'고사성어',word:'語不成說',mark:'한자어',reading:'어불성설',meaning:'말이 조금도 사리에 맞지 아니함.',hanja:[['語','말씀 어']],direct:'d2',example:'e2',mnemonic:'m2'},
    {cat:'고사성어',word:'四面楚歌',mark:'한자어',reading:'사면초가',meaning:'외롭고 곤란한 지경에 빠진 형편.',hanja:[['四','넉 사']],direct:'d3',example:'e3',mnemonic:'m3'},
    {cat:'고사성어',word:'塞翁之馬',mark:'한자어',reading:'새옹지마',meaning:'인생의 길흉화복은 예측하기 어렵다는 말.',hanja:[['塞','변방 새']],direct:'d4',example:'e4',mnemonic:'m4'}
  ];
  DB문제['한자·우리말']=[
    {cat:'한자어',word:'必然',mark:'한자어',reading:'필연',meaning:'반드시 그렇게 될 수밖에 없음.',hanja:[['必','반드시 필']],direct:'d5',example:'e5',mnemonic:'m5'},
    {cat:'한자어',word:'矛盾',mark:'한자어',reading:'모순',meaning:'앞뒤가 이치상 서로 맞지 않음.',hanja:[['矛','창 모']],direct:'d6',example:'e6',mnemonic:'m6'},
    {cat:'한자어',word:'杞憂',mark:'한자어',reading:'기우',meaning:'쓸데없는 걱정.',hanja:[['杞','나라이름 기']],direct:'d7',example:'e7',mnemonic:'m7'},
    {cat:'한자어',word:'白眉',mark:'한자어',reading:'백미',meaning:'가장 뛰어난 것.',hanja:[['白','흰 백']],direct:'d8',example:'e8',mnemonic:'m8'}
  ];`);

  ev("학습설정.sq2='4지선다'; sq2_출제_렌더('고사성어·속담');");
  let o = doc.querySelectorAll('#sq2Body .aopt');
  assert('4지선다: 보기 4개', o.length === 4, `보기=${o.length}`);
  assert('4지선다: 정답 1개', Array.from(o).filter(x => (x.getAttribute('onclick') || '').includes('true')).length === 1);
  assert('4지선다: 뜻 제시형', /다음 뜻에 해당하는 말/.test(doc.getElementById('sq2Body').innerHTML));

  ev("학습설정.sq2='역방향'; sq2_출제_렌더('고사성어·속담');");
  o = doc.querySelectorAll('#sq2Body .aopt');
  assert('역방향: 보기 4개', o.length === 4);
  assert('역방향: 단어→뜻형', /이 말의 뜻으로 옳은 것은/.test(doc.getElementById('sq2Body').innerHTML));

  ev("학습설정.sq2='뜻 직접 서술'; sq2_출제_렌더('한자·우리말');");
  assert('뜻서술: 입력창', !!doc.getElementById('sq2WriteInput'));

  ev(`유의어출제풀=[{예문:'그는 [ ] 결정을 내렸다.',correct:{w:'단호한'},acceptable:[{w:'과감한',이유:'유사'}],wrong:[{w:'우유부단한'},{w:'느긋한'}],reasoning_note:''}]; 학습설정.sq2='예문형'; sq2_출제_렌더('고사성어·속담');`);
  assert('예문형: 보기 렌더', doc.querySelectorAll('#sq2Body .syn-opt').length >= 2);

  ev("학습설정.sq2='플래시카드'; sq2_출제_렌더('한자·우리말');");
  assert('플래시카드: 카드 렌더', !!doc.getElementById('fcCard'));

  ev(`구어교정풀=[{prompt:'아 그거 빨리 해줘요',격식:'그 일을 서둘러 주시겠어요?',포인트:'격식'}]; 구어교정현재=null; goLearn('구어 교정','sq5',null);`);
  assert('구어 교정(sq5): 예문 출제', !!ev("구어교정현재"));

  // 세션10-c: 지문 독해(sq6) — 지문+질문+문장형 보기 4개(정답 1개) 전용 엔진 확인
  ev("goLearn('지문 독해','sq6',null);");
  const rcOpts = doc.querySelectorAll('#sq6RcOpts .rc-opt');
  assert('지문 독해(sq6): 지문 렌더', !!doc.querySelector('#sq6Body .rc-passage'));
  assert('지문 독해(sq6): 보기 4개 렌더', rcOpts.length === 4);
  assert('지문 독해(sq6): 정답 1개', Array.from(rcOpts).filter(x => x.dataset.correct === 'true').length === 1);
  const sq6exp0 = ev('사용자.총누적EXP||0');
  const 정답버튼 = Array.from(rcOpts).find(x => x.dataset.correct === 'true');
  ev(`document.querySelector('#sq6RcOpts .rc-opt[data-idx="${정답버튼.dataset.idx}"]').click();`);
  assert('지문 독해(sq6): 정답 선택 시 EXP 획득', ev('사용자.총누적EXP||0') > sq6exp0);
  assert('지문 독해(sq6): 마스터리 카운터 증가(문해력학습수)', ev('사용자.문해력학습수||0') > 0);
  assert('지문 독해(sq6): 다음 지문 버튼 존재(이의있음 없음)', doc.getElementById('sq6RcActions').innerHTML.includes('독해_렌더') && !doc.getElementById('sq6RcActions').innerHTML.includes('openObj'));

  // 세션10-m/n: 문장 배열(sq7) — 뒤섞인 문장을 탭한 순서대로 배치, 원본 인덱스열이 [0..N-1]이면 정답.
  // 세션10-n: 탭은 즉시 판정하지 않고 "제출하기"를 눌러야 판정되며, 이미 순번 매긴 문장을 다시 탭하면
  // 배치가 취소된다. 또한 판정 애니메이션이 어색했던 원인(inline animation-delay 잔존)이 없는지도 확인.
  const click원본 = (i) => ev(`document.querySelector('#sq7Opts .aopt[data-원본="${i}"]').click();`);
  ev("goLearn('문장 배열','sq7',null);");
  let sq7Opts = doc.querySelectorAll('#sq7Opts .aopt');
  assert('문장 배열(sq7): 문장 4개 렌더', sq7Opts.length === 4);
  assert('문장 배열(sq7): 초기엔 번호 배지 비어있음', Array.from(sq7Opts).every(x => x.querySelector('.onum').textContent === ''));
  assert('문장 배열(sq7): 렌더 시 inline animation-delay 안 남김(판정 애니메이션이 등장 연출에 밀리지 않도록)',
    Array.from(sq7Opts).every(x => !(x.getAttribute('style') || '').includes('animation-delay')));
  assert('문장 배열(sq7): 초기엔 제출 버튼 비활성(.dim)', doc.getElementById('sq7SubmitBtn').classList.contains('dim'));

  // 한 개만 탭 → 아직 미완성이라 자동 판정되지 않고, 제출해도 무시됨
  click원본(0);
  assert('문장 배열(sq7): 첫 탭 시 순번 1 배정 + picked 표시', doc.querySelector('#sq7Opts .aopt[data-원본="0"]').querySelector('.onum').textContent === '1'
    && doc.querySelector('#sq7Opts .aopt[data-원본="0"]').classList.contains('picked'));
  assert('문장 배열(sq7): 4개 미만 탭 시 자동 판정 안 됨(아직 correct/wrong 없음)', doc.querySelectorAll('#sq7Opts .aopt.correct,#sq7Opts .aopt.wrong').length === 0);
  ev('문장배열_제출();');  // 미완성 상태에서 제출 강행 → 무시돼야 함
  assert('문장 배열(sq7): 미완성 상태에서 제출 시도해도 무시됨', doc.querySelectorAll('#sq7Opts .aopt.correct,#sq7Opts .aopt.wrong').length === 0);

  // 순번 매긴 문장을 다시 탭 → 배치 취소(번호·picked 해제)
  click원본(0);
  assert('문장 배열(sq7): 재탭 시 배치 취소(번호 비워짐)', doc.querySelector('#sq7Opts .aopt[data-원본="0"]').querySelector('.onum').textContent === '');
  assert('문장 배열(sq7): 재탭 시 picked 클래스 해제', !doc.querySelector('#sq7Opts .aopt[data-원본="0"]').classList.contains('picked'));

  // 중간 취소 시 뒤 문장 번호가 당겨지는지 확인: 0→1→2 탭 후 1(두 번째로 탭한 것)을 취소하면 2가 2번으로 당겨져야 함
  click원본(0); click원본(1); click원본(2);  // 0=1번, 1=2번, 2=3번
  click원본(1);  // 1 취소
  assert('문장 배열(sq7): 중간 취소 시 뒤 문장 번호가 당겨짐', doc.querySelector('#sq7Opts .aopt[data-원본="2"]').querySelector('.onum').textContent === '2');
  ev('문장배열_초기화();');  // 다음 검증을 위해 정리

  // 정답 순서대로(원본 인덱스 0→1→2→3) 탭 → 전부 채워지면 제출 버튼 활성화, "제출하기"를 눌러야 판정
  const sq7exp0 = ev('사용자.총누적EXP||0');
  for (let i = 0; i < 4; i++) click원본(i);
  assert('문장 배열(sq7): 4개 다 탭해도 자동 판정 안 됨(제출 전)', doc.querySelectorAll('#sq7Opts .aopt.correct,#sq7Opts .aopt.wrong').length === 0);
  assert('문장 배열(sq7): 4개 다 탭하면 제출 버튼 활성화(.dim 해제)', !doc.getElementById('sq7SubmitBtn').classList.contains('dim'));
  ev('문장배열_제출();');
  assert('문장 배열(sq7): 제출 후 정답 순서였다면 전부 .correct', doc.querySelectorAll('#sq7Opts .aopt.correct').length === 4);
  // 세션10-o: 판정 후 'picked'가 남아있으면 스타일시트 순서상 .aopt.picked .onum이 .aopt.correct/.wrong .onum을
  // 덮어써 배지가 정답/오답 색으로 안 바뀌는 버그가 있었다 — 판정 시 picked가 반드시 제거돼야 한다.
  assert('문장 배열(sq7): 판정 후 picked 클래스 제거(정답/오답 배지색이 가려지지 않도록)',
    doc.querySelectorAll('#sq7Opts .aopt.picked').length === 0);
  // sq6 지문 독해(.rc-opt)·예문형(.syn-opt)처럼 배경 톤으로도 정답/오답을 구분하는지(전역 .aopt는 sq1과
  // 공유해 테두리색만 바뀌므로, sq7 스코프에서만 배경+글자색 대비를 추가했는지 CSS로 확인)
  assert('문장 배열(sq7): 정답/오답에 sq6·예문형과 맞춘 배경 톤 대비 CSS 존재(스코프 한정, sq1 전역 스타일 불변)',
    /#sq7Opts \.aopt\.correct\{background:/.test(css) && /#sq7Opts \.aopt\.wrong\{background:/.test(css));
  assert('문장 배열(sq7): 제출 후 EXP 획득', ev('사용자.총누적EXP||0') > sq7exp0);
  assert('문장 배열(sq7): 마스터리 카운터 증가(문해력학습수)', ev('사용자.문해력학습수||0') > 0);
  assert('문장 배열(sq7): 제출 후 판정 애니메이션이 4개 동시 재생(inline delay 없음)',
    Array.from(doc.querySelectorAll('#sq7Opts .aopt')).every(x => !(x.getAttribute('style') || '').includes('animation-delay')));
  assert('문장 배열(sq7): 다음 문제 버튼 노출', doc.getElementById('sq7NextActions').style.display === 'flex');

  // 새 인스턴스에서 일부러 틀린 순서(역순)로 탭 후 제출 → 일부 오답 표시 + 정답 순서 텍스트 노출
  ev("문장배열_렌더();");
  for (let i = 3; i >= 0; i--) click원본(i);
  ev('문장배열_제출();');
  assert('문장 배열(sq7): 역순 제출 시 오답(.wrong) 존재', doc.querySelectorAll('#sq7Opts .aopt.wrong').length > 0);
  assert('문장 배열(sq7): 오답 시 결과 패널에 정답 순서 문장 나열', doc.getElementById('sq7Result').innerHTML.includes('1. '));

  // 탭 도중 "다시 배치" — 상태 초기화 확인
  ev("문장배열_렌더();");
  click원본(0);
  ev("문장배열_초기화();");
  sq7Opts = doc.querySelectorAll('#sq7Opts .aopt');
  assert('문장 배열(sq7): "다시 배치" 후 번호 배지 초기화', Array.from(sq7Opts).every(x => x.querySelector('.onum').textContent === ''));
  assert('문장 배열(sq7): "다시 배치" 후 picked 해제', Array.from(sq7Opts).every(x => !x.classList.contains('picked')));
  assert('문장 배열(sq7): "다시 배치" 후 제출 버튼 다시 비활성', doc.getElementById('sq7SubmitBtn').classList.contains('dim'));

  // 세션10-c 항목1: 예문형 근사 정답 시 지문 독해 유도 넛지 노출 확인 (정답/오답 시엔 미노출)
  ev(`유의어출제풀=[{예문:'그는 [ ] 결정을 내렸다.',correct:{w:'단호한',def:'망설임 없이'},acceptable:[{w:'과감한',def:'용감히',이유:'유사'}],wrong:[{w:'우유부단한',def:''},{w:'느긋한',def:''}],reasoning_note:''}]; 학습설정.sq2='예문형'; sq2_출제_렌더('고사성어·속담');`);
  ev(`예문형_선택('sq2Body', document.querySelector('#sq2Body .syn-opt[data-kind="acceptable"]'));`);
  assert('예문형 근사 정답: 지문 독해 넛지 노출', doc.getElementById('sq2Body').innerHTML.includes('syn-nudge'));

  ev(`유의어출제풀=[{예문:'그는 [ ] 결정을 내렸다.',correct:{w:'단호한',def:'망설임 없이'},acceptable:[{w:'과감한',def:'용감히',이유:'유사'}],wrong:[{w:'우유부단한',def:''},{w:'느긋한',def:''}],reasoning_note:''}]; 학습설정.sq2='예문형'; sq2_출제_렌더('고사성어·속담');`);
  ev(`예문형_선택('sq2Body', document.querySelector('#sq2Body .syn-opt[data-kind="correct"]'));`);
  assert('예문형 정답: 넛지 미노출', !doc.getElementById('sq2Body').innerHTML.includes('syn-nudge'));

  process.exit(finish() > 0 ? 1 : 0);
});

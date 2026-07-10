// 항목7: 학습 모드 출제 분기(sq2 5방식 + 구어 교정 sq5) 동작 검증
const { load, makeHarness } = require('./load.cjs');
load((window) => {
  const { assert, finish } = makeHarness('학습 모드 동작 테스트');
  const doc = window.document, ev = (c) => window.eval(c);

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

  // 세션10-c 항목1: 예문형 근사 정답 시 지문 독해 유도 넛지 노출 확인 (정답/오답 시엔 미노출)
  ev(`유의어출제풀=[{예문:'그는 [ ] 결정을 내렸다.',correct:{w:'단호한',def:'망설임 없이'},acceptable:[{w:'과감한',def:'용감히',이유:'유사'}],wrong:[{w:'우유부단한',def:''},{w:'느긋한',def:''}],reasoning_note:''}]; 학습설정.sq2='예문형'; sq2_출제_렌더('고사성어·속담');`);
  ev(`예문형_선택('sq2Body', document.querySelector('#sq2Body .syn-opt[data-kind="acceptable"]'));`);
  assert('예문형 근사 정답: 지문 독해 넛지 노출', doc.getElementById('sq2Body').innerHTML.includes('syn-nudge'));

  ev(`유의어출제풀=[{예문:'그는 [ ] 결정을 내렸다.',correct:{w:'단호한',def:'망설임 없이'},acceptable:[{w:'과감한',def:'용감히',이유:'유사'}],wrong:[{w:'우유부단한',def:''},{w:'느긋한',def:''}],reasoning_note:''}]; 학습설정.sq2='예문형'; sq2_출제_렌더('고사성어·속담');`);
  ev(`예문형_선택('sq2Body', document.querySelector('#sq2Body .syn-opt[data-kind="correct"]'));`);
  assert('예문형 정답: 넛지 미노출', !doc.getElementById('sq2Body').innerHTML.includes('syn-nudge'));

  process.exit(finish() > 0 ? 1 : 0);
});

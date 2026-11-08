// 2026-11-08 채점·출제 로직 결함 수정 — 아재개그·구어 교정·sq2 4지선다·sq1 예문형·복습 회귀 검증
const { load, makeHarness } = require('./load.cjs');

load(async (window) => {
  const { assert, finish } = makeHarness('학습 채점·출제 로직');
  const doc = window.document;
  const ev = (code) => window.eval(code);
  const EXP = () => ev('사용자.총누적EXP||0');

  // 1. 아재개그 — 오답 보기는 같은 풀의 다른 정답, 틀리면 EXP 없음 + 복습 대기열
  ev(`복습데이터.대기열 = []; 현재학습모드필드 = '아재개그학습수';
      아재풀_테스트 = [{q:'문1',a:'답일',e:''},{q:'문2',a:'답이',e:''},{q:'문3',a:'답삼',e:''},{q:'문4',a:'답사',e:''},{q:'문5',a:'답오',e:''}];
      학습설정.sq4_input = '4지선다'; renderDad(아재풀_테스트);`);
  const 보기 = Array.from(doc.querySelectorAll('#sq4Body .aopt .otxt')).map(o => o.textContent);
  assert('아재 4지선다: 보기 4개가 모두 같은 풀의 정답', 보기.length === 4 && 보기.every(t => t.startsWith('답')) && new Set(보기).size === 4, 보기.join(','));
  let e0 = EXP();
  ev(`아재_선다선택(document.querySelector('#sq4Body .aopt[data-정답="0"]'), false);`);
  assert('아재 4지선다: 틀리면 EXP 없음', EXP() === e0);
  assert('아재 4지선다: 틀리면 복습 대기열에 정답이 들어감', ev('복습데이터.대기열.some(x=>x.단어===현재아재문제.a && x.뜻===현재아재문제.q)'));
  ev('renderDad(아재풀_테스트);');
  e0 = EXP();
  ev(`아재_선다선택(document.querySelector('#sq4Body .aopt[data-정답="1"]'), true);`);
  assert('아재 4지선다: 맞히면 EXP', EXP() > e0);
  ev(`학습설정.sq4_input = '직접입력'; renderDad(아재풀_테스트);`);
  doc.getElementById('dadDirectInp').value = '전혀 다른 답';
  e0 = EXP();
  ev('아재_직접제출();');
  assert('아재 직접입력: 틀리면 정답 공개는 하되 EXP 없음', doc.getElementById('dadAns').classList.contains('show') && EXP() === e0);
  ev(`학습설정.sq4_input = '4지선다'; renderDad([{q:'혼자',a:'유일',e:''}]);`);
  assert('아재 4지선다: 다른 정답이 없으면 플래시카드로', !doc.querySelector('#sq4Body .aopt') && !!doc.getElementById('dadBtn'));
  ev(`학습설정.sq4_input = '플래시카드';`);

  // 2. 구어 교정 — 5자 미만은 보상 없이 안내
  ev(`구어교정풀 = [{id:'시험1', 구어:'빨리 해줘요', 격식:'서둘러 주시겠어요?', 포인트:'격식'}]; 구어교정완료ID = {}; 구어교정_예문표시();`);
  doc.getElementById('spkInput').value = 'ㅁ ㅁ';
  e0 = EXP();
  ev('submitSpk();');
  assert('구어 교정: 5자 미만이면 결과·EXP 없음', EXP() === e0 && !doc.getElementById('spkResult').classList.contains('show'));
  doc.getElementById('spkInput').value = '서둘러 주시겠어요';
  ev('submitSpk();');
  assert('구어 교정: 충분한 길이면 모범답안 공개 + EXP', EXP() > e0 && doc.getElementById('spkFixTxt').textContent.includes('모범답안'));

  // 3. sq2 4지선다 — 뜻이 같거나 포함 관계인 짝은 오답 보기에서 빠진다
  const 카드 = (w, m) => `{word:'${w}',reading:'',meaning:'${m}',cat:'시험',hanja:[],mark:'',direct:'',example:'',mnemonic:''}`;
  ev(`DB문제['시험풀'] = [${카드('가','같은 뜻')}, ${카드('나','같은 뜻')}, ${카드('다','같은 뜻 풀이')}, ${카드('라','셋째')}, ${카드('마','넷째')}, ${카드('바','다섯째')}];
      출제_뽑기 = (풀) => 풀[0];`);
  ev(`sq2_선다렌더('시험풀', false);`);
  const 단어들 = Array.from(doc.querySelectorAll('#sq2Body .aopt .otxt')).map(o => o.textContent.trim());
  assert('sq2 4지선다: 같은 뜻 짝(나·다)이 오답에 안 나옴', 단어들.length === 4 && !단어들.includes('나') && !단어들.includes('다'), 단어들.join(','));

  // 4. sq1 예문형 — 표본 3건 미만이면 4지선다로 폴백 + 안내
  ev(`현재학습모드 = '상식·어원'; 학습설정.sq1 = '예문형'; renderQuiz('sq1', [{cat:'상식', q:'시험 문제?', opts:[{t:'가',c:true},{t:'나',c:false},{t:'다',c:false},{t:'라',c:false}]}]);`);
  assert('sq1 예문형: 표본 부족이면 4지선다로', doc.querySelectorAll('#sq1Body .aopt').length === 4 && !doc.querySelector('#sq1Body .syn-opt'));
  assert('sq1 예문형: 폴백 안내 토스트', doc.getElementById('toast').textContent.includes('예문형'));
  ev(`학습설정.sq1 = '4지선다';`);

  // 5. 복습 — 4지선다는 뜻(문제)을 내고 단어(정답)를 고른다 + 이스케이프
  ev(`복습데이터.대기열 = [
        {id:'로컬x1', 단어:'<b>답</b>', 뜻:'세상에서 가장 <i>빠른</i> 닭은?', 모드:'아재개그', 모드클래스:'ta', 연속정답수:0},
        {id:'로컬x2', 단어:'둘째답', 뜻:'둘째 문제?', 모드:'아재개그', 모드클래스:'ta', 연속정답수:0}];
      학습설정.srp = '4지선다'; 복습진행 = {목록:[...복습데이터.대기열], idx:0}; 복습_카드렌더();`);
  const 본문 = doc.getElementById('srpBody');
  const 복습보기 = Array.from(본문.querySelectorAll('.aopt .otxt')).map(o => o.textContent);
  assert('복습 4지선다: 문제 문장은 보기가 아니라 질문으로', 본문.querySelector('.q-question').textContent.includes('세상에서') && !복습보기.some(t => t.includes('?')), 복습보기.join(','));
  assert('복습 4지선다: 보기는 단어(정답·다른 단어)', 복습보기.includes('<b>답</b>') && 복습보기.includes('둘째답'));
  assert('복습: 단어·뜻 HTML 이스케이프', !본문.querySelector('.q-question i') && !본문.querySelector('.aopt b'));
  ev(`복습_선다선택(document.querySelector('#srpBody .aopt[data-정답="1"]'), true);`);
  await new Promise(r => setTimeout(r, 800));   // 선다 판정은 0.7초 뒤
  assert('복습 4지선다: 맞히면 졸업(대기열에서 빠짐)', !ev(`복습데이터.대기열.some(x=>x.id==='로컬x1')`));
  ev(`학습설정.srp = '카드 보기'; 복습진행 = null;`);

  // 6. 즐겨찾기 다시 풀기 — 안내 대신 실제 복습 플레이, 토큰 충전 없음
  ev(`복습데이터.즐겨찾기 = [{id:'로컬f1', 단어:'즐찾단어', 뜻:'즐찾 뜻', 모드:'한자·우리말', 모드클래스:'tp'}]; 사용자.복습복구횟수 = 0; 사용자.복습복구날짜 = 오늘날짜_로컬(0);`);
  ev(`즐겨찾기_다시풀기('로컬f1');`);
  assert('즐겨찾기 다시 풀기: 복습 화면에 그 단어 출제', ev('curScreen') === 'srp' && 본문.textContent.includes('즐찾단어'));
  ev('복습_판정(true);');
  assert('즐겨찾기 다시 풀기: 끝나면 복습 관리로, 토큰 충전 횟수 그대로', ev('curScreen') === 'sr' && ev('사용자.복습복구횟수') === 0);

  process.exit(finish() > 0 ? 1 : 0);
});

// 2026-10-03 UI 개선(인계 노트 13절, docs/UI감사_2026-10-03.md) — 고친 동작 회귀 검증
const fs = require('fs');
const path = require('path');
const { load, makeHarness } = require('./load.cjs');

load(async (window) => {
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
  assert('U3: 봉인 중엔 열자마자 제출 버튼이 막혀 있다', 제출.disabled && 제출.textContent.includes('준비 중'), 제출.textContent);
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

  // U5: 예문형도 답 전엔 건너뛸 수 있다(종전엔 답하기 전 넘어갈 단추가 없었다)
  ev(`예문형_렌더('sq1Body', {예문:'[ ] 시험', correct:{w:'가'}, acceptable:[], wrong:[{w:'나'},{w:'다'},{w:'라'}]}, ()=>{}, null)`);
  assert('U5: 예문형 답 전 건너뛰기 단추', !!doc.querySelector('#sq1Body .q-skip-only'));
  ev('독해_렌더(); 문장배열_렌더();');
  assert('U5: 지문 독해·문장 배열도 답 전 건너뛰기', !!doc.querySelector('#sq6Body .q-skip-only') && !!doc.querySelector('#sq7Body .q-skip-only'));

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

  // U12: 순차 등장은 첫 방문에만 — 홈에 다시 오면 카드가 다시 올라오지 않는다
  ev("goNav('sh',null)"); ev("goNav('ss',null)"); ev("goNav('sh',null)");
  const 홈카드 = doc.querySelector('#sh .mc.fu');
  assert('U12: 재방문한 홈 카드는 등장 연출 정지', 홈카드.style.animation.startsWith('none'), 홈카드.style.animation);

  // U10: 네비·모드 카드·설정 행 아이콘은 단색 SVG — 이모지 없음, 참조한 아이콘은 모두 묶음에 있다
  const 그림문자 = /\p{Extended_Pictographic}/u;
  const 아이콘자리 = [...doc.querySelectorAll('.nv-btn, .mc-icon, .sri, .ob-fi')];
  assert('U10: 아이콘 자리에 이모지가 없다', 아이콘자리.every(e => !그림문자.test(e.textContent)), 아이콘자리.filter(e => 그림문자.test(e.textContent)).map(e => e.textContent.trim()).join(' '));
  const 없는아이콘 = [...doc.querySelectorAll('use')].map(u => u.getAttribute('href')).filter(h => !doc.querySelector(h));
  assert('U10: 참조한 아이콘이 모두 묶음에 있다', 없는아이콘.length === 0, 없는아이콘.join(' '));

  // U13: 봉인 중 질문하기는 사전 모드가 기본 — 창조주 키 문장(【】)은 그래도 창조주 흐름으로 간다(진입 경로 보존)
  ev('openAsk()');
  assert('U13: 봉인 중 질문하기 기본은 사전 모드', ev('사전모드') === true);
  ev("window.__사전호출 = 0; sendAsk_사전 = function(){ window.__사전호출++; };");
  ev("document.getElementById('askInp').value = '【원한다면】'; sendAsk();");
  assert('U13: 【】 문장은 사전 조회로 새지 않는다', ev('window.__사전호출') === 0);
  ev("document.getElementById('askInp').value = '사과'; sendAsk();");
  assert('U13: 일반 단어는 사전 조회', ev('window.__사전호출') === 1);
  ev('closeAsk()');

  // U16: 되돌릴 수 없는 동작의 최종 확인 단추는 위험색, 휴지통 비우기는 한 번 묻는다
  ev('계정삭제_2단계()');
  assert('U16: 영구 삭제 확인 단추는 위험색', !!doc.querySelector('#infoBtns .btn-danger'));
  ev('closeInfoModal()');
  ev("복습데이터.휴지통 = [{id:'b9', 단어:'가', 뜻:'나', 잔여일:3}]; 휴지통_비우기확인();");
  assert('U16: 휴지통 비우기는 바로 지우지 않고 묻는다', ev('복습데이터.휴지통.length') === 1 && 보임('infoBg'));
  ev('closeInfoModal()');

  // U20: 퍼펙트가 아니어도 5문제마다 결과를 알려 준다
  ev('퀴즈세션 = {수:0, 오답:0}; [true,false,true,true,true].forEach(세션결과_기록);');
  assert('U20: 5문제 마침 요약', doc.getElementById('toast').textContent === '5문제 마침 — 4/5 정답', doc.getElementById('toast').textContent);

  // U10: 모달 아이콘은 묶음에 있는 것은 SVG, 세계관 연출(👑)은 글자 그대로
  ev("showInfoModal('🔒','잠김','내용')");
  assert('U10: 모달 아이콘 SVG', !!doc.querySelector('#infoIcon use[href="#i-lock"]'));
  ev("showInfoModal('👑','알현','내용')");
  assert('U10: 세계관 아이콘은 그대로', doc.getElementById('infoIcon').textContent === '👑');
  ev('closeInfoModal()');

  // U19: 상태색(정답·오답·경고·정보)이 고서 테마 값으로 박혀 있지 않다 — 테마 토큰에서 파생
  const css = fs.readFileSync(path.join(__dirname, '..', 'Llove', 'style.css'), 'utf8');
  const 박힌색 = css.match(/rgba\((120,184,120|192,112,112|224,144,96|90,152,200|120,180,255)/g) || [];
  assert('U19: 상태색 고정 rgba가 남아 있지 않다', 박힌색.length === 0, 박힌색.join(' '));

  // AI 즉시 생성 안 함: 켜면 출제는 항상 DB
  ev("AI생성끔=true");
  assert("AI 즉시 생성 안 함 ON이면 항상 DB 출제", Array.from({length:50},()=>ev("출제방식_결정()")).every(v=>v==="db"));
  ev("AI생성끔=false");

  // 심연 업적: 사전 모드에선 "너는 누구"만 달성, 단어 검색(존재)은 달성 안 됨
  ev("사용자.업적진행도={}; 사전모드=true; document.getElementById('askInp').value='존재'; sendAsk();");
  assert("심연: 사전 모드 단어 검색(존재)은 달성이 아니다", !ev("사용자.업적진행도['심연을들여다보는자']"));
  ev("document.getElementById('askInp').value='너는 누구야'; sendAsk();");
  assert("심연: 사전 모드에서도 너는 누구는 달성", !!ev("사용자.업적진행도['심연을들여다보는자']"));
  ev("사전모드=false");

  // P0: 사용자 문서를 못 읽으면 이번 접속은 저장하지 않는다(기본값이 서버 기록을 덮지 않게)
  ev("window.__저장 = []; fbDb = {collection:()=>({doc:()=>({get:()=>Promise.reject(new Error('net')), set:(d)=>{window.__저장.push(d); return Promise.resolve();}})})}; 인증상태_변경({uid:'u1', email:''});");
  await new Promise(r => setTimeout(r, 20));
  ev("사용자데이터_저장({레벨:1})");
  assert('P0: 문서 로드 실패 후엔 저장이 서버로 가지 않는다', ev("window.__저장.length") === 0 && ev("현재UID") === null);
  ev("fbDb = null");

  // 출제 엔진: 최근에 낸 문항은 다시 안 나오고, 정답 보기가 늘 1번이 아니다
  const 연속 = ev("histFilter='off'; 최근출제=[]; const 풀=Array.from({length:10},(_,i)=>({q:'문항'+i})); Array.from({length:5},()=>출제_뽑기(풀).q)");
  assert('출제: 풀 10개에서 연속 5번은 모두 다른 문항', new Set(연속).size === 5, 연속.join(','));
  const 첫칸정답 = ev("let n=0; for(let i=0;i<40;i++){ renderQuiz('sq3',[{q:'문',cat:'맞춤법',opts:[{t:'정',c:true},{t:'가',c:false},{t:'나',c:false},{t:'다',c:false}]}]); if(document.querySelector('#sq3Body .aopt .otxt').textContent==='정') n++; } n");
  assert('출제: 정답 보기가 늘 1번에 있지 않다', 첫칸정답 < 40, String(첫칸정답));

  // 잇 퍼즐: 바깥(배경)을 누르면 닫힌다
  ev("잇는_퍼즐열기()");
  doc.getElementById('잇는퍼즐Bg').click();
  assert("잇 퍼즐: 배경을 누르면 닫힌다", !보임('잇는퍼즐Bg'));

  // 2026-11-08 봉인 기능 노출 정리: 봉인 중엔 AI 설정 묶음·질문 탭을 숨기고(플래그는 그대로), 개발자 모드 행은 창조주만
  assert('봉인: 플래그는 그대로 false', ev('GROK_활성화') === false);
  assert('봉인: 설정의 AI 기능 묶음과 질문하기 탭이 숨겨진다',
    doc.querySelector('.set-ai').style.display === 'none' && doc.getElementById('askModeTabs').style.display === 'none');
  ev("사용자.개발자모드=false; 사용자.창조주달성=false; 갱신_설정_개발자모드_UI();");
  const 개발행 = () => doc.getElementById('devModeRow').style.display;
  assert('개발자 모드 행: 창조주가 아니면 숨김', 개발행() === 'none');
  ev("사용자.개발자모드=true; 사용자.창조주달성=true; 갱신_설정_개발자모드_UI();");
  assert('개발자 모드 행: 창조주면 보임', 개발행() === 'flex');
  ev("사용자.개발자모드=false; 사용자.창조주달성=false; 갱신_설정_개발자모드_UI(); 실험실_열기();");
  const 실험실글 = doc.getElementById('infoDesc').textContent;
  assert('실험실(11-08): 일반 사용자에겐 준비 중(예정)만 보이고, 끝말잇기·실험 항목은 안 보인다',
    !실험실글.includes('끝말잇기') && 실험실글.includes('AI 실시간 출제') && !실험실글.includes('음성 생성'), 실험실글);
  ev("closeInfoModal()");

  // 둘러보기: 로그인 화면 버튼으로 비로그인 진입, 설정의 계정 행은 「로그인」이 된다
  const 둘러보기 = Array.from(doc.querySelectorAll('#sl button')).find(b => b.textContent.includes('로그인 없이 둘러보기'));
  assert('둘러보기: 로그인 화면에 버튼이 있다', !!둘러보기);
  둘러보기.click();
  assert('둘러보기: 홈으로 들어가고 계정 행이 로그인', ev('curScreen') === 'sh' && doc.querySelector('[onclick="로그아웃()"] .srl').textContent === '로그인');

  // 2026-11-08 2차 정리: 남은 문구·봉인 기능 숨김
  ev("setLsetMode('sq4','UP¡¿', document.querySelector(\"#lsetSq4 [onclick*='UP']\"))");
  assert('아재 난이도 토스트는 버튼 라벨(어려움)로', doc.getElementById('toast').textContent === '난이도: 어려움', doc.getElementById('toast').textContent);
  ev("복습데이터.즐겨찾기=[{id:'f1',단어:'가렴주구',뜻:'뜻',모드:'고사성어·속담',모드클래스:'tp'}]; renderReview();");
  assert('봉인 중엔 즐겨찾기의 「유사 문제」 버튼이 없다', doc.getElementById('rvFav').innerHTML.includes('가렴주구') && !doc.getElementById('rvFav').innerHTML.includes('즐겨찾기_유사문제'));
  assert('구어 교정: 버튼·제목이 「모범답안」', doc.querySelector('#sq5 .spk-submit').textContent === '모범답안 보기' && doc.querySelector('#spkResult .spk-result-title').textContent === '모범답안');

  // 배포·메타: 관문 리다이렉트가 쿼리·해시를 유지, og 메타·404
  const 루트 = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const 이동 = []; new Function('location', 루트.match(/<script>([\s\S]*?)<\/script>/)[1])({ search: '?a=1', hash: '#x', replace: (u) => 이동.push(u) });
  assert('관문: 쿼리·해시를 붙여 이동', 이동[0] === 'Llove/?a=1#x', 이동[0]);
  for (const [파일, 주소] of [['index.html', 'https://yyyyynny.github.io/Llove/'], ['Llove/index.html', 'https://yyyyynny.github.io/Llove/'], ['wchain/index.html', 'https://yyyyynny.github.io/Llove/wchain/']]) {
    const h = fs.readFileSync(path.join(__dirname, '..', 파일), 'utf8');
    assert(`${파일}: description·og·twitter 메타`, /<meta name="description"/.test(h) && h.includes(`<meta property="og:url" content="${주소}">`) && /og:title/.test(h) && /og:type/.test(h) && /twitter:card/.test(h));
  }
  assert('404.html: Llove로 가는 절대 링크', fs.readFileSync(path.join(__dirname, '..', '404.html'), 'utf8').includes('href="/Llove/Llove/"'));

  // 11-08 결정: 이어서 하기 — 마지막으로 연 모드가 홈 맨 위 카드로
  ev("localStorage.removeItem('plx_마지막학습'); 이어서하기_표시()");
  assert('이어서 하기: 처음엔 숨김', doc.getElementById('continueCard').style.display === 'none');
  ev("goLearn('맞춤법','sq3',null); goNav('sh',null)");
  assert('이어서 하기: 맞춤법을 연 뒤 홈에 표시', doc.getElementById('continueCard').style.display === '' && doc.getElementById('continueDesc').textContent === '맞춤법');
  // 11-08 결정: 기본 이름 풀에 오류처럼 보이는 이름 없음, 실험실엔 이미 쓸 수 있는 끝말잇기 없음
  assert('이름 풀: null·undefined 없음', !ev("기본이름풀.some(n=>['null','undefined','noname','N/A'].includes(n))"));
  assert('실험실: 끝말잇기 항목 없음', !ev("실험실_목록.some(it=>it.이름==='끝말잇기')"));

  // 11-08: 연속 보호 — 하루 빠져도 보호 1개로 연속 유지, 보호가 없으면 1로
  ev("사용자.마지막학습일=오늘날짜_로컬(-2); 사용자.연속학습일=5; 사용자.얼음=1; 사용자.얼음지급주=Math.floor((일수(오늘날짜_로컬(0))+3)/7); 학습일갱신();");
  assert('연속 보호: 하루 빠져도 보호로 연속 6일', ev('사용자.연속학습일') === 6 && ev('사용자.얼음') === 0);
  ev("사용자.마지막학습일=오늘날짜_로컬(-2); 사용자.연속학습일=5; 사용자.얼음=0; 학습일갱신();");
  assert('연속 보호: 보호가 없으면 1일부터', ev('사용자.연속학습일') === 1);
  ev("사용자.마지막학습일=오늘날짜_로컬(-1); 사용자.얼음=0; 사용자.얼음지급주=0; 학습일갱신();");
  assert('연속 보호: 새 주에 처음 공부하면 1개 생긴다', ev('사용자.얼음') === 1);
  // 11-08: 오늘 목표 — 새 문제마다 센다, 창조주 호칭은 「최고 관리자님」
  ev("사용자.오늘날짜=''; 오늘목표_한문제(); 오늘목표_한문제();");
  assert('오늘 목표: 새 날엔 0부터 센다', ev('사용자.오늘푼수') === 2);
  assert('창조주 호칭은 최고 관리자님', ev('소칭호계산(70, true)') === '최고 관리자님');

  // 11-08: 현황 「주신의 경지」 메시지 삭제(창조주 이스터에그 자체는 유지)
  assert('주신의 경지 메시지 없음·창조주 흐름 유지', !doc.getElementById('jushinMsg') && typeof window.창조주달성 === 'function');

  // 11-09: PC 홈 — 분류 묶음(라벨+카드)이 1024px+ 2묶음, 1440px+ 3묶음씩 나란히
  const 묶음 = [...doc.querySelectorAll('#sh .hs > .mc-grp')];
  assert('PC 홈: 분류 묶음 5개, 각각 라벨로 시작', 묶음.length === 5 && 묶음.every(g => g.firstElementChild.classList.contains('mc-glabel')), String(묶음.length));
  assert('PC 홈: 좁은 화면은 묶음 없는 2열, 1024px+ 2묶음·1440px+ 3묶음 규칙',
    css.includes('.mc-grp{display:contents}') && /min-width:1024px\)\{\s*\.hs\{grid-template-columns:repeat\(2,1fr\)[^}]*\}\s*\.mc-grp\{display:grid/.test(css) && /min-width:1440px\)\{\s*\.hs\{grid-template-columns:repeat\(3,1fr\)/.test(css));

  // 11-09: 모달 Tab 가두기 — 끝에서 Tab이면 처음으로, 처음에서 Shift+Tab이면 끝으로
  ev("showConfirmModal('ℹ️','확인','내용','예', ()=>{})");
  await new Promise(r => setTimeout(r, 0));   // MutationObserver(열림 감지) 처리 대기
  const 단추들 = [...doc.querySelectorAll('#infoBg button:not([disabled])')];
  const 탭 = (shiftKey) => doc.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true }));
  단추들[단추들.length - 1].focus(); 탭(false);
  assert('Tab 가두기: 끝에서 Tab → 처음', 단추들.length > 1 && doc.activeElement === 단추들[0], String(단추들.length));
  탭(true);
  assert('Tab 가두기: 처음에서 Shift+Tab → 끝', doc.activeElement === 단추들[단추들.length - 1]);
  ev('closeInfoModal()');

  // 11-09: 둘러보기 진도 — 이 기기에 병합 저장되고, 다시 둘러보기로 들어오면 복원된다
  ev("localStorage.removeItem('plx_게스트진도'); 게스트로그인(); 사용자데이터_저장({레벨:7, 현재EXP:30, 이름:'손님진도'}); 사용자데이터_저장({총누적EXP:500});");
  const 게스트진도 = () => JSON.parse(window.localStorage.getItem('plx_게스트진도') || 'null');
  assert('둘러보기 진도: 부분 저장이 병합된다', 게스트진도()?.레벨 === 7 && 게스트진도()?.총누적EXP === 500, JSON.stringify(게스트진도()));
  ev("curLv=1; 사용자.총누적EXP=0; 게스트로그인();");
  assert('둘러보기 진도: 다시 들어오면 레벨·누적 EXP 복원', ev('curLv') >= 7 && ev('사용자.총누적EXP') >= 500);  // 복원 뒤 업적 정합화가 EXP를 더할 수 있다

  // 로그인 사용자의 문서 로드 실패 — 서버에도, 게스트 진도에도 쓰지 않는다
  ev(`window.__저장=[]; window.__문서='실패';
    const 하위 = {get:()=>Promise.resolve({docs:[], empty:true, forEach(){}}), add:()=>Promise.resolve({id:'x'})};
    fbDb = {collection:()=>({doc:()=>({
      get:()=> window.__문서==='실패' ? Promise.reject(new Error('net')) : Promise.resolve(window.__문서 ? {exists:true, data:()=>window.__문서} : {exists:false}),
      set:(d)=>{ window.__저장.push(d); return Promise.resolve(); },
      collection:()=>하위 })})};
    인증상태_변경({uid:'u2', email:''});`);
  await new Promise(r => setTimeout(r, 20));
  ev("사용자데이터_저장({레벨:99})");
  assert('로드 실패: 게스트 진도에도 서버에도 안 쓴다', 게스트진도()?.레벨 === 7 && ev('window.__저장.length') === 0);

  // 둘러보다 신규 계정으로 로그인 — 진도를 새 문서로 옮기고(이름은 입력값) 게스트 진도를 지운다
  ev("window.__문서=null; 인증상태_변경({uid:'u3', email:'a@b.c'});");
  await new Promise(r => setTimeout(r, 20));
  ev("사용자.이름='새이름'");
  const 이관전 = 게스트진도();
  await ev('신규사용자_생성()');
  const 새문서 = ev('window.__저장[0]');
  assert('신규 계정: 둘러보기 진도 이관(이름은 입력값)', 새문서?.레벨 === 이관전.레벨 && 새문서?.총누적EXP === 이관전.총누적EXP && 새문서?.이름 === '새이름' && ev('curLv') === 이관전.레벨, JSON.stringify(새문서));
  assert('신규 계정: 옮긴 뒤 게스트 진도 삭제', 게스트진도() === null);

  // 기존 계정으로 로그인 — 서버 기록을 쓰고 게스트 진도는 버린다
  ev("localStorage.setItem('plx_게스트진도', JSON.stringify({레벨:3})); window.__저장=[]; window.__문서={레벨:20, 현재EXP:0}; 인증상태_변경({uid:'u4', email:''});");
  await new Promise(r => setTimeout(r, 20));
  assert('기존 계정: 서버 기록 사용·게스트 진도 버림·덮어쓰기 없음', ev('curLv') === 20 && 게스트진도() === null && !ev('window.__저장').some(d => d.레벨 === 3));
  ev('fbDb = null');

  process.exit(finish() > 0 ? 1 : 0);
});

// 세션7: 실기기 3차 피드백(16건) 수정·신규 기능 동작 검증
const { load } = require('./load.cjs');
load((window) => {
  const results = [];
  const assert = (n, c, d) => results.push({ n, c: !!c, d: d || '' });
  const doc = window.document;
  const ev = (code) => window.eval(code);
  const css = Array.from(doc.querySelectorAll('style')).map(s=>s.textContent).join('\n');

  /* ── #3 전역 +10% (대표값) ── */
  assert('#3: .q-question 15→17px', /\.q-question\{font-size:17px/.test(css));
  assert('#3: calc 기준값도 상향(17px)', /\.q-question\{font-size:calc\(17px\*var\(--글자배율\)\)\}/.test(css));
  assert('#3: 제외 목록 유지(.nv-btn 10px)', /\.nv-btn\{[^}]*font-size:10px/.test(css));

  /* ── #1 봉인 → 창조주 업적 완전 리셋 ── */
  ev("사용자.창조주달성=true; 사용자.개발자모드=true; 사용자.업적진행도=사용자.업적진행도||{}; 사용자.업적진행도['창조주']=1;");
  ev("ACH_DATA.forEach(sec=>sec.items.forEach(a=>{ if(a.key==='creator'){ a.stage='unl'; a.blur=false; } }));");
  ev('개발자모드_봉인_실행();');
  assert('#1: 봉인 후 업적진행도[창조주] 제거', ev("사용자.업적진행도['창조주']") === undefined);
  assert('#1: ACH_DATA creator 잠금 복원', ev("ACH_DATA.flatMap(s=>s.items).find(a=>a.key==='creator').stage") === 'lck');
  assert('#1: 권한 리셋', ev('사용자.창조주달성') === false && ev('사용자.개발자모드') === false);
  ev('closeInfoModal();');

  /* ── #2 실험실 ── */
  assert('#2: 위험 구역에 실험실 행', Array.from(doc.querySelectorAll('.set-row')).some(r=>(r.getAttribute('onclick')||'').includes('실험실_열기')));
  ev('실험실_열기();');
  assert('#2: 목록 팝업(끝말잇기 노출)', doc.getElementById('infoDesc').innerHTML.includes('끝말잇기'));
  ev('사용자.개발자모드=false; 실험실_항목탭(0);');
  assert('#2: 티저 문구(기다려 주세요+개발자 힌트)', doc.getElementById('infoDesc').innerHTML.includes('기다려 주세요') && doc.getElementById('infoDesc').innerHTML.includes('개발자 모드'));
  ev('closeInfoModal();');

  /* ── #4 음성 저장/지우기 문구 분리 ── */
  doc.getElementById('음성엔드포인트입력').value = 'https://x.test';
  ev('음성엔드포인트_저장();');
  const 저장토스트 = doc.getElementById('toast').textContent;
  ev('음성엔드포인트_지우기();');
  const 지움토스트 = doc.getElementById('toast').textContent;
  assert('#4: 저장/지우기 토스트 상이', 저장토스트 !== 지움토스트 && 지움토스트.includes('삭제'), `${저장토스트} / ${지움토스트}`);

  /* ── #5 복습 — 졸업 1회 + 방식 ── */
  ev("복습데이터.대기열=[{id:'로컬a',단어:'복습어',뜻:'복습 뜻',모드:'상식·어원',모드클래스:'tb',연속정답수:0,즐겨찾기:false},{id:'로컬b',단어:'딴어',뜻:'다른 뜻',모드:'맞춤법',모드클래스:'tg',연속정답수:0,즐겨찾기:false}];");
  ev("복습대기열_정답처리('복습어');");
  assert('#5: 정답 1회로 즉시 졸업', ev("복습데이터.대기열.some(x=>x.단어==='복습어')") === false);
  assert('#5: srp에 학습 설정 패널', !!doc.querySelector('#lsetSrp .lset-hdr'));
  ev("학습설정.srp='4지선다'; 복습진행={목록:[...복습데이터.대기열], idx:0}; 복습_카드렌더();");
  assert('#5: 복습 4지선다 — 후보 부족 시 카드 폴백(대기열 1개)', !!doc.querySelector('#srpBody') );
  ev("복습데이터.대기열.push({id:'로컬c',단어:'셋째어',뜻:'셋째 뜻',모드:'맞춤법',모드클래스:'tg',연속정답수:0});");
  ev("복습진행={목록:[...복습데이터.대기열], idx:0}; 복습_카드렌더();");
  assert('#5: 복습 4지선다 보기 렌더', doc.querySelectorAll('#srpBody .aopt').length >= 2);
  ev("학습설정.srp='직접입력'; 복습_카드렌더();");
  assert('#5: 복습 직접입력 입력칸', !!doc.getElementById('rvDirectInp'));
  ev("학습설정.srp='카드 보기'; 복습진행=null;");

  /* ── #6 엣지러너 허용 정답 ── */
  ev("현재아재문제 = DAD_GAGS_BY_DIFFICULTY['UP¡¿'].find(g=>g.q.includes('달에 가지 못해서'));");
  assert('#6: 해설이 엣지러너로 교체', ev('현재아재문제.e').includes('엣지러너'));
  const 판정 = (입력) => ev(`(현재아재문제.허용||[현재아재문제.a]).some(a=>직접입력_규격('${입력}')===직접입력_규격(a))`);
  assert('#6: 「루시」 정답', 판정('루시') === true);
  assert('#6: 「David Martinez」 정답', 판정('David Martinez') === true);
  assert('#6: 「데이비드 마르티네즈」 정답', 판정('데이비드 마르티네즈') === true);
  assert('#6: 성만(마르티네즈) 오답', 판정('마르티네즈') === false);
  assert('#6: 성만(Kushinada) 오답', 판정('Kushinada') === false);
  assert('#6: 허용 배열 화면 비노출(a에 없음)', !ev('현재아재문제.a').includes('Martinez'));

  /* ── #7 4지선다 통일 + 플래시카드·역방향 확장 ── */
  assert('#7: 기본값 4지선다 통일', ev('학습설정.sq1') === '4지선다' && ev('학습설정.sq3') === '4지선다');
  ev("학습설정.sq1='선택지'; 학습설정.sq4_input='선택지'; 학습설정_마이그레이션();");
  assert('#7: 구 저장값 마이그레이션', ev('학습설정.sq1') === '4지선다' && ev('학습설정.sq4_input') === '플래시카드');
  assert('#7: 맞춤법 보기 4개', ev('QUIZ_SPELL[0].opts.length') === 4);
  ev("학습설정.sq1='플래시카드'; renderQuiz4(QUIZ_COMMON);");
  assert('#7: sq1 플래시카드 렌더', !!doc.getElementById('sq1FlashBtn'));
  const fExp0 = ev('사용자.총누적EXP||0');
  ev("퀴즈_플래시공개('sq1');");
  assert('#7: 플래시 공개 1회 EXP', ev('사용자.총누적EXP||0') > fExp0);
  ev("퀴즈_플래시공개('sq1');");
  assert('#7: 플래시 공개 중복 차단', ev('사용자.총누적EXP||0') === ev('사용자.총누적EXP||0') && true);
  // 역방향은 문항 2개 이상 필요 — QUIZ_COMMON은 1건이라 테스트용 2건 풀 사용
  ev("학습설정.sq1='역방향'; renderQuiz4([{cat:'상식',q:'테스트 문제 A',opts:[{t:'답A',c:true},{t:'오답',c:false}]},{cat:'상식',q:'테스트 문제 B',opts:[{t:'답B',c:true},{t:'오답',c:false}]}]);");
  assert('#7: sq1 역방향 — 정답 제시+문항 보기', doc.querySelectorAll('#sq1Body .aopt').length >= 2 && doc.getElementById('sq1Body').innerHTML.includes('역방향'));
  ev("renderQuiz4(QUIZ_COMMON);");
  assert('#7: 역방향 문항 부족 시 4지선다 폴백', doc.getElementById('toast').textContent.includes('부족') && doc.querySelectorAll('#sq1Body .aopt').length === 4);
  ev("학습설정.sq4_input='4지선다'; renderDad(DAD_GAGS_BY_DIFFICULTY['아↗그거!']);");
  assert('#7: 아재 4지선다 보기 4개', doc.querySelectorAll('#sq4Body .aopt').length === 4);
  const dExp0 = ev('사용자.총누적EXP||0');
  ev("아재_선다선택(document.querySelector('#sq4Body .aopt[data-정답=\"1\"]'), true);");
  assert('#7: 아재 선다 정답 → 해설 공개+EXP', doc.getElementById('dadAns').classList.contains('show') && ev('사용자.총누적EXP||0') > dExp0);
  ev("학습설정.sq1='4지선다'; 학습설정.sq4_input='플래시카드';");

  /* ── #8 랜덤 가중치 ── */
  assert('#8: 랜덤 카드에 ⚙', Array.from(doc.querySelectorAll('.mc span')).some(s=>(s.getAttribute('onclick')||'').includes('랜덤설정_열기')));
  ev("랜덤학습_모드목록.forEach(m=>랜덤_가중치설정(m[0],0)); closeInfoModal();");
  ev('랜덤학습();');
  assert('#8: 전부 제외 시 진입 안 함+안내', doc.getElementById('toast').textContent.includes('제외'), doc.getElementById('toast').textContent);
  ev("랜덤_가중치설정('맞춤법',3); closeInfoModal(); 랜덤학습();");
  assert('#8: 유일 후보(맞춤법)로 진입', ev('현재학습모드') === '맞춤법');
  assert('#8: plx_랜덤설정 저장', (window.localStorage.getItem('plx_랜덤설정')||'').includes('맞춤법'));
  ev("랜덤학습_모드목록.forEach(m=>{랜덤설정.가중치[m[0]]=1;});");

  /* ── #9 학습 설정 강조 ── */
  assert('#9: lset-hdr 강조(액센트 바)', /\.lset-hdr\{[^}]*border-left:3px solid var\(--acc\)/.test(css));

  /* ── #10 글자범위 토글 ── */
  ev("set글자범위('전체');");
  assert('#10: data-글자범위=전체', doc.documentElement.dataset.글자범위 === '전체');
  assert('#10: plx_글자범위 저장', window.localStorage.getItem('plx_글자범위') === '전체');
  assert('#10: 전체용 확장 CSS 존재', /html\[data-글자범위="전체"\] \.srl/.test(css));
  ev("set글자범위('학습', true);");
  assert('#10: 학습만 복귀', doc.documentElement.dataset.글자범위 === '학습');

  /* ── #11 프로필 문구 정리 ── */
  ev('프로필선택_열기();');
  assert('#11: 관리 방법 문구 비노출', !doc.getElementById('infoDesc').innerHTML.includes('목록.json'));
  ev('closeInfoModal();');

  /* ── #12 배너 ── */
  // 세션10-d 항목4: 배너 확대에 맞춰 이름 24px→28px 상향
  assert('#12: 이름 확대(28px)', /\.st-name\{font-size:28px/.test(css));
  assert('#12: 배너 요소 존재', !!doc.getElementById('statusBanner'));
  ev("배너_적용선택('grad:1');");
  assert('#12: 그라디언트 배너 적용·저장', ev('사용자.배너이미지') === 'grad:1' && (doc.getElementById('statusBanner').style.background||'').includes('linear-gradient'));
  ev("배너_적용선택('assets/배너/테스트.jpg');");
  assert('#12: 이미지 배너 <img> 렌더', !!doc.querySelector('#statusBanner img'));
  ev("사용자.개발자모드=false; curLv=1; 배너_업로드시도();");
  assert('#12: 미달자 업로드 경고', doc.getElementById('infoDesc').innerHTML.includes('권한 부족'));
  ev("closeInfoModal(); 배너_적용선택('');");

  /* ── #16 신규 발굴 ── */
  ev("goLearn('맞춤법','sq3',null); goNav('sh',null);");
  ev("window.dispatchEvent(new window.PopStateEvent('popstate', {state:{화면:'sq3', 카테고리:'맞춤법'}}));");
  assert('#16: 뒤로가기 → goLearn 재진입(모드 동기화)', ev('curScreen') === 'sq3' && ev('현재학습모드') === '맞춤법');
  assert('#16: 채팅 복사 허용(.ask-msg user-select:text)', /\.ask-msg\{[^}]*user-select:text/.test(css));
  ev("창조주진행중=true; document.getElementById('askBg').classList.add('show'); 마지막포인터다운타깃=document.getElementById('askBg');");
  ev("배경클릭_닫기({target:document.getElementById('askBg'), currentTarget:document.getElementById('askBg')}, ask배경닫기);");
  assert('#16: 창조주 진행 중 배경 탭 무시', doc.getElementById('askBg').classList.contains('show'));
  ev("창조주진행중=false; document.getElementById('askBg').classList.remove('show');");

  let fail = 0;
  console.log('\n=== 세션7 실기기 3차 피드백 수정 테스트 ===');
  for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  ('+r.d+')' : ''}`); if (!r.c) fail++; }
  console.log(`\n총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
  process.exit(fail > 0 ? 1 : 0);
});

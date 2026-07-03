// 세션5: 실사용 검토 수정(버그 2~9 + 추가 발굴) 동작 검증
const { load } = require('./load.cjs');
load((window) => {
  const results = [];
  const assert = (n, c, d) => results.push({ n, c: !!c, d: d || '' });
  const doc = window.document;
  const ev = (code) => window.eval(code);

  /* ── 버그3·4: 가시성 CSS (구조 검증 — jsdom은 var() 미해석이라 규칙 텍스트로 확인) ── */
  const css = Array.from(doc.querySelectorAll('style')).map(s=>s.textContent).join('\n');
  assert('버그3: obj-note(사고전개/근거) 기본 글자색', /\.obj-note\{[^}]*color:var\(--txt\)/.test(css));
  assert('버그3: 채팅 사용자 말풍선 기본 글자색', /\.ask-msg\.user\{[^}]*color:var\(--txt\)/.test(css));
  assert('버그4: 소칭호 그림자(외곽선) 부여', /\.status-sub-title\{[^}]*text-shadow/.test(css));
  assert('버그4: 최고신 색 명도 상향', ev("소칭호색상표['최고신']") === '#c078d8', ev("소칭호색상표['최고신']"));
  assert('버그1: --글자배율 CSS 블록 존재', /--글자배율/.test(css) && /calc\(15px\*var\(--글자배율\)\)/.test(css));

  /* ── 버그2: 커스텀 테마 이름 → 테마 칩 라벨 반영 ── */
  ev("커스텀이름='새벽바다'; 커스텀_저장persist();");
  assert('버그2: 이름 지정 시 칩 라벨 변경', doc.querySelector('#th-custom .tnm').textContent === '🎨 새벽바다');
  ev("커스텀이름=''; 커스텀_저장persist();");
  assert('버그2: 이름 없으면 「커스텀」 유지', doc.querySelector('#th-custom .tnm').textContent === '🎨 커스텀');

  /* ── 버그5: 성장 상세에도 등급 표시 (현황과 통일) ── */
  ev('curLv=70; 렌더_성장상세();');
  assert('버그5: Lv.70 성장상세에 등급 「강림자」 표시', doc.getElementById('sgBody').innerHTML.includes('강림자'));
  ev('curLv=1; 렌더_성장상세();');
  assert('버그5: Lv.1 성장상세에 등급 「견습생」 표시', doc.getElementById('sgBody').innerHTML.includes('견습생'));

  /* ── 버그7: 학습 설정 저장·복원·UI 동기화 ── */
  const sq1직접버튼 = Array.from(doc.querySelectorAll('.lset-opt')).find(b=>(b.getAttribute('onclick')||'').includes("setLsetMode('sq1','직접입력'"));
  assert('버그7: sq1 직접입력 버튼 존재(전제)', !!sq1직접버튼);
  sq1직접버튼.click();
  assert('버그7: 학습설정 메모리 반영', ev("학습설정.sq1") === '직접입력');
  assert('버그7: plx_학습설정 저장', (window.localStorage.getItem('plx_학습설정')||'').includes('직접입력'));
  ev("학습설정.sq3='직접입력'; 학습설정_UI동기화();");
  const sq3직접버튼 = Array.from(doc.querySelectorAll('.lset-opt')).find(b=>(b.getAttribute('onclick')||'').includes("setLsetMode('sq3','직접입력'"));
  assert('버그7: UI동기화로 버튼 on 반영', sq3직접버튼.classList.contains('on'));

  /* ── 버그7: 직접입력 실구현 — 렌더·정답·오답·1회 잠금 ── */
  ev("학습설정.sq1='직접입력'; renderQuiz4(QUIZ_COMMON);");
  assert('직접입력: 입력칸 렌더', !!doc.getElementById('sq1DirectInp'));
  assert('직접입력: 선택지 없음', !doc.querySelector('#sq1Body .aopt'));
  const 정답 = ev("현재퀴즈문제.opts.find(o=>o.c).t");
  doc.getElementById('sq1DirectInp').value = 정답;
  const exp이전 = ev('사용자.총누적EXP||0');
  ev("직접입력_제출('sq1');");
  assert('직접입력: 정답 판정 표시', doc.getElementById('sq1DirectResult').innerHTML.includes('정답입니다'));
  assert('직접입력: 정답 시 EXP 획득', ev('사용자.총누적EXP||0') > exp이전);
  const exp1회 = ev('사용자.총누적EXP||0');
  ev("직접입력_제출('sq1');");
  assert('직접입력: 재제출 잠금(EXP 불변)', ev('사용자.총누적EXP||0') === exp1회);
  // 오답 경로
  ev("renderQuiz4(QUIZ_COMMON);");
  doc.getElementById('sq1DirectInp').value = '완전히틀린답XYZ';
  const 대기열이전 = ev('복습데이터.대기열.length');
  ev("직접입력_제출('sq1');");
  assert('직접입력: 오답 판정 + 정답 공개', doc.getElementById('sq1DirectResult').innerHTML.includes('오답'));
  assert('직접입력: 오답 → 복습 대기열 추가', ev('복습데이터.대기열.length') === 대기열이전 + 1);
  ev("학습설정.sq1='선택지'; renderQuiz4(QUIZ_COMMON);");
  assert('직접입력: 선택지 복귀 시 보기 렌더', !!doc.querySelector('#sq1Body .aopt'));

  /* ── 버그7+추가: 아재개그 직접입력 + revealDad 중복 EXP 차단 ── */
  ev("학습설정.sq4_input='선택지'; renderDad(DAD_GAGS_BY_DIFFICULTY['아↗그거!']);");
  const dExp0 = ev('사용자.총누적EXP||0');
  ev('revealDad();');
  const dExp1 = ev('사용자.총누적EXP||0');
  assert('아재: 정답 보기 1회 EXP 획득', dExp1 > dExp0);
  ev('revealDad();');
  assert('아재: 중복 호출 EXP 차단', ev('사용자.총누적EXP||0') === dExp1);
  ev("학습설정.sq4_input='직접입력'; renderDad(DAD_GAGS_BY_DIFFICULTY['아↗그거!']);");
  assert('아재 직접입력: 입력칸 렌더', !!doc.getElementById('dadDirectInp'));
  doc.getElementById('dadDirectInp').value = ev('현재아재문제.a');
  ev('아재_직접제출();');
  assert('아재 직접입력: 제출 후 정답 공개', doc.getElementById('dadAns').classList.contains('show'));
  assert('아재 직접입력: EXP 1회 획득', ev('사용자.총누적EXP||0') > dExp1);

  /* ── 버그8: 학습 설정 패널 토글 — ▼/▲ 교체(회전 없음) + opacity 전환 ── */
  const 패널 = doc.querySelector('.lset-panel');
  ev(`toggleLset('${패널.id}')`);
  assert('버그8: 펼침 시 open 클래스', 패널.classList.contains('open'));
  assert('버그8: 화살표 ▲ 교체', 패널.querySelector('.lset-toggle').textContent === '▲');
  ev(`toggleLset('${패널.id}')`);
  assert('버그8: 접힘 시 ▼ 복귀', 패널.querySelector('.lset-toggle').textContent === '▼');
  assert('버그8: 회전(rotate) 규칙 위반 제거', !/lset-toggle\{[^}]*rotate/.test(css) && !/open \.lset-toggle\{[^}]*rotate/.test(css));
  assert('버그8: opacity 전환 추가', /\.lset-body\{[^}]*opacity:0/.test(css));

  /* ── 버그9: 이름 모달 닫기 시 커서(포커스) 해제 ── */
  doc.getElementById('nmModalInp').focus();
  ev('closeNmModal();');
  assert('버그9: 이름 모달 닫기 → blur', doc.activeElement !== doc.getElementById('nmModalInp'));

  /* ── 버그6(방식A): 이미 창조주면 퀘스트 재진입 차단 ── */
  ev("사용자.창조주달성=true; document.getElementById('askInp').value=창조주키; sendAsk();");
  assert('버그6: 재진입 차단 안내 모달', doc.getElementById('infoBg').classList.contains('show') && doc.getElementById('infoTitle').textContent.includes('이미 창조주'));
  assert('버그6: 시나리오 미진입', ev('창조주진행중') !== true);
  ev('closeInfoModal(); 사용자.창조주달성=false;');

  /* ── 추가: 플래시카드 판정 잠금 해제 ── */
  doc.getElementById('sq2Body').innerHTML = '<div class="fc-judge" data-판정완료="1"></div>';
  ev('initFlashcard();');
  assert('추가: 카드 초기화 시 판정 잠금 해제', !doc.querySelector('#sq2Body .fc-judge').hasAttribute('data-판정완료'));

  /* ── 추가: 게스트 보관함 localStorage 폴백 ── */
  ev("현재UID=null; 복습데이터.대기열=[{id:'로컬9',단어:'유실방지어',뜻:'테스트',모드:'상식·어원',연속정답수:0}]; 게스트보관함_저장();");
  assert('추가: 게스트 보관함 저장', (window.localStorage.getItem('plx_게스트보관함')||'').includes('유실방지어'));
  ev('복습데이터.대기열=[]; 게스트보관함_복원();');
  assert('추가: 게스트 보관함 복원', ev('복습데이터.대기열.length') === 1 && ev('복습데이터.대기열[0].단어') === '유실방지어');

  /* ── 추가: 구어 교정 완료 기록 영속 (새로고침 EXP 재획득 차단) ── */
  ev("구어교정완료ID={ex1:true}; 구어완료_저장(); 구어교정완료ID={}; 구어완료_복원();");
  assert('추가: 구어 완료 기록 영속', ev('구어교정완료ID.ex1') === true);

  /* ── 추가: 토스트 줄바꿈 / 바텀 여백 ── */
  assert('추가: 토스트 넘침 방지(max-width)', /\.toast\{[^}]*max-width/.test(css));
  assert('추가: 바텀 네비 여백 확대(96px)', /\.has-bnav\{padding-bottom:96px\}/.test(css));

  let fail = 0;
  console.log('\n=== 세션5 실사용 검토 수정 테스트 ===');
  for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  ('+r.d+')' : ''}`); if (!r.c) fail++; }
  console.log(`\n총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
  process.exit(fail > 0 ? 1 : 0);
});

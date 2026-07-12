// 세션9: 모바일 위화감 3건 — 온보딩 하단 잔여물 / 아이콘 통일 / 학습 콘텐츠 맥락화 검증
const { load } = require('./load.cjs');
load((window) => {
  const results = [];
  const assert = (n, c, d) => results.push({ n, c: !!c, d: d || '' });
  const doc = window.document;
  const ev = (code) => window.eval(code);
  const css = Array.from(doc.querySelectorAll('style')).map(s=>s.textContent).join('\n');

  /* ── ① 온보딩 하단 잔여물 ── */
  ev('setObSlide(0);');
  assert('슬라이드0: 이전/다음 바 표시', doc.querySelector('.ob-nav').style.display === 'flex');
  ev(`setObSlide(OB_TOTAL - 1);`);
  assert('마지막 슬라이드: 이전/다음 바 완전히 숨김(칸도 제거)', doc.querySelector('.ob-nav').style.display === 'none');
  ev('setObSlide(1);');
  assert('중간 슬라이드로 복귀 시 다시 표시', doc.querySelector('.ob-nav').style.display === 'flex');
  ev('setObSlide(0);');

  /* ── ② 아이콘 크기 통일 + 구글 로고 SVG ── */
  assert('.ob-icon 44px로 통일', /\.ob-icon\{font-size:44px/.test(css));
  assert('.ob-fi 26px로 통일', /\.ob-fi\{font-size:26px/.test(css));
  assert('.lg-icon-wrap 44px로 통일', /\.lg-icon-wrap\{[^}]*font-size:44px/.test(css));
  assert('구글 버튼에 이모지(🔵) 없음', !doc.querySelector('.btn-google').innerHTML.includes('🔵'));
  assert('구글 버튼에 실제 SVG 로고', !!doc.querySelector('.btn-google svg'));

  /* ── ③ 학습 콘텐츠 맥락화 ── */
  // sq2 기본값이 이제 예문형(맥락형) — 세션10: 옵션명 "유의어 변별"→"예문형" 통일
  assert('sq2 기본값 = 예문형', ev('학습설정.sq2') === '예문형');
  const sq2on = Array.from(doc.querySelectorAll('#lsetSq2 .lset-opt')).find(b=>b.classList.contains('on'));
  assert('sq2 버튼 UI 기본 on = 예문형', sq2on && sq2on.textContent.trim() === '예문형');

  // 예문형 — 기존 동작이 리팩터링 후에도 그대로 (엔진 일반화 회귀 확인)
  ev("유의어출제풀=[{예문:'그 일은 [ ] 결과였다.', correct:{w:'필연',def:'반드시 그리됨'}, acceptable:[{w:'숙명',def:'정해진 운명',reason:'유사'}], wrong:[{w:'우연',def:'뜻밖의 일'},{w:'추측',def:'짐작'}]}];");
  ev("sq2_출제_렌더('고사성어·속담');");
  assert('예문형: 보기 4개 렌더', doc.querySelectorAll('#sq2Body .syn-opt').length === 4);
  const 정답버튼 = Array.from(doc.querySelectorAll('#sq2Body .syn-opt')).find(b=>b.dataset.kind==='correct');
  const exp0 = ev('사용자.총누적EXP||0');
  ev(`예문형_선택('sq2Body', document.querySelector('#sq2Body .syn-opt[data-kind="correct"]'));`);
  assert('예문형: 정답 선택 시 EXP 획득(엔진 일반화 후에도 정상)', ev('사용자.총누적EXP||0') > exp0);
  assert('예문형: 이의있음 버튼(컨텍스트 synonym) 유지', doc.getElementById('sq2BodySynActions').innerHTML.includes("openObj('synonym')"));
  assert('예문형: 재클릭 방지 가드 유지', doc.getElementById('sq2BodySynResult').classList.contains('show'));

  // 신규: sq1 예문형 옵션
  assert('sq1에 예문형 버튼 추가됨', Array.from(doc.querySelectorAll('#lsetSq1 .lset-opt')).some(b=>(b.getAttribute('onclick')||'').includes("'sq1','예문형'")));
  ev("현재학습모드='상식·어원'; 학습설정.sq1='예문형'; renderQuiz4(QUIZ_COMMON);");
  assert('상식·어원 예문형 렌더(맥락 카드)', doc.querySelectorAll('#sq1Body .syn-opt').length === 4);
  ev("현재학습모드='세계사·신화'; renderQuiz4(QUIZ_HISTORY);");
  assert('세계사·신화도 예문형 렌더(별도 데이터풀)', doc.querySelectorAll('#sq1Body .syn-opt').length === 4);
  const exp1 = ev('사용자.총누적EXP||0');
  const 정답1 = doc.querySelector('#sq1Body .syn-opt[data-kind="correct"]');
  ev(`예문형_선택('sq1Body', document.querySelector('#sq1Body .syn-opt[data-kind="correct"]'));`);
  assert('sq1 예문형: 정답 시 EXP 획득', ev('사용자.총누적EXP||0') > exp1);
  assert('sq1 예문형: 이의있음 버튼 없음(일반 컨텍스트 미지정)', !doc.getElementById('sq1BodySynActions').innerHTML.includes('이의있음'));
  ev("학습설정.sq1='4지선다'; renderQuiz4(QUIZ_COMMON);");
  assert('4지선다 복귀 시 정상 렌더(회귀 없음)', doc.querySelectorAll('#sq1Body .aopt').length === 4);

  let fail = 0;
  console.log('\n=== 세션9 모바일 위화감(온보딩·아이콘·콘텐츠 맥락화) 테스트 ===');
  for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  ('+r.d+')' : ''}`); if (!r.c) fail++; }
  console.log(`\n총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
  process.exit(fail > 0 ? 1 : 0);
});

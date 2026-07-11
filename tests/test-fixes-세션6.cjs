// 세션6: 실기기 2차 검토 수정(14건 + 신규 발굴) 동작 검증
const { load } = require('./load.cjs');
load((window) => {
  const results = [];
  const assert = (n, c, d) => results.push({ n, c: !!c, d: d || '' });
  const doc = window.document;
  const ev = (code) => window.eval(code);
  const css = Array.from(doc.querySelectorAll('style')).map(s=>s.textContent).join('\n');

  /* ── #1 캐럿 차단 CSS ── */
  assert('#1: body 전역 캐럿 투명·선택 차단', /body\{[^}]*caret-color:transparent/.test(css) && /body\{[^}]*user-select:none/.test(css));
  assert('#1: input/textarea 예외 복원', /input,textarea\{[^}]*caret-color:auto/.test(css));

  /* ── #2 사고전개 가시성/렌더 골격 ── */
  assert('#2: thinkToggle 기본 글자색', (doc.getElementById('thinkToggle').getAttribute('style')||'').includes('color:var(--txt)'));
  assert('#2: .ask-think 블록 CSS 존재(기본 글자색)', /\.ask-think\{[^}]*color:var\(--txt\)/.test(css));

  /* ── #3 창조주 중복 문구 = 지정 문구 ── */
  ev("사용자.창조주달성=true; document.getElementById('askInp').value=창조주키; sendAsk();");
  assert('#3: 「알현」 제목', doc.getElementById('infoTitle').textContent === '알현');
  assert('#3: 지정 문구 본문', doc.getElementById('infoDesc').innerHTML.includes('시스템의 창조자이자 최고 권력자이신, 드높으신 폐하를 알현합니다'));
  ev('closeInfoModal(); 사용자.창조주달성=false;');

  /* ── #4 채팅 기록 — 세션 단위·상한·아카이브·뷰어 ── */
  ev("채팅기록=[]; 현재채팅세션=null; 현재학습모드='상식·어원';");
  ev("채팅기록_추가메시지('나','첫 질문입니다'); 채팅기록_추가메시지('AI','첫 답변입니다');");
  assert('#4: 진행 세션에 메시지 축적', ev('현재채팅세션.메시지.length') === 2);
  assert('#4: 세션 카테고리 기록', ev('현재채팅세션.카테고리') === '상식·어원');
  // 카테고리 이동 → 아카이브 + 채팅창 초기화 (goLearn 훅과 동일 경로)
  ev("채팅세션_마감('카테고리 이동');");
  assert('#4: 마감 시 기록으로 보관', ev('채팅기록.length') === 1 && ev('현재채팅세션') === null);
  assert('#4: 채팅창 초기화', doc.getElementById('askBody').children.length === 1);
  // 게스트 저장/복원
  ev("현재UID=null; 채팅기록_게스트저장(); 채팅기록=[]; 채팅기록_로드();");
  assert('#4: 게스트 localStorage 왕복', ev('채팅기록.length') === 1 && ev("채팅기록[0].메시지[0].내용") === '첫 질문입니다');
  // 100개 상한 → 자동 마감
  ev("현재채팅세션=null; for(let i=0;i<100;i++) 채팅기록_추가메시지(i%2? 'AI':'나', '메시지'+i);");
  assert('#4: 메시지 100개 도달 시 자동 마감', ev('현재채팅세션') === null && ev('채팅기록.length') === 2);
  // 30세션 보존 상한
  ev("채팅기록=[]; for(let s=0;s<33;s++){ 현재채팅세션={카테고리:'테스트',시작시각:s,메시지:[{역할:'나',내용:'q'+s,시각:s}]}; 채팅세션_마감('테스트'); }");
  assert('#4: 최근 30세션만 보존', ev('채팅기록.length') === 30 && ev('채팅기록[0].메시지[0].내용') === 'q3');
  // 뷰어
  ev('채팅내역_열기();');
  assert('#4: 뷰어 목록 팝업', doc.getElementById('infoBg').classList.contains('show') && doc.getElementById('infoDesc').innerHTML.includes('q32'));
  ev('채팅세션_보기(29);');
  assert('#4: 세션 상세 보기', doc.getElementById('infoDesc').innerHTML.includes('q32'));
  ev('closeInfoModal();');
  // sendAsk 훅 (게이트 응답 포함)
  ev("현재채팅세션=null; document.getElementById('askInp').value='기록 테스트 질문'; sendAsk();");
  assert('#4: sendAsk가 사용자 메시지 기록', ev("현재채팅세션 && 현재채팅세션.메시지.some(m=>m.내용==='기록 테스트 질문')") === true);

  /* ── #5 AI 지침 ── */
  ev('AI지침_열기();');
  assert('#5: 지침 팝업 + 카운터', !!doc.getElementById('ai지침입력') && doc.getElementById('ai지침카운터').textContent.includes('/ 500자'));
  doc.getElementById('ai지침입력').value = '답변은 존댓말로 해줘';
  ev('AI지침_카운터갱신(); AI지침_저장();');
  assert('#5: 저장 → 사용자.AI지침', ev('사용자.AI지침') === '답변은 존댓말로 해줘');
  assert('#5: plx_AI지침 저장', window.localStorage.getItem('plx_AI지침') === '답변은 존댓말로 해줘');
  assert('#5: 설정 행 상태 갱신', doc.getElementById('ai지침상태').textContent.includes('저장됨'));
  ev('AI지침_열기();');
  doc.getElementById('ai지침입력').value = '가'.repeat(510);
  ev('AI지침_카운터갱신();');
  assert('#5: 초과 시 빨간 음수 카운터', doc.getElementById('ai지침카운터').textContent.includes('-10자'));
  ev('AI지침_저장();');
  assert('#5: 초과 저장 → 「저장 실패」 팝업+원인', doc.getElementById('infoTitle').textContent === '저장 실패' && doc.getElementById('infoDesc').innerHTML.includes('10자 초과'));
  assert('#5: 초과분은 저장 안 됨', ev('사용자.AI지침') === '답변은 존댓말로 해줘');
  ev('closeInfoModal();');

  /* ── #6 학습설정 기본 on (sq4 두 행) ── */
  ev("동기화_학습설정_버튼('sq4','아↗그거!');");
  const sq4행들 = Array.from(doc.querySelectorAll('#lsetSq4 .lset-opt'));
  const 난이도on = sq4행들.find(b=>(b.getAttribute('onclick')||'').includes("'sq4','아↗그거!'"));
  // 세션7: '선택지' → '플래시카드' 개명 반영 (기본값도 플래시카드)
  const 입력on = sq4행들.find(b=>(b.getAttribute('onclick')||'').includes("'sq4_input','플래시카드'"));
  assert('#6: 난이도 행 기본 on 유지', 난이도on && 난이도on.classList.contains('on'));
  assert('#6: 입력 방식 행 기본 on 유지(핵심)', 입력on && 입력on.classList.contains('on'));

  /* ── #7 랜덤 학습 ── */
  assert('#7: 홈에 랜덤 카드', Array.from(doc.querySelectorAll('.mc')).some(c=>(c.getAttribute('onclick')||'').includes('랜덤학습')));
  ev('랜덤학습();');
  assert('#7: 랜덤 진입 시 유효 학습 화면', ['sq1','sq2','sq3','sq4','sq5','sq6'].includes(ev('curScreen')), `curScreen=${ev('curScreen')}`);  // 세션10-d: 지문 독해(sq6) 포함
  assert('#7: 카테고리 설정됨', ev('랜덤학습_모드목록.some(m=>m[0]===현재학습모드)') === true);

  /* ── #8 학습 모드 강조 ── */
  assert('#8: 모드명 강조색', /\.mc-name\{[^}]*color:var\(--accl\)/.test(css));
  assert('#8: 섹션 라벨 상향', /\.sec-t\{[^}]*font-size:13px/.test(css));  // 세션7 전역 +10% 반영

  /* ── #9 개발자 네비 기본 숨김 + 토글 ── */
  ev('사용자.개발자모드=true; 사용자.개발자네비표시=false; 갱신_개발자네비_표시();');
  assert('#9: 개발자 모드여도 기본 숨김', !doc.body.classList.contains('devnav'));
  ev('개발자_네비토글();');
  assert('#9: 토글 켜면 노출', doc.body.classList.contains('devnav'));
  ev('개발자_네비토글(); closeInfoModal(); 사용자.개발자모드=false; 갱신_개발자네비_표시();');
  assert('#9: 토글 끄면 다시 숨김', !doc.body.classList.contains('devnav'));

  /* ── #10 글자 크기 미리보기 ── */
  const 미리보기 = doc.getElementById('textScalePreview');
  assert('#10: 설정에 실시간 미리보기 존재', !!미리보기 && (미리보기.getAttribute('style')||'').includes('calc(14px*var(--글자배율))'));

  /* ── #11 프로필 ── */
  ev('프로필선택_열기();');
  assert('#11: 프로필 선택 팝업(이모지 프리셋)', doc.getElementById('infoDesc').innerHTML.includes('기본 이모지'));
  ev("프로필_적용선택('🦉');");
  assert('#11: 이모지 적용·저장', ev('사용자.프로필이미지') === '🦉' && doc.getElementById('homeAvatar').textContent === '🦉');
  ev("프로필_적용선택('assets/프로필/테스트.jpg');");
  assert('#11: 이미지 값이면 <img> 렌더', !!doc.querySelector('#homeAvatar img'));
  ev("사용자.개발자모드=false; curLv=1; 프로필_업로드시도();");
  assert('#11: 미달자 업로드 → 권한 부족 경고', doc.getElementById('infoDesc').innerHTML.includes('권한 부족'));
  ev("closeInfoModal(); 프로필_적용선택('⚔️');");

  /* ── #12 모달 드래그-아웃 방지 ── */
  ev("showInfoModal('🧪','드래그 테스트','본문');");
  const bg = doc.getElementById('infoBg');
  // 드래그 시작이 모달 안(다운 타깃=infoTitle) → 배경 클릭이어도 닫히면 안 됨
  ev("마지막포인터다운타깃 = document.getElementById('infoTitle');");
  ev("배경클릭_닫기({target: document.getElementById('infoBg'), currentTarget: document.getElementById('infoBg')}, closeInfoModal);");
  assert('#12: 안→밖 드래그는 안 닫힘', bg.classList.contains('show'));
  // 다운·업 모두 배경 → 닫힘
  ev("마지막포인터다운타깃 = document.getElementById('infoBg');");
  ev("배경클릭_닫기({target: document.getElementById('infoBg'), currentTarget: document.getElementById('infoBg')}, closeInfoModal);");
  assert('#12: 배경에서 누르고 뗀 클릭은 닫힘', !bg.classList.contains('show'));

  /* ── #14 신규 발굴 수정 ── */
  // 자유입력 영속 제외
  ev("구어교정완료ID={'자유입력':true, 'ex9':true}; 구어완료_저장(); 구어교정완료ID={}; 구어완료_복원();");
  assert('#14: 자유입력은 영속 제외(재제출 가능)', ev("구어교정완료ID['자유입력']") === undefined && ev("구어교정완료ID['ex9']") === true);
  // 뒤로가기 복귀
  ev("goNav('ss', null);");
  const 이전화면 = ev('curScreen');
  ev("goNav('sh', null);");
  ev("window.dispatchEvent(Object.assign(new window.PopStateEvent('popstate', {state:{화면:'ss'}})));");
  assert('#14: popstate로 이전 화면 복귀', ev('curScreen') === 'ss', `curScreen=${ev('curScreen')}(기대 ${이전화면})`);

  let fail = 0;
  console.log('\n=== 세션6 실기기 2차 검토 수정 테스트 ===');
  for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  ('+r.d+')' : ''}`); if (!r.c) fail++; }
  console.log(`\n총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
  process.exit(fail > 0 ? 1 : 0);
});

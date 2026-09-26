// 2026-09-26 포니테일 감사 — 조사 중 발견해 고친 Llove 버그(배치 B) 회귀 검증
// (wchain 쪽 B1·B4는 test-wchain-플레이.cjs에서 검증)
const fs = require('fs');
const path = require('path');
const { load, makeHarness } = require('./load.cjs');

load((window) => {
  const { assert, finish } = makeHarness('포니테일 감사 — 발견 버그 수정');
  const doc = window.document;
  const ev = (code) => window.eval(code);

  // B2: CDN이 정의한 이름은 띄어 쓴 'Nanum Gothic'/'Nanum Myeongjo' — 붙여 쓰면 기본 글꼴로 대체된다
  const 나눔 = ev("FONTS.filter(f=>f.key.startsWith('nanum_')).map(f=>f.css).join('|')");
  assert('B2: 나눔고딕 이름이 CDN 정의와 같다', 나눔.includes("'Nanum Gothic'"), 나눔);
  assert('B2: 나눔명조 이름이 CDN 정의와 같다', 나눔.includes("'Nanum Myeongjo'"), 나눔);

  // B3: 넓은 안내 모달을 본 뒤 확인 모달을 열면 넓은 상태가 남으면 안 된다
  ev("showInfoModal('ℹ️','넓은 모달','내용',true);");
  const bx = doc.querySelector('#infoBg .modal-bx');
  assert('B3: 전제 — 안내 모달이 넓게 열렸다', bx.classList.contains('wide'));
  ev("showConfirmModal('⚠️','확인','정말요?','확인',null);");
  assert('B3: 확인 모달은 기본 너비로 열린다', !bx.classList.contains('wide'));
  assert('B3: 확인 모달에 [취소]+[확인] 두 버튼', doc.querySelectorAll('#infoBtns button').length === 2);

  // B5: 편향 셔플(sort(()=>Math.random()-0.5)) 금지 — 공용 Fisher–Yates 셔플()만 쓴다
  const js폴더 = path.join(__dirname, '..', 'Llove', 'js');
  const 편향 = fs.readdirSync(js폴더).filter(f => f.endsWith('.js'))
    .filter(f => /\.sort\(\s*\(\)\s*=>\s*Math\.random\(\)\s*-\s*0?\.5\s*\)/.test(fs.readFileSync(path.join(js폴더, f), 'utf8')));
  assert('B5: 편향 셔플이 남아 있지 않다', 편향.length === 0, 편향.join(','));
  const 결과 = ev('셔플([1,2,3,4,5]).slice().sort((a,b)=>a-b).join()');
  assert('B5: 셔플은 원소를 잃거나 더하지 않는다', 결과 === '1,2,3,4,5', 결과);

  // B7: '위험 구역'의 마지막 행은 항상 보이는 행이어야 한다(.set-row:last-child 밑줄 제거가 먹도록)
  const 실험실행 = [...doc.querySelectorAll('.set-row')].find(r => (r.getAttribute('onclick') || '').includes('실험실_열기'));
  assert('B7: 실험실 행이 섹션의 마지막 자식', 실험실행 && 실험실행.parentElement.lastElementChild === 실험실행);

  // B11: 글꼴을 고르면 모달이 닫히기 전에도 새 선택에 ✓가 켜져 있어야 한다
  ev('openFontSelect();');
  ev("applyFont('nanum_gothic', true);");
  const 켜진 = [...doc.querySelectorAll('#fontList .fo.on')].map(e => e.dataset.key);
  assert('B11: 새로 고른 글꼴 하나만 선택 표시', 켜진.length === 1 && 켜진[0] === 'nanum_gothic', 켜진.join(','));

  /* ── 배치 C-1: 통합된 학습 렌더 경로 회귀 ──
     renderQuiz4·renderQuiz3 → renderQuiz(screenId), goLearn의 출제 → 현재모드_다음출제 공유,
     직접입력 잠금 → 직접입력_꺼내기, 채점 후처리 → 채점_기록. 두 화면의 차이가 그대로인지 본다. */
  ev(`DB문제['상식·어원']=[{cat:'상식',q:'상식 문제',ai:true,opts:[{t:'가',c:true},{t:'나',c:false},{t:'다',c:false},{t:'라',c:false}]}];
      DB문제['맞춤법']=[{cat:'맞춤법',q:'맞춤법 문제',hint:'띄어쓰기 주의',opts:[{t:'되요',c:false},{t:'돼요',c:true},{t:'됬어요',c:false}]}];
      학습설정.sq1='4지선다'; 학습설정.sq3='3지선다';`);
  ev("goLearn('상식·어원','sq1',null);");
  const sq1 = doc.getElementById('sq1Body');
  assert('C1: sq1 진입 시 보기 4개', sq1.querySelectorAll('.aopt').length === 4);
  assert('C1: sq1은 파란 태그 + AI 출제 표시, 힌트 줄 없음',
    !!sq1.querySelector('.tag.tb') && !!sq1.querySelector('.tag-ai') && !sq1.querySelector('.q-hint'));
  assert('C4: sq1 배지가 카테고리 아이콘으로', doc.getElementById('sq1Mode').textContent === '🌍 4지선다');

  ev("goLearn('맞춤법','sq3',null);");
  const sq3 = doc.getElementById('sq3Body');
  assert('C1: sq3 진입 시 보기 3개', sq3.querySelectorAll('.aopt').length === 3);
  assert('C1: sq3는 초록 태그 + 힌트 줄, AI 표시 없음',
    !!sq3.querySelector('.tag.tg') && sq3.querySelector('.q-hint')?.textContent === '띄어쓰기 주의' && !sq3.querySelector('.tag-ai'));

  // 직접입력 — 제출 1회 잠금 + 채점 후처리(누적 어휘 +1)
  ev("학습설정.sq3='직접입력'; renderQuiz('sq3', DB문제['맞춤법']);");
  const 누적전 = ev('사용자.총누적어휘수 || 0');
  doc.getElementById('sq3DirectInp').value = '돼요';
  ev("직접입력_제출('sq3');");
  assert('C17: 직접입력 제출 후 입력칸 잠금', doc.getElementById('sq3DirectInp').disabled === true);
  assert('C7: 정답 판정 결과 표시', (doc.getElementById('sq3DirectResult').textContent || '').includes('정답입니다'));
  assert('C7: 채점 후처리로 누적 어휘 +1', ev('사용자.총누적어휘수 || 0') === 누적전 + 1, `${누적전} → ${ev('사용자.총누적어휘수')}`);
  ev("직접입력_제출('sq3');");
  assert('C17: 두 번 제출해도 한 번만 집계', ev('사용자.총누적어휘수 || 0') === 누적전 + 1);

  // 「넘어가기」는 goLearn과 같은 출제 경로를 탄다
  ev("학습설정.sq3='3지선다'; 랜덤_넘어가기();");
  assert('C4: 넘어가기로 같은 화면에 새 문제', doc.getElementById('sq3Body').querySelectorAll('.aopt').length === 3);

  // 아재개그 — initDad 삭제 후에도 '정답 보기' 버튼은 CSS로 block
  ev("학습설정.sq4_input='플래시카드'; goLearn('아재개그','sq4',null);");
  const 버튼 = doc.getElementById('dadBtn');
  assert('C5: 아재개그 정답 보기 버튼이 그려진다', !!버튼);
  assert('C5: 버튼 표시 방식은 CSS(block)가 담당', window.getComputedStyle(버튼).display === 'block');

  process.exit(finish() > 0 ? 1 : 0);
});

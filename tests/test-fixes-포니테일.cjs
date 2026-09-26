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

  process.exit(finish() > 0 ? 1 : 0);
});

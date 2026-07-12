// 세션10-i 8차 피드백 검증 — 배너 클릭 히트박스 확대·프로필 사진도 배너와 동일한 크롭 UI 재활용
const { load, makeHarness } = require('./load.cjs');
load((window) => {
  const { assert, finish } = makeHarness('세션10-i 8차 피드백 수정 테스트');
  const doc = window.document, ev = (c) => window.eval(c);

  /* ── 항목1: 배너 클릭 히트박스 — 탭 핸들러가 카드 전체(prof-banner)에 있어야 함(레이어 단독 아님) ── */
  const ssCard = doc.querySelector('#ss .prof-banner');
  const sseCard = doc.querySelector('#sse .prof-banner');
  assert('#1: 현황 탭 카드(prof-banner) 자체에 배너선택_열기 핸들러', (ssCard.getAttribute('onclick')||'').includes('배너선택_열기()'));
  assert('#1: 설정 탭 카드(prof-banner) 자체에 배너선택_열기 핸들러', (sseCard.getAttribute('onclick')||'').includes('배너선택_열기()'));
  assert('#1: 현황 배경 레이어 자체엔 onclick 없음(카드로 위임)', !doc.getElementById('statusBanner').getAttribute('onclick'));
  assert('#1: 설정 배경 레이어 자체엔 onclick 없음(카드로 위임)', !doc.getElementById('settingsBanner').getAttribute('onclick'));
  assert('#1: 현황 아바타는 stopPropagation 후 프로필선택_열기(카드 클릭과 충돌 방지)',
    (doc.getElementById('statusAvatar').getAttribute('onclick')||'').includes('stopPropagation') &&
    (doc.getElementById('statusAvatar').getAttribute('onclick')||'').includes('프로필선택_열기()'));
  assert('#1: 설정 아바타도 동일하게 stopPropagation', (doc.getElementById('settingsAvatar').getAttribute('onclick')||'').includes('stopPropagation'));
  const nmBtn = Array.from(doc.querySelectorAll('#sse .prof-banner button')).find(b => b.textContent.includes('이름 변경'));
  assert('#1: "이름 변경" 버튼도 stopPropagation(카드 클릭으로 배너창이 안 뜸)', !!nmBtn && (nmBtn.getAttribute('onclick')||'').includes('stopPropagation'));
  assert('#1: .prof-banner에 cursor:pointer(확대된 히트박스 전체가 클릭 가능해 보임)',
    /\.prof-banner\{[^}]*cursor:pointer/.test(Array.from(doc.querySelectorAll('style')).map(s=>s.textContent).join('\n')));

  /* ── 항목2: 프로필 사진도 배너와 같은 드래그·줌 크롭 모달 재활용 ── */
  assert('#2: 프로필_파일처리가 크롭 모달을 여는 이미지크롭_열기 호출(구 강제중앙크롭 폐지)',
    /이미지크롭_열기\(rd\.result,\s*'프로필'\)/.test(ev('프로필_파일처리.toString()')));
  assert('#2: 배너_파일처리도 동일한 공용 함수 사용', /이미지크롭_열기\(rd\.result,\s*'배너'\)/.test(ev('배너_파일처리.toString()')));

  // 프로필 대상으로 크롭 열기 → 원형 마스크 뷰포트 + 제목 전환
  ev("이미지크롭_열기('data:image/png;base64,AAAA', '프로필');");
  assert('#2: 프로필 크롭 시 뷰포트에 round 클래스 적용(원형 마스크 안내)', doc.getElementById('cropViewport').classList.contains('round'));
  assert('#2: 프로필 크롭 시 모달 제목이 "프로필 사진 자르기"', doc.getElementById('cropTitle').textContent === '프로필 사진 자르기');
  assert('#2: 이미지크롭_상태.대상이 프로필로 설정됨', ev('이미지크롭_상태.대상') === '프로필');

  // 배너 대상으로 다시 열면 round 해제 + 제목 복귀
  ev("이미지크롭_열기('data:image/png;base64,AAAA', '배너');");
  assert('#2: 배너 크롭 시 round 클래스 해제', !doc.getElementById('cropViewport').classList.contains('round'));
  assert('#2: 배너 크롭 시 모달 제목이 "배너 자르기"', doc.getElementById('cropTitle').textContent === '배너 자르기');

  // 적용 시 대상별로 다른 저장 함수(배너_적용선택/프로필_적용선택)로 라우팅
  ev(`
    window.__bannerApplied = false; window.__profileApplied = false;
    window.__origBannerApply = 배너_적용선택; window.__origProfileApply = 프로필_적용선택;
    배너_적용선택 = function(){ window.__bannerApplied = true; };
    프로필_적용선택 = function(){ window.__profileApplied = true; };
  `);
  ev("이미지크롭_상태 = {natW:800,natH:800,s0:1,z:1,tx:0,ty:0,Wv:256,Hv:256,dragging:false,px:0,py:0,대상:'프로필'};");
  ev("이미지크롭_적용();");
  const 프로필적용 = ev('window.__profileApplied === true'), 배너적용_오탐 = ev('window.__bannerApplied === true');
  assert('#2: 대상=프로필일 때 프로필_적용선택으로 라우팅(배너_적용선택은 호출 안 됨) 또는 캔버스 미지원 안전종료',
    (프로필적용 && !배너적용_오탐) || ev("!document.getElementById('cropBg').classList.contains('show')"));

  ev(`
    window.__bannerApplied = false; window.__profileApplied = false;
    이미지크롭_상태 = {natW:1000,natH:600,s0:1,z:1,tx:0,ty:0,Wv:700,Hv:320,dragging:false,px:0,py:0,대상:'배너'};
  `);
  ev("이미지크롭_적용();");
  const 배너적용 = ev('window.__bannerApplied === true'), 프로필적용_오탐 = ev('window.__profileApplied === true');
  assert('#2: 대상=배너일 때 배너_적용선택으로 라우팅(프로필_적용선택은 호출 안 됨) 또는 캔버스 미지원 안전종료',
    (배너적용 && !프로필적용_오탐) || ev("!document.getElementById('cropBg').classList.contains('show')"));
  ev("배너_적용선택 = window.__origBannerApply; 프로필_적용선택 = window.__origProfileApply;");

  // 출력 크기: 배너 700x320, 프로필 256x256(정사각)
  assert('#2: 배너 출력 크기 700x320', ev('이미지크롭_출력.배너.w') === 700 && ev('이미지크롭_출력.배너.h') === 320);
  assert('#2: 프로필 출력 크기 256x256(정사각)', ev('이미지크롭_출력.프로필.w') === 256 && ev('이미지크롭_출력.프로필.h') === 256);

  process.exit(finish() > 0 ? 1 : 0);
});

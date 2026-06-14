// 항목3: 커스텀 테마/프로필 에디터 동작 검증
const { load } = require('./load.cjs');
load((window) => {
  const results = [];
  const assert = (n, c, d) => results.push({ n, c: !!c, d: d || '' });
  const doc = window.document;
  const ev = (code) => window.eval(code);
  const rootStyle = doc.documentElement.style;

  // 1) 에디터 열기 + 팔레트/슬롯 렌더
  ev('openCustomTheme();');
  assert('에디터 모달 표시', doc.getElementById('customThemeBg').classList.contains('show'));
  assert('32색 팔레트 렌더', doc.querySelectorAll('#ctPalette .ct-sw-opt').length === 32, `swatches=${doc.querySelectorAll('#ctPalette .ct-sw-opt').length}`);
  assert('슬롯 10칸 렌더', doc.querySelectorAll('#ctSlots .ct-slot').length === 10);

  // 2) 포인트 채널 선택 후 색 선택
  ev("커스텀_채널선택('acc', null); 커스텀_색선택('#e74c3c');");
  assert('포인트 색 반영', ev("커스텀색.acc") === '#e74c3c');
  assert('미리보기 버튼 배경 적용', doc.getElementById('ctPrevBtn').style.background.replace(/\s/g,'') !== '');

  // 3) 적용 → custom 테마 + 루트 변수 + 저장
  ev("document.getElementById('ctName').value='나의테마'; 커스텀_적용();");
  assert('body data-theme=custom', doc.body.getAttribute('data-theme') === 'custom', `theme=${doc.body.getAttribute('data-theme')}`);
  assert('루트 --c-acc 반영', rootStyle.getPropertyValue('--c-acc').trim() === '#e74c3c', `--c-acc=${rootStyle.getPropertyValue('--c-acc')}`);
  assert('plx_테마=custom 저장', window.localStorage.getItem('plx_테마') === 'custom');
  assert('plx_커스텀 저장(이름 포함)', /나의테마/.test(window.localStorage.getItem('plx_커스텀')||''));

  // 4) 대비 경고 (저대비) / 양호(고대비)
  ev("커스텀색.bg='#101010'; 커스텀색.txt='#202020'; 커스텀_대비갱신();");
  assert('저대비 → 경고 표시', doc.getElementById('ctContrast').className.includes('warn'));
  ev("커스텀색.bg='#101010'; 커스텀색.txt='#f0f0f0'; 커스텀_대비갱신();");
  assert('고대비 → 양호 표시', doc.getElementById('ctContrast').className.includes('ok'));

  // 5) 슬롯 저장/불러오기
  ev("커스텀색={bg:'#0e1420',card:'#16203a',acc:'#5aa0f0',txt:'#d8e8ff'}; 커스텀_슬롯_현재저장();");
  assert('슬롯0 저장됨', ev("!!커스텀슬롯[0]"));
  assert('plx_커스텀슬롯 저장', /5aa0f0/.test(window.localStorage.getItem('plx_커스텀슬롯')||''));
  assert('슬롯0 칸 filled 표시', doc.querySelectorAll('#ctSlots .ct-slot.filled').length >= 1);
  ev("커스텀색={bg:'#000',card:'#111',acc:'#222',txt:'#333'}; 커스텀_슬롯로드(0);");
  assert('슬롯 불러오기로 색 복구', ev("커스텀색.acc") === '#5aa0f0', `acc=${ev("커스텀색.acc")}`);

  // 6) 슬롯 비우기
  ev("커스텀_슬롯비우기(0);");
  assert('슬롯0 비워짐', ev("!커스텀슬롯[0]"));

  // 7) 랜덤 생성 → 프리셋 중 하나
  ev("커스텀_랜덤();");
  assert('랜덤 색이 프리셋 중 하나', ev("커스텀랜덤프리셋.some(p=>p.acc===커스텀색.acc)"));

  // 8) 복원: localStorage 시뮬레이션
  ev(`window.localStorage.setItem('plx_커스텀', JSON.stringify({이름:'복원테마',bg:'#0a0f0a',card:'#121a12',acc:'#52a868',txt:'#d0e8d4'})); 커스텀_복원();`);
  assert('복원 시 색 적용', ev("커스텀색.acc") === '#52a868' && rootStyle.getPropertyValue('--c-acc').trim() === '#52a868');

  let fail = 0;
  console.log('\n=== 항목3 커스텀 테마/프로필 테스트 ===');
  for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  ('+r.d+')' : ''}`); if (!r.c) fail++; }
  console.log(`\n총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
  process.exit(fail > 0 ? 1 : 0);
});

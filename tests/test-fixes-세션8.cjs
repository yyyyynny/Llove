// 세션8: 첫 화면 여백 반응형 수정 + 백도어 터치 제스처(모바일 대응) 동작 검증
const { load } = require('./load.cjs');
load((window) => {
  const results = [];
  const assert = (n, c, d) => results.push({ n, c: !!c, d: d || '' });
  const doc = window.document;
  const ev = (code) => window.eval(code);
  const css = Array.from(doc.querySelectorAll('style')).map(s=>s.textContent).join('\n');

  /* ── 여백 반응형 (고정 max-width/padding → min()/clamp()) ── */
  assert('viewport-fit=cover 추가', doc.querySelector('meta[name="viewport"]').content.includes('viewport-fit=cover'));
  assert('.lg-content: min() 비례 상한', /\.lg-content\{[^}]*max-width:min\(400px, 100% - 40px\)/.test(css));
  assert('#sl: clamp() 좌우 패딩(+safe-area)', /#sl\{[^}]*padding:40px calc\(clamp\(20px, 6vw, 40px\) \+ env\(safe-area-inset-right\)\)/.test(css));
  assert('.ob-sub: min() 비례 상한', /\.ob-sub\{[^}]*max-width:min\(340px, 100% - 24px\)/.test(css));
  assert('.ob-feats: min() 비례 상한', /\.ob-feats\{[^}]*max-width:min\(360px, 100% - 24px\)/.test(css));
  assert('.ob-slide: safe-area 패딩', /\.ob-slide\{[^}]*calc\(28px \+ env\(safe-area-inset-right\)\)/.test(css));
  assert('.sn-content: 클래스로 통합(인라인 고정값 제거)', /\.sn-content\{[^}]*max-width:min\(400px, 100% - 40px\)/.test(css));
  assert('#sn 화면에 인라인 max-width:340px 잔존 없음', !doc.getElementById('sn').innerHTML.includes('max-width:340px'));
  assert('#sn 안에 .sn-content 요소 존재', !!doc.querySelector('#sn .sn-content'));

  /* ── 백도어 — 로고 연속 탭 (모바일 대응) ── */
  assert('로고에 id·onclick 연결', doc.getElementById('lgIconWrap')?.getAttribute('onclick') === '백도어_로고탭()');

  // A) 8회 탭 → 게스트로그인 진입
  ev("백도어_탭횟수=0; 사용자.이메일=''; curScreen='sl';");
  for (let i = 0; i < 8; i++) ev('백도어_로고탭();');
  assert('8회 탭 → 게스트 세션 진입', ev("사용자.이메일") === '(비로그인 테스트)' && ev('curScreen') === 'sh');

  // B) 타임아웃 경과 시 카운터 리셋 — setTimeout을 가로채 콜백을 수동 실행해 "3초 경과"를 시뮬레이션
  ev(`
    window.__guestCalled = false;
    window.__origGuestLogin = 게스트로그인;
    게스트로그인 = function(){ window.__guestCalled = true; return window.__origGuestLogin(); };
    window.__lastTimeoutCb = null;
    window.__origSetTimeout = window.setTimeout;
    window.setTimeout = function(cb, ms){ window.__lastTimeoutCb = cb; return window.__origSetTimeout(cb, ms); };
    백도어_탭횟수 = 0;
  `);
  for (let i = 0; i < 7; i++) ev('백도어_로고탭();');
  assert('7회 탭까지는 미진입', ev('window.__guestCalled') === false && ev('백도어_탭횟수') === 7);
  ev('window.__lastTimeoutCb && window.__lastTimeoutCb();');  // 3초 경과 시뮬레이션 → 카운터 리셋
  assert('경과 후 카운터 리셋', ev('백도어_탭횟수') === 0);
  ev('백도어_로고탭();');  // 리셋 이후 1회 탭 (누적 8회가 아니라 1회여야 함)
  assert('리셋 후 1회 탭은 미진입', ev('window.__guestCalled') === false && ev('백도어_탭횟수') === 1);
  for (let i = 0; i < 7; i++) ev('백도어_로고탭();');  // 리셋 이후 총 8회 채움
  assert('리셋 후 다시 8회 채우면 진입(메커니즘 정상)', ev('window.__guestCalled') === true);

  /* ── 기존 키보드 시퀀스 — 입력창 포커스 가드 불변 확인 ── */
  ev("테스트진입_버퍼='';");
  ev("테스트진입_키감지({target:{tagName:'INPUT'}, key:'y'});");
  assert('입력창 포커스 중엔 키 시퀀스 무시(가드 불변)', ev('테스트진입_버퍼') === '');
  ev("테스트진입_버퍼=''; for(const k of 'yyyyynny') 테스트진입_키감지({target:{tagName:'DIV'}, key:k});");
  assert('키보드 시퀀스 자체는 그대로 동작', ev('테스트진입_버퍼') === '');  // 완주 시 버퍼가 비워짐(게스트로그인 호출됨)

  let fail = 0;
  console.log('\n=== 세션8 여백 반응형 + 백도어 터치 제스처 테스트 ===');
  for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  ('+r.d+')' : ''}`); if (!r.c) fail++; }
  console.log(`\n총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
  process.exit(fail > 0 ? 1 : 0);
});

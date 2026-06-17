// 추가기능: 콜롬비나 음성 생성(TTS) 봉인 골격 동작 검증
// - 봉인(음성생성_활성화=false) 시 네트워크 호출 차단 / 창조주 게이트 / 엔드포인트 영속 /
//   로딩 토글 / 오디오 재생 경로(Audio 스텁)를 jsdom으로 검증한다.
//   (jsdom은 실제 오디오 재생 불가 → Audio 스텁으로 상태머신만 확인)
const { load } = require('./load.cjs');
load(async (window) => {
  const results = [];
  const assert = (n, c, d) => results.push({ n, c: !!c, d: d || '' });
  const doc = window.document;
  const ev = (code) => window.eval(code);

  // 1) 봉인 상태: 음성생성호출이 fetch 없이 null 반환 (호출 자체 차단)
  ev("window.__fetchN = 0; window.fetch = function(){ window.__fetchN++; return Promise.reject(new Error('no-net')); };");
  assert('봉인 플래그 false', ev("음성생성_활성화") === false);
  const 봉인결과 = await ev("음성생성호출('테스트 문장')");
  assert('봉인 시 null 반환', 봉인결과 === null);
  assert('봉인 시 fetch 미호출', ev("window.__fetchN") === 0, `fetchN=${ev("window.__fetchN")}`);

  // 2) 창조주 게이트 — 비창조주는 행 숨김 + 안내 모달, 창조주는 행 노출 + 패널 열림
  const row = doc.getElementById('음성설정Row');
  assert('음성 설정 행 존재', !!row);
  assert('비창조주: 행 숨김(display:none)', row.style.display === 'none', `display=${row.style.display}`);
  ev("사용자.창조주달성 = false; 음성설정_탭();");
  assert('비창조주 탭 → 안내 모달 표시', doc.getElementById('infoBg').classList.contains('show'));
  ev("closeInfoModal();");
  ev("사용자.창조주달성 = true; 갱신_음성설정_UI();");
  assert('창조주: 행 노출(display:flex)', doc.getElementById('음성설정Row').style.display === 'flex');
  ev("음성설정_탭();");
  assert('창조주 탭 → 음성 패널 열림', doc.getElementById('음성생성Bg').classList.contains('show'));
  assert('패널 열 때 봉인 안내 노출', doc.getElementById('음성봉인안내').style.display === 'block');

  // 3) 엔드포인트 저장·복원 (plx_음성엔드포인트 + 변수 반영)
  ev("document.getElementById('음성엔드포인트입력').value = 'https://test.example/tts'; 음성엔드포인트_저장();");
  assert('엔드포인트 변수 반영', ev("음성엔드포인트") === 'https://test.example/tts');
  assert('plx_음성엔드포인트 저장됨', window.localStorage.getItem('plx_음성엔드포인트') === 'https://test.example/tts');
  ev("음성엔드포인트_지우기();");
  assert('엔드포인트 지우기 — 변수 비움', ev("음성엔드포인트") === '');
  assert('엔드포인트 지우기 — localStorage 비움', window.localStorage.getItem('plx_음성엔드포인트') === '');

  // 4) 로딩 토글 on/off (회전 없는 펄스 오버레이)
  ev("음성생성_로딩(true);");
  assert('로딩 ON — 표시', doc.getElementById('음성로딩').style.display === 'flex');
  assert('로딩 ON — 생성 버튼 비활성', doc.getElementById('음성생성버튼').disabled === true);
  ev("음성생성_로딩(false);");
  assert('로딩 OFF — 숨김', doc.getElementById('음성로딩').style.display === 'none');
  assert('로딩 OFF — 생성 버튼 활성', doc.getElementById('음성생성버튼').disabled === false);

  // 5) 음성재생 — Audio 스텁이 생성·재생되는지 (프로젝트 최초 오디오 재생 경로)
  ev("window.__aSrc=null; window.__aPlay=false; window.Audio=function(src){ window.__aSrc=src; this.play=function(){ window.__aPlay=true; return Promise.resolve(); }; };");
  ev("음성재생('blob:fake-url');");
  assert('음성재생 — Audio(src) 생성', ev("window.__aSrc") === 'blob:fake-url');
  assert('음성재생 — play() 호출', ev("window.__aPlay") === true);

  // 6) 테스트 벤치 — 봉인 중엔 안내만, fetch·재생 없음
  ev("window.__aPlay=false; window.__fetchN2=0; window.fetch=function(){ window.__fetchN2++; return Promise.reject(new Error('x')); }; document.getElementById('음성테스트입력').value='안녕하세요';");
  await ev("음성_테스트생성()");
  assert('봉인 테스트벤치 — fetch 미호출', ev("window.__fetchN2") === 0, `fetchN2=${ev("window.__fetchN2")}`);
  assert('봉인 테스트벤치 — 재생 안 함', ev("window.__aPlay") === false);

  let fail = 0;
  console.log('\n=== 추가기능 음성 생성(봉인 골격) 테스트 ===');
  for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  ('+r.d+')' : ''}`); if (!r.c) fail++; }
  console.log(`\n총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
  process.exit(fail > 0 ? 1 : 0);
});

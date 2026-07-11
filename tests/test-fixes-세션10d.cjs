// 세션10-d 6차 피드백 검증 — 채팅 저장 견고화·AI 순수텍스트·큰 팝업·배너 확대/크롭·카드 재편
const { load, makeHarness } = require('./load.cjs');
load((window) => {
  const { assert, finish } = makeHarness('세션10-d 6차 피드백 수정 테스트');
  const doc = window.document, ev = (c) => window.eval(c);
  const css = doc.querySelector('style') ? Array.from(doc.querySelectorAll('style')).map(s=>s.textContent).join('\n') : '';

  /* ── 항목1: 채팅 진행중 세션 상시 백업 + 복구 ── */
  ev("현재채팅세션=null; try{localStorage.removeItem('plx_진행중대화')}catch(e){}");
  ev("채팅기록_추가메시지('나','안녕');");
  assert('#1: 메시지 추가 시 plx_진행중대화 즉시 백업',
    !!window.localStorage.getItem('plx_진행중대화') && JSON.parse(window.localStorage.getItem('plx_진행중대화')).메시지.length === 1);
  // 정상 마감 시 백업 키 제거
  ev("채팅세션_마감('테스트 마감');");
  assert('#1: 정상 마감 시 백업 키 제거', !window.localStorage.getItem('plx_진행중대화'));
  // 언로드로 중단된(키 남은) 세션이 로드 시 복구되어 채팅기록에 편입
  ev("채팅기록=[]; 현재채팅세션=null; window.localStorage.setItem('plx_진행중대화', JSON.stringify({카테고리:'일반',시작시각:11111,메시지:[{역할:'나',내용:'복구테스트',시각:1}]}));");
  ev("진행중세션_복원();");
  assert('#1: 미마감 세션 로드 시 복구', ev("채팅기록.some(s=>s.시작시각===11111)") === true);
  assert('#1: 복구 후 백업 키 제거', !window.localStorage.getItem('plx_진행중대화'));
  // 언로드 리스너가 마감(리셋) 대신 백업만 — visibilitychange가 현재채팅세션을 null로 만들지 않음
  ev("현재채팅세션={카테고리:'일반',시작시각:222,메시지:[{역할:'나',내용:'유지',시각:1}]};");
  Object.defineProperty(doc, 'visibilityState', { value: 'hidden', configurable: true });
  doc.dispatchEvent(new window.Event('visibilitychange'));
  assert('#1: 백그라운드 전환 시 세션 유지(리셋 안 함)', ev("현재채팅세션 && 현재채팅세션.메시지.length===1") === true);

  /* ── 항목2: 봉인 AI 응답이 요약 라벨이 아니라 순수 안내문으로 저장 ── */
  ev("현재채팅세션=null; try{localStorage.removeItem('plx_진행중대화')}catch(e){}");
  // GROK_활성화는 const(기본 false) — 봉인 경로 그대로 사용
  ev("사고전개모드=false; document.getElementById('askInp').value='질문';");
  ev("sendAsk();");
  // setTimeout(400) 안에서 AI 저장 — 약간 기다린 뒤 확인
  setTimeout(() => {
    const s = ev("현재채팅세션");
    const aiMsg = s && s.메시지.find(m=>m.역할==='AI');
    assert('#2: 봉인 AI 응답 저장됨', !!aiMsg);
    assert('#2: 요약 라벨 아닌 안내 전문 저장', !!aiMsg && aiMsg.내용.includes('Grok 연동 준비 중') && !aiMsg.내용.includes('<br>'));

    /* ── 항목3: 채팅 내역 큰 팝업(wide) ── */
    // 세션10-e 항목2: 560px 고정 → clamp(340px, 72vw, 680px) 반응형으로 갱신됨
    assert('#3: .modal-bx.wide CSS 존재', /\.modal-bx\.wide\{[^}]*max-width:clamp\(340px/.test(css));
    ev("채팅내역_열기();");
    assert('#3: 채팅 내역 모달 wide 적용', doc.querySelector('#infoBg .modal-bx').classList.contains('wide'));
    ev("closeInfoModal();");

    /* ── 항목4: 배너·프로필 확대 ── */
    assert('#4: prof-banner 높이 상향(184px)', /\.prof-banner\{[^}]*min-height:184px/.test(css));
    assert('#4: 이름 28px', /\.st-name\{font-size:28px/.test(css));

    /* ── 항목5: 배너 크롭 모달 ── */
    assert('#5: 크롭 모달 요소 존재', !!doc.getElementById('cropBg') && !!doc.getElementById('배너크롭이미지'));
    ev("배너크롭_열기('data:image/png;base64,AAAA');");
    assert('#5: 크롭 열기 시 이미지 src 세팅·모달 표시',
      (doc.getElementById('배너크롭이미지').getAttribute('src')||'').startsWith('data:image') && doc.getElementById('cropBg').classList.contains('show'));
    // 크롭 상태를 주입하고 적용 → 배너_적용선택 호출되는지(캔버스 미지원이면 안전 종료)
    let 적용됨 = false;
    ev("window.__origApply = 배너_적용선택; 배너_적용선택 = function(v){ window.__croppedV = v; window.__applied = true; };");
    ev("배너크롭_상태 = {natW:1000,natH:600,s0:1,z:1,tx:-100,ty:-50,Wv:700,Hv:320,dragging:false,px:0,py:0};");
    ev("배너크롭_적용();");
    적용됨 = ev("window.__applied === true");
    // jsdom 캔버스 getContext가 null이면 적용은 조용히 종료(안전) — 둘 중 하나면 통과
    assert('#5: 적용 시 배너_적용선택 호출 또는 캔버스 미지원 안전종료',
      적용됨 || ev("!document.getElementById('cropBg').classList.contains('show')"));
    ev("배너_적용선택 = window.__origApply;");
    // 클램프: 이미지가 뷰포트를 항상 덮도록 tx는 0 이하, (Wv-dispW) 이상
    ev("배너크롭_상태={natW:1000,natH:600,s0:0.7,z:1,tx:9999,ty:9999,Wv:700,Hv:320,dragging:false,px:0,py:0}; 배너크롭_클램프();");
    assert('#5: 클램프 — tx 상한 0', ev("배너크롭_상태.tx") <= 0);

    /* ── 항목6·7: 카드 재편(교정 맨 위)·색 그룹·라벨·랜덤 포함 ── */
    const 카드들 = Array.from(doc.querySelectorAll('.hs .mc')).map(c=>(c.querySelector('.mc-name')||{}).textContent);
    assert('#6: 맞춤법이 학습 모드 첫 카드', 카드들[0] === '맞춤법');
    assert('#6: 구어 교정이 둘째 카드', 카드들[1] === '구어 교정');
    assert('#6: mc-g4(교정)·mc-g5(재미) CSS 존재', /\.mc\.mc-g4\{/.test(css) && /\.mc\.mc-g5\{/.test(css));
    assert('#7: 색맹 그룹 라벨 존재', doc.querySelectorAll('.mc-glabel').length >= 4);
    assert('#7: 지문 독해 랜덤 목록 포함', ev("랜덤학습_모드목록.some(m=>m[0]==='지문 독해')") === true);

    process.exit(finish() > 0 ? 1 : 0);
  }, 600);
});

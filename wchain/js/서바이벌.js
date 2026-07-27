// '잇는' UI 레이어 — 파이썬 원본의 상태 머신(WordChainGame)·HUD·힌트/거래/이의/양보 로직을
// 브라우저 이벤트 기반으로 이식 (Phase 3: 서바이벌 모드 한정, 아케이드는 Phase 4).
//
// 웹 적응 결정 사항(원본 대비 의도적 변경 — 규칙 자체는 안 바꿈, 입력 방식만 웹에 맞춤):
//  1. 원본의 "!힌트 !설명 !리셋 !상태" 같은 타이핑 명령어를 전부 버튼으로 교체했다.
//     → 노션 10번("명령어 오타 시 하트 대신 실수 누적")이 **아예 무의미해짐**: 타이핑 명령어 자체가
//       사라졌으니 "명령어 오타"라는 상황이 발생할 수 없다. 버튼 UI가 오타 문제의 근본 해결책.
//  2. "너 먼저"/"이의 있음"/"그거 없어" 같은 자유 텍스트 키워드 매칭도 전용 버튼(먼저 해·이의 있음·
//     그 단어 없어!)으로 교체 — 오탐 없이 데스크톱·모바일 모두 동일하게 동작.
//  3. "오타/잘못했다" 관용구 프리비 반응(원본, 아무 효과 없는 위로 메시지)은 타이핑 입력이 없어져
//     대상이 사라져 이식하지 않음.
//  4. 노션 11번(한방 단어 기본 모드 즉시 패배) 반영: validate_word가 한방 단어를 걸러낼 때
//     기본 모드(비아케이드)+한방모드 OFF 조합이면, 원본처럼 실수 1회로 넘어가지 않고 **즉시 패배**.
//
// 클래식 스크립트, 사전.js·엔진.js·게임상태.js·게임규칙.js 뒤에 로드.

const gs = 새게임상태();

/* ── 화면 전환 ── */
function 화면(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('s-' + id);
  if(el) el.classList.add('active');
}

/* ── 로그 ── */
function 로그_추가(text, cls){
  const log = document.getElementById('로그');
  if(!log) return;
  const line = document.createElement('div');
  line.className = 'line' + (cls ? ' ' + cls : '');
  line.textContent = text;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}
function 로그_비우기(){ const l = document.getElementById('로그'); if(l) l.innerHTML = ''; }

const 표시무한 = n => (n === Infinity ? '∞' : String(n));

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   페르소나 선택 → 모드 선택 (원본 _handle_init/_handle_mode_select)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function 선택_페르소나(p){
  gs.persona = p;
  if(!gs.god_mode_active) gs.user_title = (p === 'Arrogant') ? '필멸자' : '사용자님';
  gs.game_state = 'MODE_SELECT';
  화면('모드');
}

function 선택_모드(mode){
  gs.game_mode = mode;
  reset_game(gs);
  if(mode === 'ARCADE'){
    // 원본 _handle_mode_select: 아케이드는 설정 화면 없이 바로 플레이 진입(설정 변경 불가 모드)
    gs.game_state = 'PLAYING';
    로그_비우기();
    로그_추가('⚔ 언어의 탑이 그 문을 열었다.', 'sys');
    로그_추가('⚔ 13층 정상까지 — 살아남겠는가?', 'sys');
    로그_추가(say(gs, '흥... 아케이드. 13층까지 올라올 수 있을지.', '아케이드 모드! 13층 타워에 도전해보세요!'));
    화면('플레이');
    플레이_HUD갱신(); 프롬프트_갱신();
    return;
  }
  gs.game_state = 'READY';
  화면('설정');
  설정_렌더();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   서바이벌 설정 (원본 _show_ready/_handle_ready 1~4·D)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* 설정 화면 — 2026-07-26 전면 개편(관리자님 지시).
   종전에는 항목당 버튼 하나를 계속 눌러 값을 순환시키는 방식이라 "어떤 선택지가 있는지" 자체가
   보이지 않았다("UX가 상당히 불친절해 여러 가지 옵션이 있으면 그걸 한번에 보여주며 간단한 상태도
   넣어주면 편했을걸"). 이제 각 항목의 선택지를 전부 한 줄에 펼쳐 놓고 현재 값을 강조한다.
   새 CSS 클래스·색상값을 만들지 않고 기존 .btn/.btn.acc/.btn.sm/.btn .d 와 기존 변수만 조합한다. */
const 설정_항목 = [
  { 키:'diff', 라벨:'🔥 난이도', 설명:'높을수록 제한 턴이 늘고, AI가 희귀어까지 사용합니다.',
    선택지:[['안온','안온 · 50턴'],['격동','격동 · 75턴'],['초월','초월 · 140턴'],['심연','심연 · 160턴']] },
  { 키:'dueum', 라벨:'📏 두음법칙', 설명:'‘력→역’처럼 첫소리를 바꿔 잇는 것을 허용할지.',
    선택지:[['OFF','끄기'],['Flexible','유연'],['Strict','엄격']] },
  { 키:'rev', 라벨:'🔀 진행 방향', 설명:'끝말잇기는 마지막 글자로, 앞말잇기는 첫 글자로 잇습니다.',
    선택지:[[false,'끝말잇기'],[true,'앞말잇기']] },
  { 키:'hanbang', 라벨:'⚔ 한방 모드', 설명:'켜면 상대가 이을 수 없는 ‘한방 단어’도 자유롭게 쓸 수 있습니다. 끄면 실수 1회로 계산됩니다.',
    선택지:[[false,'끄기'],[true,'켜기']] },
  { 키:'infinite', 라벨:'🔁 무한 모드', 설명:'턴 제한 없이 계속 이어갑니다.',
    선택지:[[false,'끄기'],[true,'켜기']] },
  { 키:'phrase', 라벨:'✂ 구 허용', 설명:'띄어쓰기 한 번(두 단어)까지 한 단어로 인정합니다.',
    선택지:[[false,'끄기'],[true,'켜기']] },
];

function 설정_렌더(){
  const 통 = document.getElementById('설정-항목');
  if(!통) return;
  통.innerHTML = 설정_항목.map((항목, i) => {
    const 버튼들 = 항목.선택지.map(([값, 이름], j) => {
      const 선택됨 = gs[항목.키] === 값;
      return `<button class="btn sm${선택됨 ? ' acc' : ''}" onclick="설정_선택(${i},${j})"`
           + `${선택됨 ? ' aria-current="true"' : ''}>${이름}</button>`;
    }).join('');
    return `<div class="set-row"><div class="set-lbl">${항목.라벨}</div>`
         + `<div class="set-opts">${버튼들}</div>`
         + `<div class="d">${항목.설명}</div></div>`;
  }).join('');

  // 사전 모드(dict_mode)는 Worker가 아직 우리말샘 한 곳만 서빙해서 실제 판정에 영향이 없다.
  // 동작하는 것처럼 보여주면 거짓이 되므로 준비 중임을 명시한다(이의/허세 봉인과 같은 🔒 관례).
  const 사전줄 = document.getElementById('설정-사전');
  if(사전줄){
    사전줄.innerHTML = `<div class="set-lbl">🔒 📚 사전 모드 (준비 중)</div>`
      + `<div class="d">지금은 우리말샘(통합) 한 가지만 사용합니다. 표준국어대사전 선택은 인증키가 준비되면 열립니다.</div>`;
  }

  // rev + 두음법칙 조합 안내 — 원본 규칙상 앞말잇기에선 두음법칙이 자동으로 꺼진다.
  // 종전엔 시작 버튼을 눌러야 조용히 바뀌어서 사용자가 이유를 알 수 없었다.
  const 경고 = document.getElementById('설정-경고');
  if(경고){
    const 충돌 = gs.rev && gs.dueum !== 'OFF';
    경고.textContent = 충돌 ? '※ 앞말잇기에서는 두음법칙이 적용되지 않아, 시작하면 자동으로 꺼집니다.' : '';
    경고.style.display = 충돌 ? '' : 'none';
  }
}

function 설정_선택(항목번호, 선택번호){
  const 항목 = 설정_항목[항목번호];
  gs[항목.키] = 항목.선택지[선택번호][0];
  설정_렌더();
}

function 게임_시작(){
  reset_game(gs);
  if(gs.rev && gs.dueum !== 'OFF'){ gs.dueum = 'OFF'; }   // 원본: 앞말잇기는 두음법칙 자동 OFF
  gs.game_state = 'PLAYING';
  로그_비우기();
  const arrogant = { 안온:'흥, 안온이라. 시시하군. 어디까지 가나 보지.', 격동:'격동의 소용돌이에서 네놈의 언어는 얼마나 버틸까?',
                    초월:'초월의 문턱에서 좌절하게 될 거다, 필멸자여.', 심연:'심연에 온 걸 환영한다. 여기서 나가는 자는 없었다.' };
  const polite = { 안온:'안온한 난이도입니다. 편안하게 즐겨주세요!', 격동:'격동 난이도군요! 조금 어려울 수 있지만, 할 수 있어요!',
                   초월:'초월 난이도에 도전하시는군요! 정말 대단해요!', 심연:'심연... 최고의 난이도입니다. 부디... 행운을 빕니다.' };
  const dialogue = gs.infinite
    ? say(gs, '무한의 시간 속에서 네 한계를 시험해 봐라.', '무한 모드입니다! 당신의 한계는 어디까지일까요?')
    : say(gs, arrogant[gs.diff], polite[gs.diff]);
  로그_추가(dialogue, 'sys');
  화면('플레이');
  플레이_HUD갱신();
  프롬프트_갱신();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HUD (원본 show_survival_hud) + 프롬프트(원본 prompt_next)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function get_status(current, total){
  if(total === 0) return '🟢';
  const pct = current / total;
  return pct <= 0.33 ? '🟢' : (pct <= 0.66 ? '🟡' : '🔴');
}

function 플레이_HUD갱신(){
  const 턴라벨 = document.getElementById('hud-턴라벨');
  if(gs.game_mode === 'ARCADE'){
    const target = get_stage_target(gs);
    const pct = target ? Math.min(100, Math.round(gs.stage_turn / target * 100)) : 0;
    턴라벨.textContent = '🗼 층 ' + gs.stage;
    document.getElementById('hud-턴').textContent = `${gs.stage_turn} / ${target}`;
    document.getElementById('hud-바').style.width = pct + '%';
    const st = document.getElementById('hud-상태');
    const status = get_status(gs.stage_turn, target);
    st.textContent = status; st.className = 'hud-val status-' + status;
  } else {
    const max_t = gs.infinite ? 0 : get_max_turns(gs);
    턴라벨.textContent = '⏳ 턴';
    document.getElementById('hud-턴').textContent = gs.infinite ? `${gs.turn} / ∞` : `${gs.turn} / ${max_t}`;
    document.getElementById('hud-바').style.width = ((!gs.infinite && max_t) ? Math.min(100, Math.round(gs.turn / max_t * 100)) : 0) + '%';
    const st = document.getElementById('hud-상태');
    const status = gs.infinite ? '🟢' : get_status(gs.turn, max_t);
    st.textContent = status; st.className = 'hud-val status-' + status;
  }
  document.getElementById('hud-힌트').textContent = 표시무한(gs.hints) + '개';
  // 종전 표기 "∞ / 1·4"는 무엇이 목숨이고 무엇이 실수인지 읽히지 않았다(관리자님 지적) —
  // 라벨 순서 그대로 "목숨 · 실수"를 명시적으로 붙인다.
  document.getElementById('hud-목숨').textContent = `${표시무한(gs.hearts)}개 · ${gs.strikes}/4`;
  document.getElementById('ai-단어').textContent = gs.ai_last_word ? `『${gs.ai_last_word}』` : '─';
  설정요약_갱신();

  // 저주 표시(아케이드 전용) — 원본 curse_tags
  const 저주줄 = document.getElementById('저주표시');
  if(gs.game_mode === 'ARCADE'){
    const tags = [];
    if(gs.curse_dark_active) tags.push('⛓ 어둠');
    if(gs.curse_life_floors > 0) tags.push('⛓ 생명');
    if(gs.curse_time_floors > 0) tags.push('⛓ 시간');
    저주줄.textContent = tags.length ? tags.join('  ') : '';
    저주줄.style.display = tags.length ? '' : 'none';
  } else {
    저주줄.style.display = 'none';
  }
}

// 플레이 중에도 내가 어떤 설정으로 하고 있는지 보이게 하는 요약 배지(2026-07-26 신설).
// 종전엔 게임에 들어가면 설정을 확인할 방법이 아예 없었다.
function 설정요약_갱신(){
  const 통 = document.getElementById('설정요약');
  if(!통) return;
  const 칩 = [];
  if(gs.game_mode === 'ARCADE'){
    칩.push('🗼 아케이드');
  } else {
    칩.push(`🔥 ${gs.diff}`);
    if(gs.infinite) 칩.push('🔁 무한');
  }
  칩.push(gs.rev ? '🔀 앞말잇기' : '🔀 끝말잇기');
  칩.push(`📏 두음 ${({OFF:'끄기', Flexible:'유연', Strict:'엄격'})[gs.dueum] ?? gs.dueum}`);
  if(gs.hanbang) 칩.push('⚔ 한방 허용');
  if(gs.phrase) 칩.push('✂ 구 허용');
  if(gs.god_mode_active) 칩.push('🔓 GOD MODE');
  통.innerHTML = 칩.map(t => `<span class="cfg-chip">${t}</span>`).join('');
}

// 온라인 조회처럼 시간이 걸리는 동안 입력을 잠그고 진행 중임을 보여준다(2026-07-26 신설).
// 종전엔 로그 한 줄("확인하는 중...")뿐이라 멈춘 것처럼 보였다.
// 회전 애니메이션 금지 규칙 준수 — 점 세 개 점멸만 사용.
function 입력_대기표시(켜기, 문구 = '확인 중'){
  const inp = document.getElementById('단어입력');
  const btn = document.querySelector('#입력폼 button[type=submit]');
  if(!inp || !btn) return;
  inp.disabled = 켜기;
  btn.disabled = 켜기;
  if(켜기){
    inp.placeholder = `${문구}…`;
    btn.innerHTML = '<span class="dots"><span>·</span><span>·</span><span>·</span></span>';
  } else {
    inp.placeholder = '단어를 입력하세요';
    btn.textContent = '전송';
  }
}

function 프롬프트_갱신(){
  const 안내 = document.getElementById('prompt-안내');
  안내.textContent = gs.ai_last_char
    ? `『${gs.ai_last_char}』(으)로 시작하는 단어를 입력하세요`
    : '첫 단어를 자유롭게 입력하세요';
  document.getElementById('btn-먼저').style.display = (gs.ai_last_char === null) ? '' : 'none';
  // 이의·허세는 봉인 중(위 '봉인' 주석 참조) — 버튼은 남겨 존재를 알리되 비활성으로 표시해
  // "눌렀는데 아무 일도 안 난다"는 오해가 생기지 않게 한다.
  // (disabled로 막지 않는다 — 관리자님이 "버튼을 누르면 준비 중이라고 알려주라"고 지시했으므로
  //  클릭은 받되 안내만 띄운다. 자물쇠 접두사는 Llove 실험실 목록의 🔒 관례와 동일.)
  for(const [id, 라벨] of [['btn-이의','이의 있음'], ['btn-허세','그 단어 없어!']]){
    const el = document.getElementById(id);
    el.style.display = gs.ai_last_word ? '' : 'none';
    el.textContent = 이의허세_봉인 ? `🔒 ${라벨}` : 라벨;
  }
  선택박스_숨기기();
  const form = document.getElementById('입력폼');
  form.style.display = '';
  document.getElementById('단어입력').focus();
}

function 선택박스_보이기(html){
  document.getElementById('입력폼').style.display = 'none';
  const box = document.getElementById('선택박스');
  box.innerHTML = html;
  box.style.display = '';
}
function 선택박스_숨기기(){ document.getElementById('선택박스').style.display = 'none'; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   단어 제출 (원본 _handle_playing 핵심 경로)
   Phase 5: 로컬 사전에 없는 단어는(게이트가 켜져 있을 때만) 국립국어원 API로 한 번 더
   확인한다 — validate_word 자체는 순수·동기 함수로 그대로 두고(파이썬 대조 500/500 유지),
   비동기 온라인 조회는 이 UI 레이어에서만 감싼다. 게이트 기본값이 false라 지금은 항상
   기존과 동일하게 로컬 사전 판정만 탄다(행동 변화 없음).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// 재진입 가드 — 국어원 게이트가 켜진 뒤로 단어 검증(온라인 존재 조회)·AI 턴(온라인 후보 조회)이
// 비동기가 되면서, 그 대기(최대 1.5초) 동안 사용자가 빠르게 재입력하면 gs.history 이중 push·turn
// 이중 증가로 게임 상태가 깨질 수 있다. 처리 중 재입력/이의 클릭은 이 플래그로 무시한다.
// (전부 동기였던 게이트 off 시절엔 이 창 자체가 없었음 — 비동기 전환으로 새로 생긴 문제.)
let 게임_비동기처리중 = false;

function 단어_제출(){
  if(게임_비동기처리중) return false;   // 앞 입력의 온라인 조회·AI 턴이 끝날 때까지 무시
  const inp = document.getElementById('단어입력');
  const raw = (inp.value || '').trim();
  inp.value = '';
  if(!raw) return false;
  if(gs.game_state !== 'PLAYING') return false;

  // 백도어 — 원본은 "/yyyyynny"(슬래시 포함)였으나, Llove 쪽 게스트 로그인 백도어(슬래시 없음)와
  // 헷갈린다는 관리자님 지적에 따라 Llove와 동일한 슬래시 없는 시퀀스로 통일(2026-07-25).
  if(raw === 'yyyyynny'){ 갓모드_활성화(); return false; }

  // 폼 기본 제출(새로고침)을 막기 위해 이 함수는 동기적으로 false를 반환하고, 비동기 흐름은
  // 가드로 감싼 IIFE 안에서 처리한다(끝나면 finally로 반드시 가드 해제).
  게임_비동기처리중 = true;
  입력_대기표시(true, '처리 중');
  (async () => {
    try{
      로그_추가('▶ ' + raw);
      let [valid, reason] = validate_word(raw, gs);

      // 로컬 사전에 없어서만 실패했고 국어원 게이트가 켜져 있으면 온라인 조회로 재확인.
      if(!valid && 국어원_활성화 && reason.endsWith('사전에 없는 단어입니다.')){
        로그_추가('🔎 국립국어원 사전을 확인하는 중...', 'sys');
        const 존재함 = await 국어원_단어조회(raw);
        // null = 네트워크 실패/시간초과로 "확인 자체를 못 함" — 진짜로 사전에 없는 것과 달리
        // 사용자 잘못이 아니므로 실수(user_defeat)를 매기지 않고 그대로 재시도할 수 있게 둔다.
        if(존재함 === null){
          로그_추가('⚠️ 국립국어원 사전 확인에 실패했습니다(네트워크 문제로 추정). 같은 단어를 다시 입력해 보세요.', 'warn');
          return;
        }
        if(존재함){
          // API로 사전 등재가 확인된 단어 — validate_word의 다음 단계(한방 판정)를 동일하게 재현
          // (사전 소속 여부만 API가 대신했을 뿐, 그 이후 규칙은 로컬 판정과 완전히 같아야 한다)
          valid = true; reason = '';
          if(gs.game_mode === 'ARCADE' && await 한방_확정인가(raw, gs)){
            valid = false; reason = `『${raw}』은(는) 한방 단어입니다. (아케이드에서 사용 불가)`;
          } else if(gs.game_mode !== 'ARCADE' && !gs.hanbang && await 한방_확정인가(raw, gs)){
            valid = false; reason = `『${raw}』은(는) 한방 단어입니다. (일반 모드에서 사용 불가)`;
          }
        }
        // 존재함 === false면 valid/reason을 그대로 둔다(진짜로 사전에 없는 단어).
      }
      // 로컬 사전 판정이 "한방 단어"로 막은 경우 — 280단어 기준이라 오판일 수 있으므로
      // 온라인으로 실제 이을 단어가 있는지 확인해 판정을 뒤집는다(2026-07-27, 즉사 버그 수정).
      else if(!valid && reason.includes('한방 단어입니다.') && !(await 한방_확정인가(raw, gs))){
        valid = true; reason = '';
      }

      await 단어_처리(raw, valid, reason);
    } finally {
      게임_비동기처리중 = false;
      입력_대기표시(false);
    }
  })();
  return false;
}

async function 단어_처리(raw, valid, reason){
  if(!valid){
    /* ⚠️ 노션 11번(한방 단어 즉시 패배) 철회 — 2026-07-27, 관리자님 지시.
       ────────────────────────────────────────────────────────────────────
       Phase 3에서 "원본은 한방 단어도 실수 1회로 넘어가는 결함"이라 보고 즉시 패배로 강화했는데,
       실플레이에서 이 규칙이 치명적으로 작용했다("바로 패배를 해버림" / "2번째 턴에 강제로
       패배 — 실수나 목숨 없이"). 원인은 두 가지가 겹친 것:
         · 한방 판정이 로컬 280단어 기준이라 정상 단어의 24~44%를 한방으로 오판(실측)
         · 그 오판이 실수 1회가 아니라 목숨도 안 깎고 바로 게임오버로 직결
       판정 오판은 한방_확정인가()로 따로 고쳤지만, "한 수 잘못 두면 경고 없이 판이 끝난다"는
       규칙 자체가 게임을 못 하게 만든다는 판단으로 **원본 파이썬대로 실수 1회 누적**으로 되돌린다.
       (되돌릴 근거를 남겨두기 위해 삭제하지 않고 여기 기록 — 이의/허세 봉인과 같은 관례.)

       철회된 구현:
         if(gs.game_mode !== 'ARCADE' && !gs.hanbang && !gs.god_mode_active
            && reason.endsWith('한방 단어입니다. (일반 모드에서 사용 불가)')){
           ... 로그 2줄 ...
           if(gs.turn > gs.best) gs.best = gs.turn;
           게임오버(false);
           return false;
         }
    */
    로그_추가(say(gs, `푸하하! ${reason}`, `아쉽지만 ${reason}`), 'err');
    const result = user_defeat(gs);
    if(result === 'game_over'){ 게임오버(false); return false; }
    if(result === 'restart_floor'){
      로그_추가(`🔄 [${gs.stage}층 재시작]`, 'err');
      arcade_restart_floor(gs);
      플레이_HUD갱신(); 프롬프트_갱신();
      return false;
    }
    플레이_HUD갱신(); 프롬프트_갱신();
    return false;
  }

  gs.history.push({ word: raw, turn: gs.turn });
  gs.turn += 1;
  if(gs.game_mode === 'ARCADE') gs.stage_turn += 1;
  check_title(gs);

  // 50턴 무한 모드 제안 (서바이벌 · 초월/심연, 유한 모드일 때만)
  const max_t = get_max_turns(gs);
  if(gs.game_mode === 'SURVIVAL' && gs.turn === 50 && ['초월','심연'].includes(gs.diff) && !gs.infinite){
    gs.game_state = 'DEAL_WAIT';
    로그_추가(say(gs, "흥... 50턴. '무한 모드' 진입 권한을 준다. 힌트 1개 추가. (수락/거절)",
                  "축하드립니다! 50턴 돌파! '무한 모드' 제안드립니다. 힌트 1개 추가. (수락/거절)"), 'sys');
    플레이_HUD갱신();
    선택박스_보이기(`
      <div class="q">${document.querySelector('.log').lastChild.textContent}</div>
      <button class="btn sm acc" onclick="딜_응답(true)">수락</button>
      <button class="btn sm" onclick="딜_응답(false)">거절</button>`);
    return false;
  }
  // 목표 턴 달성 (서바이벌 · 유한 모드)
  if(gs.game_mode === 'SURVIVAL' && !gs.infinite && gs.turn >= max_t){
    if(gs.turn > gs.best) gs.best = gs.turn;
    gs.game_state = 'SURVIVAL_VICTORY_WAIT';
    로그_추가(say(gs, `크윽... ${max_t}턴 생존이라니. 무한 모드로 계속할 수도 있다만. (계속/종료)`,
                  `🎉 ${max_t}턴 목표 달성! 무한 모드로 도전하시겠습니까? (계속/종료)`), 'ok');
    플레이_HUD갱신();
    선택박스_보이기(`
      <button class="btn sm acc" onclick="생존승리_응답(true)">계속</button>
      <button class="btn sm" onclick="생존승리_응답(false)">종료</button>`);
    return false;
  }
  // 층 목표 달성 (아케이드)
  if(gs.game_mode === 'ARCADE'){
    const target = get_stage_target(gs);
    if(gs.stage_turn >= target){
      if(gs.stage === 13){
        if(gs.stage > gs.best) gs.best = gs.stage;
        gs.game_state = 'VICTORY_WAIT';
        로그_추가(say(gs, '크윽... 13층이라니. 14층부터는 무한 모드다. (계속/종료)',
                      '🎉 13층 클리어! 14층 무한 등반에 도전하시겠습니까? (계속/종료)'), 'ok');
        플레이_HUD갱신();
        선택박스_보이기(`
          <button class="btn sm acc" onclick="탑승리_응답(true)">계속</button>
          <button class="btn sm" onclick="탑승리_응답(false)">종료</button>`);
        return false;
      }
      arcade_floor_up(gs, false);
      if(gs.game_state === 'SOFTLOCKED'){ 소프트락_진입(); return false; }
      플레이_HUD갱신(); 프롬프트_갱신();
      return false;
    }
  }

  // AI 턴 — 국어원_활성화 켜져 있으면 온라인 후보 우선(2026-07-24), 실패/off 시 로컬로 안전망.
  // 후보 풀(추가후보)을 여기서 직접 받아 두는 이유: 아래 "AI가 한방 단어를 냈는가" 검사도
  // AI가 고른 것과 **같은 사전**으로 판정해야 하기 때문(2026-07-27). 종전에는 AI는 온라인 풀에서
  // 고르고 검사는 로컬 280단어로 해서, 정상적인 온라인 단어가 한방으로 오판돼 판이 갑자기
  // "사용자 승리"로 끝나는 일이 있었다.
  gs.ai_last_char = !gs.rev ? raw[raw.length - 1] : raw[0];
  const 추가후보 = await 온라인후보_가져오기(gs);
  const ai_word = ai_generate_word(gs, 추가후보);
  const ai_판정사전 = ai_후보사전(gs, 추가후보);

  if(ai_word === null){
    if(gs.god_mode_active){
      로그_추가('💀 [AI 패배] 단어를 찾을 수 없습니다.', 'sys');
      로그_추가('🔓 [GOD MODE] 자유 입력권 발동.', 'sys');
      gs.ai_last_word = '[AI 기권]'; gs.ai_last_char = null;
      플레이_HUD갱신(); 프롬프트_갱신();
      return false;
    }
    if(gs.game_mode === 'SURVIVAL'){
      로그_추가(say(gs, `크윽... 단어를 찾지 못했다. ${title(gs)}의 승리다.`, `앗... 단어가 없습니다. ${title(gs)}의 승리입니다! 축하드려요!`), 'ok');
      if(gs.turn > gs.best) gs.best = gs.turn;
      게임오버(true);
      return false;
    }
    // 아케이드: AI 기권 = 그 층 클리어(런 종료 아님)
    로그_추가(say(gs, '크윽... 단어가 없다. 이번 층은 네가 가져라.', '앗... 단어가 없네요! 이번 층은 통과하셨습니다!'), 'ok');
    arcade_floor_up(gs, true);
    if(gs.game_state === 'SOFTLOCKED'){ 소프트락_진입(); return false; }
    플레이_HUD갱신(); 프롬프트_갱신();
    return false;
  }

  if(ai_한방금지인가(gs)
     && is_hanbang(ai_word, used_words(gs), gs.rev, gs.dueum, gs.stage, ai_판정사전)){
    if(gs.god_mode_active){
      로그_추가(`💀 [AI 자폭] 『${ai_word}』는 한방 단어입니다.`, 'sys');
      로그_추가('🔓 [GOD MODE] 자유 입력권 발동.', 'sys');
      gs.history.push({ word: ai_word, turn: gs.turn }); gs.ai_last_word = ai_word; gs.ai_last_char = null;
      플레이_HUD갱신(); 프롬프트_갱신();
      return false;
    }
    if(gs.game_mode === 'SURVIVAL'){
      로그_추가(say(gs, `크윽... 『${ai_word}』는 한방 단어였군. ${title(gs)}의 승리다.`, `앗... 『${ai_word}』는 한방 단어! ${title(gs)}의 승리입니다!`), 'ok');
      if(gs.turn > gs.best) gs.best = gs.turn;
      게임오버(true);
      return false;
    }
    // 아케이드: AI가 한방 단어를 냄 = 실수, 그 층 클리어(런 종료 아님)
    로그_추가(say(gs, `크윽... 내 실수. 『${ai_word}』는 한방 단어였군.`, `제 실수네요! 『${ai_word}』는 한방 단어였어요!`), 'warn');
    arcade_floor_up(gs, true);
    if(gs.game_state === 'SOFTLOCKED'){ 소프트락_진입(); return false; }
    플레이_HUD갱신(); 프롬프트_갱신();
    return false;
  }

  gs.history.push({ word: ai_word, turn: gs.turn });
  gs.ai_last_char = !gs.rev ? ai_word[ai_word.length - 1] : ai_word[0];
  gs.ai_last_word = ai_word;
  로그_추가(react_ai_word(gs, ai_word));
  플레이_HUD갱신(); 프롬프트_갱신();
  // 콜롬비나 음성 배선(Phase 6) — 게이트(음성생성_활성화) off인 동안은 음성생성호출이 즉시 null을
  // 반환해 음성재생 자체가 호출되지 않는다(네트워크·오디오 재생 0건, 기존 동작과 동일). 화면
  // 흐름을 막지 않도록 결과를 기다리지 않는 fire-and-forget으로 둔다.
  (async () => { const 음성 = await 음성생성호출(ai_word); if (음성) 음성재생(음성); })();
  return false;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   양보(원본 _handle_yield) · 이의(원본 _handle_dispute) · 허세(원본 bluff_kw)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function 버튼_양보(){
  if(gs.ai_last_char !== null) return;
  gs.yield_attempts += 1;
  if(gs.yield_attempts === 1){
    로그_추가(say(gs, '생존이 걸린 판에 심판에게 미루느냐. 어서 시작해라.', `첫 시작은 ${title(gs)}의 권리입니다! 어서 입력해주세요!`));
  } else if(gs.yield_attempts === 2){
    로그_추가(say(gs, '시간을 낭비하지 말고 네 단어를 내놓아라.', '계속 양보하셔도 제가 먼저 시작할 수는 없어요!'));
  } else if(gs.yield_attempts === 3){
    로그_추가(say(gs, '마지막 경고다. 계속 쓸데없는 소리를 하면 기권 처리한다.', '한 번만 더 미루시면 기권 처리됩니다. (단호)'), 'err');
  } else {
    로그_추가(say(gs, '기권 처리하마.', '아쉽게도 기권 처리됩니다...'), 'err');
    gs.yield_attempts = 0;
    const result = user_defeat(gs);
    if(result === 'game_over'){ 게임오버(false); return; }
    if(result === 'restart_floor'){
      로그_추가(`🔄 [${gs.stage}층 재시작]`, 'err');
      arcade_restart_floor(gs);
    }
  }
  플레이_HUD갱신(); 프롬프트_갱신();
}

/* ⚠️ 봉인 (2026-07-26, 관리자님 지시) — '이의 있음'·'그 단어 없어!' 두 버튼
   ────────────────────────────────────────────────────────────────────────
   관리자님 실플레이 피드백: "이럴 거면 왜 이의 있음을 만든 거야?"
   현 구현(원본 파이썬 _handle_dispute / bluff_kw 그대로)의 문제:
     · 사전을 실제로 확인하지 않고 미리 정해둔 조롱 대사만 출력한다.
     · 5번 연속 눌러야 겨우 취소되고, 심연 난이도면 그마저 기각된다.
     · 몇 번째인지 화면에 안 보여서 사용자는 "아무 일도 안 일어난다"고 느낀다.
     · '그 단어 없어!'는 아예 대사 한 줄뿐인 no-op.
   → 어설프게 남겨두느니 '준비 중'으로 막고, 다음 차수에 제대로 재설계하기로 확정.

   재설계 방향(다음 차수): 국어원 API로 AI 단어를 실제 조회해서 없는 단어면 즉시
   취소·사과하고 AI가 다시 내게 하고, 있는 단어면 뜻풀이를 근거로 제시한다. 진행도도 표시.

   기존 구현은 지우지 않고 아래 주석 블록에 보존한다(Llove의 봉인 골격 관례와 동일 —
   다음 차수에 원본 대조용으로 씀). 봉인 해제 시 이 상수를 false로. */
const 이의허세_봉인 = true;

function 버튼_이의(){
  로그_추가('🔒 [준비 중] 이의 제기 기능은 재설계 중입니다. 다음 업데이트에서 제대로 동작합니다.', 'sys');
}

function 버튼_허세(){
  로그_추가('🔒 [준비 중] 단어 시비 기능은 재설계 중입니다. 다음 업데이트에서 제대로 동작합니다.', 'sys');
}

/* ── 봉인된 원본 구현(다음 차수 재설계 시 참조) ─────────────────────────────
async function 버튼_이의_원본(){
  if(게임_비동기처리중) return;   // 앞 처리(온라인 조회·AI 턴) 진행 중이면 무시(재진입 방지)
  게임_비동기처리중 = true;
  try{
    gs.dispute_attempts += 1;
    const disputed = gs.ai_last_word || '?';
    if(gs.dispute_attempts === 1){
      로그_추가(say(gs, `흥... 『${disputed}』에 이의가 있다고? 사전을 확인해봐라.`, `『${disputed}』에 이의가 있으신가요? 다시 확인해봤는데 맞는 단어예요!`));
    } else if(gs.dispute_attempts === 2){
      로그_추가(say(gs, '또 우기는 건가. 규칙은 바뀌지 않는다.', '계속 이의를 제기하시는군요. 규칙대로 진행할게요!'));
    } else if(gs.dispute_attempts === 3){
      로그_추가(say(gs, '세 번이나... 인내심에 한계가 오겠군.', '세 번째 이의 제기이시네요... 조금 심각하게 볼게요.'));
    } else if(gs.dispute_attempts === 4){
      로그_추가(say(gs, `정말로 『${disputed}』이(가) 틀렸다고 주장하는 건가?`, `정말로 『${disputed}』이(가) 문제가 있다고 생각하세요?`));
    } else {
      if(gs.diff === '심연'){
        로그_추가(say(gs, '심연에서는 심판의 결정이 절대적이다. 이의 기각.', '심연 난이도 — 판정이 최종입니다. 이의 신청 기각.'), 'err');
        gs.dispute_attempts = 0;
      } else {
        로그_추가(say(gs, `크윽... 이번만이다. 『${disputed}』을 취소하겠다.`, `알겠어요, 이번만 양보할게요. 『${disputed}』 취소합니다!`), 'ok');
        gs.dispute_attempts = 0;
        gs.history = gs.history.filter(h => h.word !== disputed);
        if(gs.history.length){
          const prev = gs.history[gs.history.length - 1].word;
          gs.ai_last_char = !gs.rev ? prev[prev.length - 1] : prev[0];
        } else {
          gs.ai_last_char = null;
        }
        gs.ai_last_word = null;
        const new_ai = await ai_generate_word_비동기(gs);
        if(new_ai){
          gs.history.push({ word: new_ai, turn: gs.turn });
          gs.ai_last_char = !gs.rev ? new_ai[new_ai.length - 1] : new_ai[0];
          gs.ai_last_word = new_ai;
          로그_추가(react_ai_word(gs, new_ai));
        } else {
          로그_추가(say(gs, `크윽... 대체 단어도 없군. ${title(gs)}의 승리다.`, `앗, 대체할 단어도 없네요! ${title(gs)}의 승리입니다!`), 'ok');
          // 원본과 동일: 이의제기로 인한 승리는 서바이벌만 best(턴) 갱신 — 아케이드는 갱신 안 함(원본 그대로)
          if(gs.game_mode === 'SURVIVAL' && gs.turn > gs.best) gs.best = gs.turn;
          게임오버(true);
          return;
        }
      }
    }
    플레이_HUD갱신(); 프롬프트_갱신();
  } finally {
    게임_비동기처리중 = false;
  }
}

// 원본 bluff_kw 분기 — AI는 항상 사전에 있는 단어만 내므로(ai_generate_word가 DICTIONARY/HARD_DICT에서만
// 고름) 실질적으로 항상 "허세 부리는 건가?" 조롱만 나온다(원본에서도 else 분기는 사실상 도달 불가).
function 버튼_허세_원본(){
  if(!gs.ai_last_word) return;
  로그_추가(say(gs, `크크크... 허세를 부리는 건가? 『${gs.ai_last_word}』은(는) 등록된 단어다.`,
                `앗, 『${gs.ai_last_word}』은(는) 사전에 등록된 단어가 맞아요!`));
  플레이_HUD갱신(); 프롬프트_갱신();
}
──────────────────────────────────────────────────────────────────────── */

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   힌트 (원본 handle_hint/deliver_hint — 서바이벌 경로만)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// 힌트 후보 조회 — 원본 deliver_hint(game.py:1054-1062)와 동일한 필터를 쓴다.
// ⚠️ 2026-07-26 수정: 종전에는 find_words(..., 0, 0)로 length_filter·min_length를 0으로
// 하드코딩해, 어둠의 계약(정확히 2글자)·13층 족쇄(3글자 이상)가 걸린 상태에서 "제출하면 반드시
// 거부당할 단어"의 초성을 알려주고 있었다(원본과의 실제 불일치 — 관리자님이 "힌트 알고리즘이
// 설계와 다르다"고 지적한 부분). 원본대로 두 필터를 복원한다.
// 추가로, AI가 높은 난이도에서 온라인 희귀어 풀을 쓰게 되면서 힌트만 로컬 사전을 보면 정답
// 공간이 어긋나므로(힌트 불가가 잘못 뜸), 같은 풀을 공유하도록 추가후보를 함께 넘긴다.
function 힌트_후보(gs, 추가후보 = []){
  const dark_filter = (gs.game_mode === 'ARCADE' && gs.curse_dark_active) ? 2 : 0;
  const min_len = (gs.game_mode === 'ARCADE' && gs.stage >= 13) ? 3 : 0;
  const 사전 = 추가후보.length ? [...new Set([...DICTIONARY, ...추가후보])] : DICTIONARY;
  const 후보 = find_words(gs.ai_last_char, used_words(gs), gs.rev, gs.dueum, dark_filter, min_len, 사전);

  // 한방 단어 제외 — 원본을 넘어서는 보정(의도적). 원본 deliver_hint는 한방 여부를 안 보는데,
  // 우리 규칙에선 그렇게 뽑힌 힌트가 "내면 반드시 지는 단어"가 된다:
  //   · 아케이드    → validate_word가 한방 단어를 무조건 거부(실수 누적)
  //   · 서바이벌+한방모드 OFF → 노션 11번 반영으로 제출 즉시 패배
  // 힌트를 따랐다가 죽는 건 힌트의 존재 이유에 정면으로 어긋나므로 여기서 걸러낸다.
  // (한방모드 ON인 서바이벌에선 한방 단어가 합법이라 그대로 둔다 — AI의 safe_filter와 같은 기준.)
  const 한방_위험 = ai_한방금지인가(gs);
  if(!한방_위험) return 후보;
  // 전부 한방이라 안전한 후보가 0개면 빈 배열을 그대로 반환한다 — 호출부가 "❌ [힌트 불가]"를
  // 띄우고 힌트도 차감하지 않는다. AI의 safe_filter는 "그래도 뭔가 내야 하니" 원본 목록으로
  // 되돌리는 폴백을 두지만, 힌트는 낼 의무가 없으므로 지는 단어를 알려주느니 없다고 말하는 게 맞다
  // (실제로 그 상황은 플레이어가 둘 수 있는 합법 수가 없는 막다른 국면이다).
  // 판정 사전은 후보를 뽑은 사전과 같아야 한다 — 온라인 후보를 포함해 뽑아놓고 로컬 280단어로
  // 한방을 재면 정상 후보가 전부 탈락해 "힌트 불가"가 잘못 뜬다(2026-07-27).
  return 후보.filter(w => !is_hanbang(w, [...used_words(gs), w], gs.rev, gs.dueum, gs.stage, 사전));
}

// onclick에서 await 없이 불리므로(fire-and-forget) 내부에서 예외가 새어나가지 않게 감싼다.
function 버튼_힌트(){ 힌트_실행().catch(e => console.error('[힌트] 처리 실패', e)); }

async function 힌트_실행(){
  if(gs.game_state !== 'PLAYING') return;
  if(gs.ai_last_char === null){ 로그_추가('ℹ️ 첫 단어는 자유롭게 입력하세요. 힌트가 필요하지 않습니다.', 'sys'); return; }
  // 힌트도 온라인 후보를 조회할 수 있게 되면서(높은 난이도) 비동기 창이 생겼다 —
  // 단어 제출과 같은 재진입 가드를 공유해 연타로 힌트가 이중 차감되지 않게 한다.
  if(게임_비동기처리중) return;
  게임_비동기처리중 = true;
  입력_대기표시(true, '힌트 찾는 중');
  try{
    await 힌트_본체();
  } finally {
    게임_비동기처리중 = false;
    입력_대기표시(false);
  }
}

async function 힌트_본체(){

  // 13층 이상 + 힌트 소진 = 시련의 탑 대신 바로 비상 탈출구
  if(gs.game_mode === 'ARCADE' && gs.stage >= 13 && gs.hints <= 0){
    로그_추가(say(gs, '벌써 다리에 힘이 풀렸나? 꼬리를 말고 도망치겠다면 문을 열어주지.',
                  '어머, 벌써 한계이신가요? 정 무서우시다면 도망칠 비상구를 열어드릴게요.'), 'sys');
    gs.game_state = 'ESCAPE_WAIT';
    선택박스_보이기(`
      <div class="q">[비상 탈출구]</div>
      <button class="btn sm acc" onclick="탈출_응답(false)">계속</button>
      <button class="btn sm" onclick="탈출_응답(true)">도망</button>`);
    return;
  }

  const cands = 힌트_후보(gs, await 온라인후보_가져오기(gs));

  if(gs.hints !== Infinity && gs.hints <= 0){
    if(gs.game_mode === 'ARCADE'){
      gs.trial_tower_entries += 1;
      if(gs.trial_tower_entries === 2){
        로그_추가(say(gs, '제 발로 지옥에 두 번이나 기어들어 오다니. 목숨이 여러 개인 줄 아는 모양이군.',
                      '이곳의 대가를 아시면서도 다시 오셨군요. 이번에는 부디 운이 따라주기를 바랍니다.'), 'sys');
      } else if(gs.trial_tower_entries >= 3){
        로그_추가(say(gs, '세 번씩이나 목숨을 구걸하러 기어오다니. 이젠 그 알량한 발버둥이 역겹기까지 하군.',
                      '세 번째 방문이시군요. 이쯤 되면 생존을 위한 용기가 아니라, 파멸을 향한 만용이라는 걸 아실 텐데요.'), 'sys');
      }
      if(gs.trial_rejected_floor === gs.stage){
        로그_추가(say(gs, '크크크... 한 번 거절한 계약은 다시 열리지 않는다.', '이번 층에서는 이미 거절하셨어요. 다음 층을 노려보세요!'), 'sys');
        return;
      }
      gs.trial_attempts_this_floor += 1;
      const prob = 붕괴확률(gs.trial_attempts_this_floor);
      if(prob > 0){
        gs.game_state = 'TOWER_COLLAPSE_WAIT';
        로그_추가(`▓▒░ [탑의 그림자가 짙어진다] ░▒▓  현재 붕괴 위험: ${prob}%`, 'err');
        선택박스_보이기(`
          <div class="q">⚠ ${prob}% 확률로 탑이 무너진다.</div>
          <button class="btn sm acc" onclick="붕괴_응답(true)">심연의 문 — 입장(위험 감수)</button>
          <button class="btn sm" onclick="붕괴_응답(false)">탑의 그림자 — 퇴장(포기)</button>`);
      } else {
        gs.game_state = 'TRIAL_WAIT';
        로그_추가('░▒▓ [시련의 탑] ▓▒░', 'sys');
        선택박스_보이기(`
          <div class="q">[1] 시간의 계약 — 이번 층 즉시 클리어 / 다음 1층 목표 턴 ×1.3<br>
          [2] 생명의 계약 — 목숨+1·힌트+1 / 다음 2층 두음법칙 OFF<br>
          [3] 어둠의 계약 — 목숨+1·힌트+3 / 이번 층 2글자 단어만 허용</div>
          <button class="btn sm acc" onclick="시련_응답(1)">시간의 계약</button>
          <button class="btn sm acc" onclick="시련_응답(2)">생명의 계약</button>
          <button class="btn sm acc" onclick="시련_응답(3)">어둠의 계약</button>
          <button class="btn sm" onclick="시련_응답(0)">거절</button>`);
      }
      return;
    }
    if(!gs.deal_offered){
      if(gs.diff === '심연'){ 로그_추가(say(gs, '흥... 심연에서는 거래를 거부합니다.', '심연에서는 거래를 거부합니다. 스스로의 힘으로 해내세요!'), 'sys'); return; }
      gs.deal_offered = true;
      gs.game_state = 'DEVIL_WAIT';
      const diff_next = { 안온:'격동', 격동:'초월', 초월:'심연' }[gs.diff] ?? gs.diff;
      로그_추가(say(gs, `크크크... 힌트가 바닥났군. 난이도 『${gs.diff}』→『${diff_next}』 격상 조건으로 힌트 3개를 주겠다. (수락/거절)`,
                    `힌트가 소진됐어요! 난이도 『${gs.diff}』→『${diff_next}』 조건으로 힌트 3개를 드릴게요! (수락/거절)`), 'sys');
      선택박스_보이기(`
        <button class="btn sm acc" onclick="악마거래_응답(true)">수락</button>
        <button class="btn sm" onclick="악마거래_응답(false)">거절</button>`);
      return;
    }
    로그_추가(say(gs, '⚠️ [힌트 없음] 스스로 해결하거라.', '⚠️ [힌트 없음] 조금만 더 생각해보세요!'), 'sys');
    return;
  }

  if(!cands.length){ 로그_추가('❌ [힌트 불가] 조건에 맞는 단어를 찾을 수 없습니다.', 'sys'); return; }

  if(gs.god_mode_active){
    const answer = cands[Math.floor(Math.random() * cands.length)];
    로그_추가(`🔓 [GOD MODE 힌트] 정답: 『${answer}』 (최고 관리자님 전용 즉시 정답 공개)`, 'ok');
    return;
  }

  if(gs.hints !== Infinity) gs.hints -= 1;
  const hint_word = cands[Math.floor(Math.random() * cands.length)];
  로그_추가(say(gs, `흥... 특별히 힌트를 주지. 남은 힌트: ${표시무한(gs.hints)}`, `💡 [힌트 사용] 남은 힌트: ${표시무한(gs.hints)}. 도움이 되길 바랍니다!`));
  로그_추가(`   🔤 초성 : ${extract_chosung(hint_word)}`);
  // 원본 deliver_hint(game.py:1071-1072)의 어둠의 계약 안내 — 이식 때 누락됐던 것 복원
  if(gs.game_mode === 'ARCADE' && gs.curse_dark_active){
    로그_추가('   ⛓ [어둠의 계약] 2글자 단어만 안내됩니다.', 'sys');
  }
  플레이_HUD갱신();
}

function 악마거래_응답(수락){
  if(수락){
    const order = ['안온','격동','초월','심연'];
    const idx = order.indexOf(gs.diff); const old = gs.diff;
    gs.diff = order[Math.min(idx + 1, 3)];
    if(gs.hints !== Infinity) gs.hints += 3;
    gs.game_state = 'PLAYING';
    로그_추가(say(gs, `크크크... 계약 성립. 『${old}』→『${gs.diff}』 격상. 힌트 3개 지급.`, `계약 성립! 『${old}』→『${gs.diff}』 격상! 힌트 3개를 드릴게요!`), 'ok');
    // 원본: 계약 즉시 힌트 1회를 바로 제공 (힌트_후보로 통일 — 어둠의 계약·13층 족쇄 필터 반영)
    const cands = 힌트_후보(gs);
    if(cands.length){
      if(gs.hints !== Infinity) gs.hints -= 1;
      const hint_word = cands[Math.floor(Math.random() * cands.length)];
      로그_추가(`   🔤 초성 : ${extract_chosung(hint_word)}`);
    }
  } else {
    gs.game_state = 'PLAYING';
    로그_추가(say(gs, '흥... 거래 거절. 어리석은 선택이군.', '거래를 거절하셨군요. 힌트 없이 계속 진행할게요. 화이팅!'));
  }
  플레이_HUD갱신(); 프롬프트_갱신();
}

function 딜_응답(수락){
  if(수락){
    gs.infinite = true;
    if(gs.hints !== Infinity) gs.hints += 1;
    gs.game_state = 'PLAYING';
    로그_추가(`✅ [무한 모드 진입] 끝은 없다. 한계를 시험하라, ${title(gs)}.`, 'ok');
  } else {
    gs.game_state = 'PLAYING';
    로그_추가(say(gs, '🚫 거절했군. 흥...', '🚫 알겠습니다! 계속 진행하겠습니다!'));
  }
  플레이_HUD갱신(); 프롬프트_갱신();
}

function 생존승리_응답(계속){
  if(계속){
    gs.infinite = true;
    gs.game_state = 'PLAYING';
    로그_추가('✅ [무한 모드 진입] 턴 제한 해제. 한계를 넘어서십시오!', 'ok');
    플레이_HUD갱신(); 프롬프트_갱신();
  } else {
    if(gs.turn > gs.best) gs.best = gs.turn;
    게임오버(true);
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   아케이드 — 시련의 탑 · 탑 붕괴 · 비상 탈출구 · 13층 승리 (Phase 4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function 시련_응답(선택){
  if(선택 === 1){
    gs.game_state = 'PLAYING';
    로그_추가(say(gs, '크크... 시간의 계약. 이번 층은 넘어가지. 다음 층은 쉽지 않을 것이다.', '시간의 계약 체결! 이번 층 클리어. 다음 층은 길어질 거예요!'), 'ok');
    arcade_floor_up(gs, false);
    if(gs.game_state === 'SOFTLOCKED'){ 소프트락_진입(); return; }
    gs.curse_time_floors = 1;
    플레이_HUD갱신(); 프롬프트_갱신();
  } else if(선택 === 2){
    gs.hearts += 1;
    if(gs.hints !== Infinity) gs.hints += 1;
    gs.curse_life_floors = 2;
    gs.game_state = 'PLAYING';
    const h = 표시무한(gs.hearts);
    로그_추가(say(gs, `크크... 생명의 계약. 목숨+1 힌트+1. 대신 두음법칙은 없다. (목숨:${h} / 힌트:${표시무한(gs.hints)})`,
                  `생명의 계약! 목숨+1 (${h}개) 힌트+1 (${표시무한(gs.hints)}개). 다음 2층은 두음법칙이 적용 안 돼요! (유저만 해당)`), 'ok');
    플레이_HUD갱신(); 프롬프트_갱신();
  } else if(선택 === 3){
    gs.hearts += 1;
    if(gs.hints !== Infinity) gs.hints += 3;
    gs.curse_dark_active = true;
    gs.game_state = 'PLAYING';
    const h = 표시무한(gs.hearts);
    로그_추가(say(gs, `크크크... 어둠의 계약. 목숨+1 힌트+3. 이번 층은 2글자 단어만이다. (목숨:${h} / 힌트:${표시무한(gs.hints)})`,
                  `어둠의 계약! 목숨+1 (${h}개) 힌트+3 (${표시무한(gs.hints)}개). 이번 층은 2글자 단어만! (힌트도 2글자만 안내)`), 'ok');
    플레이_HUD갱신(); 프롬프트_갱신();
  } else {
    gs.game_state = 'PLAYING';
    gs.trial_rejected_floor = gs.stage;
    로그_추가(say(gs, '흥... 거절이라. 이번 층에서 계약의 문은 다시 열리지 않는다.', '알겠습니다. 이번 층에서는 다시 계약을 요청하실 수 없어요.'));
    플레이_HUD갱신(); 프롬프트_갱신();
  }
}

function 붕괴_응답(입장){
  if(입장){
    const prob = 붕괴확률(gs.trial_attempts_this_floor);
    const roll = 1 + Math.floor(Math.random() * 100);
    if(prob >= 100 || roll <= prob){
      로그_추가('▓▒░ 탑이 무너진다. 대지가 갈라진다. ░▒▓', 'err');
      로그_추가(say(gs, `크크크... 욕심이 파멸을 불렀군, ${title(gs)}.`, `탑이 붕괴했습니다! 욕심이 지나쳤어요, ${title(gs)}!`), 'err');
      로그_추가(`💀 [탑 붕괴 엔딩] ${gs.stage}층에서 소멸.`, 'err');
      if(gs.stage > gs.best) gs.best = gs.stage;
      게임오버(false);
    } else {
      로그_추가(say(gs, '흥... 운이 좋군. 탑이 네 무모함을 인정했다.', '운이 좋으시네요! 탑이 한 번 더 기회를 주었습니다.'), 'ok');
      gs.game_state = 'TRIAL_WAIT';
      선택박스_보이기(`
        <div class="q">[1] 시간의 계약  [2] 생명의 계약  [3] 어둠의 계약</div>
        <button class="btn sm acc" onclick="시련_응답(1)">시간의 계약</button>
        <button class="btn sm acc" onclick="시련_응답(2)">생명의 계약</button>
        <button class="btn sm acc" onclick="시련_응답(3)">어둠의 계약</button>
        <button class="btn sm" onclick="시련_응답(0)">거절</button>`);
    }
  } else {
    gs.game_state = 'PLAYING';
    gs.trial_rejected_floor = gs.stage;
    로그_추가(say(gs, '흥... 현명한 선택이다. 탑의 그림자가 물러선다.', '잘 생각하셨어요! 위험을 피하셨습니다.'));
    플레이_HUD갱신(); 프롬프트_갱신();
  }
}

function 탈출_응답(도망){
  if(도망){
    로그_추가(say(gs, '패배자의 말로는 비참하지. 탑의 어둠 속으로 사라져라.', '현명한 판단이시네요. 이 이상은 무리였을 거예요.'), 'err');
    로그_추가(`💀 [비상 탈출] ${gs.stage}층에서 도망쳤습니다.`, 'err');
    if(gs.stage > gs.best) gs.best = gs.stage;
    게임오버(false);
  } else {
    gs.game_state = 'PLAYING';
    로그_추가(say(gs, '어리석은 객기다. 네 무덤을 스스로 파는군.', '다시 도전하시는군요! 당신의 용기를 응원합니다!'));
    플레이_HUD갱신(); 프롬프트_갱신();
  }
}

function 탑승리_응답(계속){
  if(계속){
    gs.stage = 14; gs.stage_turn = 0; gs.stage_start_turn = gs.turn;
    gs.hearts = gs.god_mode_active ? Infinity : 2;
    gs.user_title = is_arrogant(gs) ? '탑의지배자' : '탑의주인님';
    gs.game_state = 'PLAYING';
    로그_추가(`🚀 [14층 진입] 무한 등반. 목표: ${get_stage_target(gs)}턴`, 'ok');
    플레이_HUD갱신(); 프롬프트_갱신();
  } else {
    if(gs.stage > gs.best) gs.best = gs.stage;
    게임오버(true);
  }
}

// 20층 소프트락 이스터에그 — 원본 _handle_softlock(좀비 텍스트 부패 연출, 리셋 외 탈출 불가)
function 소프트락_진입(){
  const zalgo = [...Array(700)].map(() => 0x0300 + Math.floor(Math.random() * 0x70));
  let base = 'SYSTEM_CORRUPTION';
  let text = '';
  for(const c of base){
    text += c;
    for(let k=0;k<5;k++) text += String.fromCodePoint(zalgo[Math.floor(Math.random()*zalgo.length)]);
  }
  document.getElementById('소프트락-텍스트').textContent = `${text} ERROR: MEMORY_LEAK_AT_0xDEADBEEF ${text}`;
  화면('소프트락');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   게임 오버 (원본 show_game_over — 서바이벌)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function 게임오버(victory){
  gs.game_state = 'GAME_OVER';
  화면('오버');
  document.getElementById('오버-이모지').textContent = victory ? '🏆' : '💀';

  if(gs.game_mode === 'SURVIVAL'){
    const msg = victory
      ? say(gs, '흥... 이번엔 네가 이겼군. 다음엔 쉽게 넘어가지 않을 것이다.', `🎉 승리입니다, ${title(gs)}! 훌륭한 플레이였습니다!`)
      : say(gs, `크크크... 예상대로군. 재도전이라도 해볼 텐가, ${title(gs)}?`, '수고하셨습니다! 다음엔 더 잘하실 수 있을 거예요!');
    document.getElementById('오버-메시지').textContent = (victory ? '🏆 [SURVIVAL 클리어] ' : '💀 [GAME OVER] ') + msg;
    document.getElementById('오버-통계').textContent = `최종 턴: ${gs.turn}  |  최고 기록: ${gs.best}`;
  } else {
    const msg = victory
      ? say(gs, `크윽... 인정하지. ${title(gs)}의 승리다.`, `🎉 13층 클리어! 정말 대단하십니다, ${title(gs)}!`)
      : say(gs, `크크크... ${gs.stage}층이 네 한계였나, ${title(gs)}.`, `수고하셨습니다! ${gs.stage}층까지 잘하셨어요!`);
    document.getElementById('오버-메시지').textContent = (victory ? '🏆 [13층 클리어] ' : '💀 [GAME OVER] ') + msg;
    document.getElementById('오버-통계').textContent = `최종 층: ${gs.stage}  |  최고 기록: ${gs.best}층`;
  }
}

function 다시시작(){
  if(gs.game_mode === 'ARCADE'){
    // 원본 _handle_game_over(ARCADE): 설정 화면 없이 곧장 1층부터 재시작
    reset_game(gs);
    gs.stage = 1;
    gs.game_state = 'PLAYING';
    로그_비우기();
    로그_추가('🔄 아케이드 모드 재시작. 1층부터.', 'sys');
    화면('플레이');
    플레이_HUD갱신(); 프롬프트_갱신();
    return;
  }
  gs.game_state = 'READY';
  reset_game(gs);
  화면('설정');
  설정_렌더();
}

function 전체리셋(){
  // 원본 !리셋 처리(WordChainGame.run): full_reset() 후 GOD MODE 여부와 무관하게 항상
  // show_init()(페르소나 선택)으로 돌아간다 — god_mode_active는 화면 안내 문구만 다를 뿐 분기 없음.
  full_reset(gs);
  로그_비우기();
  화면('페르소나');
}
function 버튼_리셋(){ 전체리셋(); }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   설명서 · 상태 다시 표시 · GOD MODE 백도어
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function 버튼_설명(){ document.getElementById('설명Bg').classList.add('show'); }
function 버튼_설명닫기(){ document.getElementById('설명Bg').classList.remove('show'); }
function 버튼_상태(){ 플레이_HUD갱신(); 프롬프트_갱신(); }

function 갓모드_활성화(){
  gs.god_mode_active = true;
  gs.hints = Infinity; gs.hearts = Infinity;
  gs.user_title = '최고 관리자님';
  if(gs.persona === null) gs.persona = 'Arrogant';
  로그_추가('🔓 어서 오십시오, 최고 관리자님. (힌트 ∞ · 목숨 ∞)', 'ok');
  if(gs.game_state === 'PLAYING'){ 플레이_HUD갱신(); 프롬프트_갱신(); }
}

if (typeof module !== 'undefined') module.exports = { gs, get_status };

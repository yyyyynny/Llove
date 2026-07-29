// '잇는' 게임 상태 — 파이썬 원본 GameState·Persona 클래스 이식 (Phase 3: 서바이벌 모드 한정).
// Llove 관례를 따라 클래스 대신 "상태 객체 + 그 객체를 받는 함수들" 구조로 옮긴다(필드는 원본과 1:1).
// 아케이드 전용 필드(층·저주·시련의 탑 등)는 Phase 4에서 실제로 쓰기 전까지 구조만 보존.
// 클래식 스크립트, 사전.js·엔진.js 뒤에 로드.

function 새게임상태(){
  return {
    game_state: 'INIT', game_mode: null, persona: null,
    turn: 0, stage: 1, stage_turn: 0, stage_start_turn: 0,
    score: 0, best: 0, hints: 3, hearts: 2, strikes: 0,
    attack_streak: 0, yield_attempts: 0, dispute_attempts: 0, deal_offered: false,
    command_typo_strikes: 0,
    // 아케이드 전용(Phase 4) — 서바이벌에서는 도달하지 않는 분기지만 필드는 원본과 동일하게 유지
    curse_time_floors: 0, curse_life_floors: 0, curse_dark_active: false, curse_dark_strikes: 0,
    trial_rejected_floor: -1, trial_attempts_this_floor: 0, trial_tower_entries: 0,
    user_title: null, history: [], ai_last_word: null, ai_last_char: null,
    last_log: 'System ready.',
    god_mode_active: false, erosion_level: 0,
    // hanbang 기본값: 2026-07-27 관리자님 지시로 false → true. 종전 기본값(끄기)은 곧 "한방
    // 단어를 내면 제재"라는 뜻인데, 한방 판정이 로컬 280단어 기준이라 정상 단어의 24~44%가
    // 오판돼 기본 플레이가 사실상 즉사 모드였다. 판정 자체도 고쳤지만(한방_확정인가), 기본값은
    // 처음 들어온 사람이 규칙을 모른 채 벌을 받지 않는 쪽으로 둔다.
    diff: '격동', dict_mode: 'Integrated', hanbang: true, dueum: 'Flexible',
    rev: false, pos: false, phrase: false, infinite: false,
  };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   난이도표 (2026-07-29 신설 — 관리자님 "난이도 차이가 안 느껴진다")
   ────────────────────────────────────────────────────────────────
   종전에 난이도가 실제로 바꾸던 것은 목표 턴 수·공격턴 확률·온라인 희귀어 사용 여부뿐이었고,
   목숨·힌트는 전 난이도 2개/3개로 동일했으며 AI가 단어를 고르는 방식도 전부 균등 랜덤이었다.
   → 목숨·힌트를 차등하고, AI에 **탐욕도**를 준다.

   탐욕도 = "상대(사용자)에게 남는 선택지를 얼마나 줄이려 드는가".
   각 후보 단어에 대해 '그 단어를 내면 사용자가 이을 수 있는 후보가 몇 개인가'를 세고,
   탐욕도가 높을수록 그 수가 적은 단어를 고른다. 로컬 사전만으로도 계산되므로
   **온라인(우리말샘) 공급이 불안정해도 난이도가 성립한다** — 이 설계의 요점.
     · 음수(안온) = 오히려 선택지를 많이 남기는 쪽을 고른다(봐준다)
     · 0(격동)    = 균등 랜덤(원본 그대로)
     · 양수       = 선택지가 적은 쪽을 고른다. 1.0이면 최솟값을 탐욕적으로 집는다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// 2026-07-29: 실수(strikes) 폐지로 **틀리면 곧바로 목숨 -1**이 되면서, 종전 목숨 값(2~3)이면
// 두세 번 만에 끝나 버린다. 실효 기회 수를 유지하려고 종전 "목숨 × 실수 4회" 수준으로 올렸다
// (안온 3×4=12 → 10, 격동 2×4=8 → 7 …). 난이도별 차등은 오히려 더 또렷해졌다.
const 난이도표 = {
  안온: { 턴:50,  목숨:10, 힌트:5, 탐욕도:-0.6, 공격확률:5  },
  격동: { 턴:75,  목숨: 7, 힌트:3, 탐욕도: 0.0, 공격확률:15 },
  초월: { 턴:140, 목숨: 5, 힌트:2, 탐욕도: 0.30, 공격확률:35 },
  심연: { 턴:160, 목숨: 3, 힌트:1, 탐욕도: 1.0, 공격확률:50 },
};
const 난이도설정 = gs => 난이도표[gs.diff] ?? 난이도표.격동;

function get_max_turns(gs){
  return 난이도설정(gs).턴;
}

// 아케이드 층별 목표 턴(원본 targets 표 + 14층 이후 +5씩 무한 증가) — 시간의 계약 걸리면 ×1.3
function get_stage_target(gs){
  const targets = {1:10,2:15,3:20,4:25,5:30,6:35,7:40,8:45,9:50,10:60,11:70,12:85,13:100};
  const base = targets[gs.stage] ?? (50 + (gs.stage - 14) * 5);
  return gs.curse_time_floors > 0 ? Math.floor(base * 1.3) : base;
}

function used_words(gs){ return gs.history.map(h => h.word); }

function reset_game(gs){
  // ⚠️ 2026-07-29: gs.stage 초기화 추가. 종전에는 reset_game이 층을 건드리지 않아, 모든 진입 경로가
  // full_reset이나 다시시작()을 거치는 덕에 우연히 안전했다. 설정 화면 뒤로가기(모드 재선택)가
  // 생기면서 "아케이드 7층에서 나갔다가 서바이벌 시작" 같은 경로가 열려 실제 결함이 된다
  // (stage>=13이면 3글자 족쇄가 서바이벌에도 걸린다).
  gs.stage = 1;
  gs.turn = 0; gs.stage_turn = 0; gs.stage_start_turn = 0; gs.score = 0;
  // 목숨·힌트를 난이도표에서 읽는다(2026-07-29). 아케이드는 층 진행이 난이도 역할을 하므로
  // 원본대로 목숨 2·힌트 3 고정(아래 ARCADE 분기에서 다시 덮어쓴다).
  const 난 = 난이도설정(gs);
  gs.hints = gs.god_mode_active ? Infinity : 난.힌트;
  gs.hearts = gs.god_mode_active ? Infinity : 난.목숨;
  gs.strikes = 0; gs.attack_streak = 0; gs.yield_attempts = 0; gs.dispute_attempts = 0;
  gs.deal_offered = false; gs.command_typo_strikes = 0;
  gs.curse_time_floors = 0; gs.curse_life_floors = 0; gs.curse_dark_active = false; gs.curse_dark_strikes = 0;
  gs.trial_rejected_floor = -1; gs.trial_attempts_this_floor = 0;
  gs.history = []; gs.ai_last_word = null; gs.ai_last_char = null; gs.erosion_level = 0;
  if(gs.game_mode === 'ARCADE'){
    gs.hearts = gs.god_mode_active ? Infinity : 8;   // 종전 목숨2 × 실수4회와 같은 실효 기회
    gs.hints  = gs.god_mode_active ? Infinity : 3;
    gs.trial_tower_entries = 0;
  }
}

function full_reset(gs){
  const god = gs.god_mode_active, persona = gs.persona;
  Object.assign(gs, 새게임상태());
  if(god){
    gs.god_mode_active = true;
    gs.user_title = '최고 관리자님';
    gs.hints = Infinity; gs.hearts = Infinity;
    gs.persona = persona;
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   페르소나 — 원본 Persona 클래스를 상태 객체 기반 함수로 이식.
   원본 print()는 웹에서 "메시지 로그에 한 줄 추가"로 대체(서바이벌.js의 로그_추가가 담당).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function is_arrogant(gs){ return gs.persona === 'Arrogant'; }

// 원본 say(arrogant_msg, polite_msg)는 print만 함 — 여기선 어느 문구를 쓸지 "고른 문자열"만 반환.
// 실제 화면 표시는 호출부가 로그_추가()로 한다(원본의 print 호출부와 1:1 대응).
function say(gs, arrogant_msg, polite_msg){ return is_arrogant(gs) ? arrogant_msg : polite_msg; }

function title(gs){
  if(gs.god_mode_active) return '최고 관리자님';
  return gs.user_title || (is_arrogant(gs) ? '필멸자' : '사용자님');
}

function react_correct(gs){
  const a = ['흥... 이번엔 맞췄군.', '크크... 제법 하는데?', '그래, 그 정도는 해줘야지.'];
  const p = ['좋아요! 잘하고 계십니다!', '정답입니다! 훌륭해요!', '멋진 단어 선택이에요!'];
  const pool = is_arrogant(gs) ? a : p;
  return pool[Math.floor(Math.random() * pool.length)];
}

function react_ai_word(gs, word){
  const a = [
    `흥... 『${word}』이다.`,
    `크크... 『${word}』. 이을 수 있겠나?`,
    `『${word}』... 받아라, ${title(gs)}여.`,
    `감히 이어 보거라. 『${word}』.`,
  ];
  const p = [
    `제 단어는 『${word}』입니다!`,
    `『${word}』(으)로 이어가겠습니다!`,
    `음... 『${word}』 어떠세요?`,
  ];
  const pool = is_arrogant(gs) ? a : p;
  return pool[Math.floor(Math.random() * pool.length)];
}

if (typeof module !== 'undefined') module.exports = {
  난이도표, 난이도설정, 새게임상태, get_max_turns, get_stage_target, used_words, reset_game, full_reset,
  is_arrogant, say, title, react_correct, react_ai_word
};

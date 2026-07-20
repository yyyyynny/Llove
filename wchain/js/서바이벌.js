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
function 설정_렌더(){
  document.getElementById('opt-사전').innerHTML = `📚 사전 모드<div class="d">${gs.dict_mode} (Phase 5 국립국어원 연동 후 실사용)</div>`;
  document.getElementById('opt-난이도').innerHTML = `🔥 난이도<div class="d">${gs.diff}</div>`;
  document.getElementById('opt-한방').innerHTML = `⚔ 한방 모드<div class="d">${gs.hanbang ? 'ON' : 'OFF'}</div>`;
  document.getElementById('opt-두음').innerHTML = `📏 두음법칙<div class="d">${gs.dueum}</div>`;
  document.getElementById('opt-무한').innerHTML = `🔁 무한 모드<div class="d">${gs.infinite ? 'ON' : 'OFF'}</div>`;
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('opt-사전').onclick = () => { gs.dict_mode = gs.dict_mode === 'Integrated' ? 'Standard' : 'Integrated'; 설정_렌더(); };
  document.getElementById('opt-난이도').onclick = () => {
    const order = ['안온','격동','초월','심연'];
    gs.diff = order[(order.indexOf(gs.diff) + 1) % 4]; 설정_렌더();
  };
  document.getElementById('opt-한방').onclick = () => { gs.hanbang = !gs.hanbang; 설정_렌더(); };
  document.getElementById('opt-두음').onclick = () => {
    const order = ['OFF','Flexible','Strict'];
    gs.dueum = order[(order.indexOf(gs.dueum) + 1) % 3]; 설정_렌더();
  };
  document.getElementById('opt-무한').onclick = () => { gs.infinite = !gs.infinite; 설정_렌더(); };
});

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
  document.getElementById('hud-목숨').textContent = `${표시무한(gs.hearts)} / ${gs.strikes}·4`;
  document.getElementById('ai-단어').textContent = gs.ai_last_word ? `『${gs.ai_last_word}』` : '─';

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

function 프롬프트_갱신(){
  const 안내 = document.getElementById('prompt-안내');
  안내.textContent = gs.ai_last_char
    ? `『${gs.ai_last_char}』(으)로 시작하는 단어를 입력하세요`
    : '첫 단어를 자유롭게 입력하세요';
  document.getElementById('btn-먼저').style.display = (gs.ai_last_char === null) ? '' : 'none';
  document.getElementById('btn-이의').style.display = gs.ai_last_word ? '' : 'none';
  document.getElementById('btn-허세').style.display = gs.ai_last_word ? '' : 'none';
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
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function 단어_제출(){
  const inp = document.getElementById('단어입력');
  const raw = (inp.value || '').trim();
  inp.value = '';
  if(!raw) return false;
  if(gs.game_state !== 'PLAYING') return false;

  // 백도어 — 원본 "/yyyyynny" 그대로. Llove의 관리자 백도어와 같은 시퀀스를 잇는 세계에도 심어둠.
  if(raw === '/yyyyynny'){ 갓모드_활성화(); return false; }

  로그_추가('▶ ' + raw);
  const [valid, reason] = validate_word(raw, gs);

  if(!valid){
    // ⚠️ 노션 11번 반영: 기본 모드(비아케이드)에서 한방 단어 + 한방모드 OFF면 즉시 패배.
    //    (원본은 이 경우도 실수 1회로 처리하던 결함 — validate_word 사유 문자열로 정확히 식별)
    //    GOD MODE는 예외 — 즉시패배는 목숨 소모 없이 발동하는 규칙이라 hearts=∞로도 못 막는데,
    //    관리자 전용 모드가 오히려 일반 유저보다 쉽게 죽는 건 원본 취지(무한 힌트·목숨)에 어긋남.
    if(gs.game_mode !== 'ARCADE' && !gs.hanbang && !gs.god_mode_active
       && reason.endsWith('한방 단어입니다. (일반 모드에서 사용 불가)')){
      로그_추가(say(gs, `푸하하! ${reason}`, `아쉽지만 ${reason}`), 'err');
      로그_추가(say(gs, `크윽... 『${raw}』은(는) 이을 수 없는 한방 단어였다. 즉시 패배 처리한다.`,
                    `『${raw}』은(는) 더 이상 이을 수 없는 한방 단어예요. 이번 판은 여기까지입니다.`), 'err');
      if(gs.turn > gs.best) gs.best = gs.turn;
      게임오버(false);
      return false;
    }
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

  // AI 턴
  gs.ai_last_char = !gs.rev ? raw[raw.length - 1] : raw[0];
  const ai_word = ai_generate_word(gs);

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

  if(!gs.hanbang && is_hanbang(ai_word, used_words(gs), gs.rev, gs.dueum, gs.stage)){
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

function 버튼_이의(){
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
      const new_ai = ai_generate_word(gs);
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
}

// 원본 bluff_kw 분기 — AI는 항상 사전에 있는 단어만 내므로(ai_generate_word가 DICTIONARY/HARD_DICT에서만
// 고름) 실질적으로 항상 "허세 부리는 건가?" 조롱만 나온다(원본에서도 else 분기는 사실상 도달 불가).
function 버튼_허세(){
  if(!gs.ai_last_word) return;
  로그_추가(say(gs, `크크크... 허세를 부리는 건가? 『${gs.ai_last_word}』은(는) 등록된 단어다.`,
                `앗, 『${gs.ai_last_word}』은(는) 사전에 등록된 단어가 맞아요!`));
  플레이_HUD갱신(); 프롬프트_갱신();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   힌트 (원본 handle_hint/deliver_hint — 서바이벌 경로만)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function 버튼_힌트(){
  if(gs.game_state !== 'PLAYING') return;
  if(gs.ai_last_char === null){ 로그_추가('ℹ️ 첫 단어는 자유롭게 입력하세요. 힌트가 필요하지 않습니다.', 'sys'); return; }

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

  const cands = find_words(gs.ai_last_char, used_words(gs), gs.rev, gs.dueum, 0, 0);

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
    // 원본: 계약 즉시 힌트 1회를 바로 제공
    const cands = find_words(gs.ai_last_char, used_words(gs), gs.rev, gs.dueum, 0, 0);
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

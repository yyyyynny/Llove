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
  // 플레이 중에는 타이틀 블록을 접어 화면을 로그·입력창에 내준다(CSS의 body.playing 규칙).
  document.body.classList.toggle('playing', id === '플레이');
}

/* ── 로그 ── */
function 로그_추가(text, cls){
  const log = document.getElementById('로그');
  if(!log) return;
  const line = document.createElement('div');
  // fu = Llove와 동일한 fadeUp 진입(2026-08-15 신설) — 매번 새로 만드는 노드라 리트리거 불필요.
  line.className = 'line fu' + (cls ? ' ' + cls : '');
  line.textContent = text;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}
function 로그_비우기(){ const l = document.getElementById('로그'); if(l) l.innerHTML = ''; }

const 표시무한 = n => (n === Infinity ? '∞' : String(n));

// 목숨·힌트 감소 시 HUD를 흔들기 위한 이전 값 추적(2026-08-15 신설). null이면 아직 첫 갱신
// 전이라는 뜻 — 첫 페인트에서 오탐(0에서 시작값으로 "증가"하는 걸 감소로 착각) 방지.
let _이전힌트 = null, _이전목숨 = null;

// 값이 줄었을 때만 요소를 흔든다. 화면전환.js의 리플로우 재시작 관례(style.animation 토글)를
// 그대로 재사용 — 연속으로 줄어도 매번 다시 흔들리게 한다.
function 흔들기(el){
  if(!el) return;
  el.classList.add('hit');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  setTimeout(() => el.classList.remove('hit'), 450);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   페르소나 선택 → 모드 선택 (원본 _handle_init/_handle_mode_select)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function 선택_페르소나(p){
  gs.persona = p;
  if(!gs.god_mode_active) gs.user_title = (p === 'Arrogant') ? '필멸자' : '사용자님';
  gs.game_state = 'MODE_SELECT';
  화면('모드');
}

// 2026-07-29: 아케이드도 설정 화면을 거친다(관리자님 지적 "아케이드 모드는 따로 설정 선택이 없음").
// 원본 파이썬은 아케이드를 설정 불가 모드로 뒀지만, 두음법칙·구 허용처럼 아케이드에서도 의미가 있는
// 항목까지 기본값에 묶여 있었다. 모드별로 의미 있는 항목만 보여주고, 규칙상 고정인 항목은 잠금 행으로
// 이유와 함께 노출한다(설정_항목의 `모드` 필드가 이 필터링을 담당).
function 선택_모드(mode){
  gs.game_mode = mode;
  reset_game(gs);
  gs.game_state = 'READY';
  화면('설정');
  설정_렌더();
}

/* ── 뒤로가기 (2026-07-29 신설) ──────────────────────────────────────────
   종전엔 페르소나를 잘못 고르거나 모드를 바꾸려면 '리셋'으로 전부 날리는 수밖에 없었다.
   화면만 되돌리고 진행 중인 판이 없으므로 상태는 건드리지 않는다. */
function 뒤로_페르소나(){
  gs.game_state = 'INIT';
  화면('페르소나');
}
function 뒤로_모드(){
  gs.game_state = 'MODE_SELECT';
  화면('모드');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   서바이벌 설정 (원본 _show_ready/_handle_ready 1~4·D)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* 설정 화면 — 2026-07-28 Llove 설정창 문법으로 재작성(관리자님 지시 "설정 창은 Llove 것을 따올 것").
   구조는 Llove/index.html의 설정 화면과 동일: .set-sec 섹션 → .set-row 행(.sri 아이콘 + .srl 제목 +
   .srs 현재값 설명) → 다지선다는 .fs-opt 칩, ON/OFF는 .mt 토글 스위치.
   · 칩 항목의 .srs는 **선택된 값의 설명**을 보여준다(Llove의 "화면 크기 100% — ..." 행과 같은 문법).
   · 토글 항목의 .srs는 현재 상태(켬/끔)에 맞는 설명으로 바뀐다.
   선택지 3번째 칸이 그 값을 골랐을 때의 .srs 문구다. */
// 난이도 칩의 설명 한 줄 — 숫자는 전부 난이도표에서 읽어 온다(값이 두 곳에 적히지 않게).
function 난이도설명(이름, 성향){
  const d = 난이도표[이름];
  return `${d.턴}턴 · 목숨${d.목숨} 힌트${d.힌트} — ${성향}`;
}

const 설정_항목 = [
  // `모드` = 이 항목이 의미를 갖는 게임 모드. 없으면 두 모드 모두에 표시.
  // `잠금(gs)` = 그 모드에서 규칙상 고정인 항목 — 조작을 막고 이유를 함께 보여준다.
  // ⚠️ 난이도 설명의 숫자는 난이도표(게임상태.js)에서 직접 읽는다. 종전에는 여기에 손으로 적어
  // 둬서, 실수 폐지로 목숨을 4배 올렸을 때 설명만 옛 숫자로 남는 식의 어긋남이 생겼다.
  { 키:'diff', 종류:'칩', 아이콘:'🔥', 라벨:'난이도', 모드:['SURVIVAL'],
    선택지:[['안온','안온', 난이도설명('안온', '상대가 쉬운 단어로 봐줍니다')],
           ['격동','격동', 난이도설명('격동', '상대가 아무 단어나 냅니다')],
           ['초월','초월', 난이도설명('초월', '상대가 잇기 어려운 단어를 노립니다')],
           ['심연','심연', 난이도설명('심연', '상대가 매번 최악의 수를 둡니다 (거래 불가)')]] },
  { 키:'rev', 종류:'칩', 아이콘:'🔁', 라벨:'진행 방향',
    선택지:[[false,'끝말잇기','마지막 글자로 잇습니다'],[true,'앞말잇기','첫 글자로 잇습니다 (두음법칙 미적용)']] },
  { 키:'dueum', 종류:'칩', 아이콘:'📏', 라벨:'두음법칙',
    선택지:[['OFF','끄기','두음법칙을 쓰지 않습니다'],['Flexible','유연','력→역·니→이 등 폭넓게 허용'],
           ['Strict','엄격','표준 두음법칙만 허용']] },
  { 키:'hanbang', 종류:'토글', 아이콘:'⚔', 라벨:'한방 모드',
    잠금:gs => gs.game_mode === 'ARCADE',
    잠금설명:'아케이드에서는 한방 단어를 쓸 수 없습니다 (탑의 규칙)',
    켬설명:'상대가 이을 수 없는 한방 단어도 자유롭게 쓸 수 있습니다',
    끔설명:'한방 단어를 내면 목숨 1개가 깎입니다' },
  { 키:'infinite', 종류:'토글', 아이콘:'🔄', 라벨:'무한 모드', 모드:['SURVIVAL'],
    켬설명:'턴 제한 없이 계속 이어갑니다',
    끔설명:'난이도별 목표 턴까지 생존하면 승리합니다' },
  { 키:'phrase', 종류:'토글', 아이콘:'✂️', 라벨:'구 허용',
    켬설명:'띄어쓰기 한 번(두 단어)까지 한 단어로 인정합니다',
    끔설명:'붙여 쓴 한 단어만 인정합니다' },
];

// 이 설정 항목이 현재 모드에서 의미가 있는지
function 설정_해당모드(항목){
  return !항목.모드 || 항목.모드.includes(gs.game_mode);
}

function 설정_렌더(){
  // 어느 모드 설정을 보고 있는지 화면에 명시(종전엔 '서바이벌 설정' 고정 문구였다)
  const 제목 = document.getElementById('설정-제목');
  if(제목) 제목.textContent = (gs.game_mode === 'ARCADE') ? '아케이드 · 게임 규칙' : '서바이벌 · 게임 규칙';
  const 칩통 = document.getElementById('설정-규칙');
  const 토글통 = document.getElementById('설정-토글');
  if(!칩통 || !토글통) return;

  칩통.innerHTML = 설정_항목.map((항목, i) => {
    if(항목.종류 !== '칩' || !설정_해당모드(항목)) return '';
    const 현재 = 항목.선택지.find(([값]) => gs[항목.키] === 값);
    const 칩들 = 항목.선택지.map(([값, 이름], j) => {
      const 선택됨 = gs[항목.키] === 값;
      return `<button class="fs-opt${선택됨 ? ' on' : ''}" onclick="설정_선택(${i},${j})"`
           + `${선택됨 ? ' aria-current="true"' : ''}>${이름}</button>`;
    }).join('');
    return `<div class="set-row col"><div class="top"><span class="sri">${항목.아이콘}</span>`
         + `<div style="flex:1"><div class="srl">${항목.라벨}</div><div class="srs">${현재 ? 현재[2] : ''}</div></div></div>`
         + `<div class="fs-opts">${칩들}</div></div>`;
  }).join('');

  // 토글 행 — 행 전체가 <label>이라 아무 데나 눌러도 스위치가 젖혀진다(Llove 조작감)
  토글통.innerHTML = 설정_항목.map(항목 => {
    if(항목.종류 !== '토글' || !설정_해당모드(항목)) return '';
    const 잠김 = typeof 항목.잠금 === 'function' && 항목.잠금(gs);
    const 켬 = !!gs[항목.키];
    // 잠긴 항목은 스위치 대신 자물쇠를 두고 이유를 설명한다(조작해도 소용없는 걸 조작하게 두지 않는다)
    if(잠김){
      return `<div class="set-row" style="cursor:default"><span class="sri">${항목.아이콘}</span>`
           + `<div style="flex:1"><div class="srl">${항목.라벨}</div><div class="srs">${항목.잠금설명}</div></div>`
           + `<span class="sra">🔒</span></div>`;
    }
    return `<label class="set-row"><span class="sri">${항목.아이콘}</span>`
         + `<div style="flex:1"><div class="srl">${항목.라벨}</div><div class="srs">${켬 ? 항목.켬설명 : 항목.끔설명}</div></div>`
         + `<span class="mtw"><span class="mt"><input type="checkbox"${켬 ? ' checked' : ''} `
         + `onchange="설정_토글('${항목.키}', this.checked)"><span class="mtt"><span class="mtth"></span></span></span></span></label>`;
  }).join('');

  // 화면 섹션 — Llove 테마 연동 토글 하나(2026-07-29). 기본은 꺼짐(잇는 고유 테마).
  const 화면줄 = document.getElementById('설정-화면');
  if(화면줄){
    const 켬 = 테마연동_켜짐();
    화면줄.innerHTML = `<label class="set-row"><span class="sri">🎨</span>`
      + `<div style="flex:1"><div class="srl">Llove 테마 연동</div>`
      + `<div class="srs">${테마연동_설명()}</div></div>`
      + `<span class="mtw"><span class="mt"><input type="checkbox"${켬 ? ' checked' : ''} `
      + `onchange="설정_테마연동(this.checked)"><span class="mtt"><span class="mtth"></span></span></span></span></label>`;
  }

  // 사전 모드(dict_mode)는 Worker가 아직 우리말샘 한 곳만 서빙해서 실제 판정에 영향이 없다.
  // 동작하는 것처럼 보여주면 거짓이 되므로 준비 중임을 명시한다(이의/허세 봉인과 같은 🔒 관례).
  const 사전줄 = document.getElementById('설정-사전');
  if(사전줄){
    사전줄.innerHTML = `<span class="sri">📚</span>`
      + `<div style="flex:1"><div class="srl">사전 모드</div>`
      + `<div class="srs">우리말샘(통합)만 사용합니다 — 표준국어대사전은 인증키가 준비되면 열립니다.</div></div>`
      + `<span class="sra">🔒</span>`;
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

function 설정_토글(키, 켬){
  gs[키] = 켬;
  설정_렌더();
}

// 테마 연동은 gs가 아니라 localStorage에 저장된다(판이 바뀌어도 유지되는 화면 설정).
function 설정_테마연동(켬){
  테마연동_설정(켬);
  설정_렌더();
}

function 게임_시작(){
  reset_game(gs);
  세션_비우기();   // 이전 판에서 모은 단어·실패 카운터를 새 판으로 들고 가지 않는다
  _이전힌트 = null; _이전목숨 = null;   // 새 판 시작값을 "감소"로 오탐하지 않게 추적값도 초기화
  if(gs.rev && gs.dueum !== 'OFF'){ gs.dueum = 'OFF'; }   // 원본: 앞말잇기는 두음법칙 자동 OFF
  gs.game_state = 'PLAYING';
  로그_비우기();

  if(gs.game_mode === 'ARCADE'){
    // 원본 _handle_mode_select의 아케이드 진입 연출(설정 화면이 앞에 붙었을 뿐 내용은 그대로)
    로그_추가('⚔ 언어의 탑이 그 문을 열었다.', 'sys');
    로그_추가('⚔ 13층 정상까지 — 살아남겠는가?', 'sys');
    로그_추가(대사(gs, '게임_시작_2'));
    화면('플레이');
    플레이_HUD갱신(); 프롬프트_갱신();
    return;
  }

  // 난이도별 시작 대사도 data/대사.json에 있다 — 키는 `게임_시작_난이도_<난이도>`.
  const dialogue = gs.infinite
    ? 대사(gs, '게임_시작_1')
    : 대사(gs, '게임_시작_난이도_' + gs.diff);
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
    st.textContent = status; st.className = 'status-' + status;
  } else {
    const max_t = gs.infinite ? 0 : get_max_turns(gs);
    턴라벨.textContent = '⏳ 턴';
    document.getElementById('hud-턴').textContent = gs.infinite ? `${gs.turn} / ∞` : `${gs.turn} / ${max_t}`;
    document.getElementById('hud-바').style.width = ((!gs.infinite && max_t) ? Math.min(100, Math.round(gs.turn / max_t * 100)) : 0) + '%';
    const st = document.getElementById('hud-상태');
    const status = gs.infinite ? '🟢' : get_status(gs.turn, max_t);
    st.textContent = status; st.className = 'status-' + status;
  }
  // 목숨·힌트가 줄었을 때만 흔들어 알린다(2026-08-15 신설) — 종전엔 다른 갱신과 똑같이
  // 조용히 숫자만 바뀌어서 목숨을 잃어도 체감이 안 됐다. 텍스트를 덮어쓰기 전에 비교한다.
  const 힌트요소 = document.getElementById('hud-힌트');
  const 목숨요소 = document.getElementById('hud-목숨');
  if(_이전힌트 !== null && typeof gs.hints === 'number' && gs.hints < _이전힌트) 흔들기(힌트요소);
  if(_이전목숨 !== null && typeof gs.hearts === 'number' && gs.hearts < _이전목숨) 흔들기(목숨요소);
  _이전힌트 = gs.hints; _이전목숨 = gs.hearts;

  힌트요소.textContent = 표시무한(gs.hints) + '개';
  // 실수(strikes) 폐지(2026-07-29)로 이 칸은 목숨 하나만 보여준다 — 종전 "목숨 · 실수" 2단 표기 삭제.
  목숨요소.textContent = `${표시무한(gs.hearts)}개`;
  // '상대의 단어' 라벨이 붙었으므로 『』 겹장식을 뺀다 — 단어 자체가 더 크게 읽힌다.
  document.getElementById('ai-단어').textContent = gs.ai_last_word || '─';
  const 라벨 = document.getElementById('ai-라벨');
  if(라벨) 라벨.textContent = '상대의 단어';
  // 첫 턴엔 상대 단어가 없으므로 카드를 안내문 한 줄로 접는다(CSS .ai-word.empty)
  document.querySelector('.ai-word')?.classList.toggle('empty', !gs.ai_last_word);
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
  // 어느 모드에 있는지 항상 첫 칩으로 — 종전엔 아케이드만 이름이 나오고 서바이벌은 난이도만 떠서
  // "내가 지금 무슨 모드지?"가 화면에 없었다(관리자님 지적, 2026-07-29).
  if(gs.game_mode === 'ARCADE'){
    칩.push('🗼 아케이드');
  } else {
    칩.push('🕰 서바이벌');
    칩.push(`🔥 ${gs.diff}`);
    if(gs.infinite) 칩.push('🔄 무한');
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
// 점 세 개 점멸만 사용 — 기존 화면 톤과 맞는 절제된 표시(2026-08-15부터 애니메이션 규칙이
// 방식 제한 대신 "통일성·불쾌감 없음" 기준으로 바뀌었지만, 이 선택 자체는 그대로 유효하다).
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
    // 잠금이 풀리는 시점에 포커스를 돌려준다. 턴 처리 중에 불린 프롬프트_갱신()의 focus()는
    // 입력창이 아직 disabled라 무시되므로(2026-07-26 회귀 — 매 턴 입력창을 다시 탭해야 했다),
    // 실제로 입력이 가능해지는 여기서 한 번 더 맞춘다. 플레이 화면이 떠 있을 때만.
    if(document.getElementById('s-플레이')?.classList.contains('active')) inp.focus();
  }
}

// innerHTML로 글자를 강조하므로, 화면에 넣기 전에 HTML 특수문자를 막는다.
// (ai_last_char는 검증된 단어에서 온 한 글자라 실질 위험은 없지만, 문자열이 DOM으로 가는
//  경로에는 예외 없이 이스케이프를 둔다.)
const HTML막기 = s => String(s).replace(/[&<>"']/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

// 온라인(우리말샘) 후보 조회 결과를 로그에 남긴다 (2026-07-29 신설).
// 종전에는 조회가 실패해도 조용히 로컬로 강등돼, 관리자님이 "심연인데 희귀어가 안 나온다"고
// 느끼셨을 때 그게 난이도 설정 탓인지 네트워크 탓인지 화면만 봐서는 구분할 수 없었다.
function 온라인조회_보고(){
  const r = 마지막_온라인조회;
  if(r.상태 === '미시도') return;   // 게이트 off 등 — 조용히
  if(r.상태 === '실패'){
    // 2026-07-29: 로컬 사전이 없어졌으므로 "로컬로 진행"이라는 말은 더 이상 사실이 아니다.
    // 이번 판에서 이미 받아 둔 단어(세션 사전)로 버틴다는 걸 정확히 알린다.
    if(우리말샘_불통인가()){
      로그_추가('⛔ 우리말샘에 계속 연결하지 못하고 있습니다. 네트워크를 확인해 주세요 — '
              + '이번 판에서 받아 둔 단어만으로 진행 중이라 곧 막힐 수 있습니다.', 'err');
    } else {
      로그_추가('⚠️ 우리말샘에 연결하지 못해 이번 판에서 받아 둔 단어로 진행합니다.', 'warn');
    }
  } else if(r.상태 === '없음'){
    로그_추가('🌐 우리말샘에 이을 단어가 없습니다.', 'sys');
  } else if(r.개수 <= 3){
    // 후보가 이만큼 적으면 다음 한두 수 안에 막힌다. 개수만 무심히 보여주면 사용자는 판이
    // 왜 갑자기 끝나는지 모른다 — 지금 Worker가 후보를 적게 주는 탓임을 미리 알린다
    // (근본 원인·수정 방법은 wchain/Worker_수정요청.md ②).
    로그_추가(`🌐 우리말샘 후보가 ${r.개수}개뿐입니다 — 이 글자는 곧 막힐 수 있습니다.`, 'warn');
  } else {
    로그_추가(`🌐 우리말샘 후보 ${r.개수}개를 사용합니다.`, 'sys');
  }
}

// AI가 단어를 낸 뒤, **사용자가 이을 수 있는 단어가 정말 있는지** 미리 확인해 알린다.
// (2026-07-29 신설 — 후보 부족으로 판이 막힐 때 종전에는 아무 안내 없이 목숨만 계속 잃었다.)
//
// 화면 흐름을 막지 않도록 결과를 기다리지 않고(fire-and-forget) 부르며, 되돌아왔을 때
// 판이 바뀌었거나(세대) 이미 다음 턴으로 넘어갔으면 조용히 버린다.
async function 막다른길_확인(내세대, 기준글자){
  if(!국어원_활성화 || !기준글자) return;
  try{
    const 방향 = gs.rev ? 'end' : 'start';
    const 글자들 = gs.rev ? [기준글자] : get_valid_start_chars(기준글자, gs.dueum);
    const 결과들 = await Promise.all(글자들.map(c => 국어원_후보목록조회(c, 방향)));
    if(내세대 !== 게임_세대) return;                      // 리셋·재도전으로 판이 바뀜
    if(gs.ai_last_char !== 기준글자) return;              // 이미 다음 턴으로 넘어감
    if(결과들.some(r => r === null)) return;              // 확인을 못 했으면 말하지 않는다

    const 합본 = [];
    결과들.forEach((r, i) => {
      세션_조회글자.add(방향 + ':' + 글자들[i]);
      for(const w of r) if(!합본.includes(w)) 합본.push(w);
    });
    세션_수집(합본);
    const 이을수있음 = find_words(기준글자, used_words(gs), gs.rev, gs.dueum, 0,
                                 gs.stage >= 13 ? 3 : 0, 합본);
    if(!이을수있음.length){
      로그_추가(`⚠️ 『${기준글자}』(으)로 ${gs.rev ? '끝나는' : '시작하는'} 단어를 우리말샘에서 `
              + '찾지 못했습니다. 아는 단어가 있으면 그대로 입력해 보세요 — 우리말샘에 있으면 인정됩니다.',
              'warn');
    }
  }catch(e){ console.error('[막다른길] 확인 실패', e); }
}

function 프롬프트_갱신(){
  const 안내 = document.getElementById('prompt-안내');
  // 이어야 할 글자는 이 화면에서 제일 중요한 정보인데 종전엔 작은 회색 안내문에 묻혀 있었다 —
  // 배지로 띄워 한눈에 들어오게 한다(2026-07-28). 방향에 따라 '시작/끝'도 정확히 구분한다.
  안내.innerHTML = gs.ai_last_char
    ? `<span class="need">${HTML막기(gs.ai_last_char)}</span>(으)로 `
      + `${gs.rev ? '끝나는' : '시작하는'} 단어`
    : '첫 단어를 자유롭게 입력하세요';
  document.getElementById('btn-먼저').style.display = (gs.ai_last_char === null) ? '' : 'none';
  // 이의·허세 진행도 표시(2026-08-19, 봉인 해제) — "몇 번째인지 안 보여서 아무 일도 안 일어난다고
  // 느낀다"는 옛 봉인 사유를 라벨에 잔여 횟수를 노출해 없앤다. 다 쓰면 눌러도 되지만(버튼_이의가
  // 즉시 안내하고 끝냄) 시각적으로도 소진을 알 수 있게 잠금 스타일을 재사용한다.
  for(const [id, 라벨] of [['btn-이의','이의 있음'], ['btn-허세','그 단어 없어!']]){
    const el = document.getElementById(id);
    el.style.display = gs.ai_last_word ? '' : 'none';
    const 소진 = gs.dispute_attempts >= 이의_최대횟수;
    el.textContent = `${라벨} (${gs.dispute_attempts}/${이의_최대횟수})`;
    el.classList.toggle('locked', 소진);   // 활성 버튼과 같은 비중으로 보이지 않게
  }
  // '뜻 보기'(2026-08-22 신설) — 판정·소모가 없으니 진행도 라벨도 잠금도 없다. AI가 단어를
  // 낸 뒤에만 노출(볼 뜻이 없으면 의미 없는 버튼).
  const 뜻보기btn = document.getElementById('btn-뜻보기');
  if(뜻보기btn) 뜻보기btn.style.display = gs.ai_last_word ? '' : 'none';
  // '적절성 검증'(2026-08-22 신설) — 이의있음·허세와 같은 예산(dispute_attempts)을 공유하므로
  // 진행도 라벨도 같은 값을 보여준다. 그록 게이트가 꺼져 있는 동안은 항상 잠금 스타일만
  // 표시(버튼_적절성검증이 클릭 시 안내로 처리 — 여기서 숨기지 않는 이유는 존재를 미리
  // 알려서 다음 업데이트를 기대하게 하기 위함, Llove 실험실 티저와 같은 취지).
  const 적절성btn = document.getElementById('btn-적절성검증');
  if(적절성btn){
    적절성btn.style.display = gs.ai_last_word ? '' : 'none';
    const 소진 = gs.dispute_attempts >= 이의_최대횟수;
    // 라벨이 '적절성 검증'이 아니라 '적절성'인 이유: .util-row 는 3열 그리드라 360px 기기에서
    // 칸 안쪽이 95px뿐인데, 게이트가 켜진 뒤 붙는 '(0/5)'까지 넣으면 '🤖 적절성 검증 (0/5)'는
    // 101px로 6px 잘린다(2026-08-22 실측). '🤖 적절성 (0/5)'는 75px로 여유 있게 들어간다.
    적절성btn.textContent = `🤖 적절성${적절성검증_활성화 ? ` (${gs.dispute_attempts}/${이의_최대횟수})` : ' 🔒'}`;
    적절성btn.classList.toggle('locked', 소진 || !적절성검증_활성화);
  }
  // 관리자 패널 버튼 — 백도어 승인 후에만 보인다(토글 난립 대신 버튼 하나로 통일)
  const 관리자btn = document.getElementById('btn-관리자');
  if(관리자btn) 관리자btn.style.display = gs.god_mode_active ? '' : 'none';
  선택박스_숨기기();
  const form = document.getElementById('입력폼');
  form.style.display = '';
  // 턴 처리 중이면 입력창이 잠겨 있어 focus()가 먹지 않는다 — 잠금 해제 시점(입력_대기표시)이
  // 대신 포커스를 맞춘다. 여기서 헛되이 부르지 않도록 가드.
  const inp = document.getElementById('단어입력');
  if(!inp.disabled) inp.focus();
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
   Phase 5: 로컬 사전에 없는 단어는(게이트가 켜져 있을 때만) 우리말샘 API로 한 번 더
   확인한다 — validate_word 자체는 순수·동기 함수로 그대로 두고(파이썬 대조 500/500 유지),
   비동기 온라인 조회는 이 UI 레이어에서만 감싼다. 게이트 기본값이 false라 지금은 항상
   기존과 동일하게 로컬 사전 판정만 탄다(행동 변화 없음).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// 재진입 가드 — 국어원 게이트가 켜진 뒤로 단어 검증(온라인 존재 조회)·AI 턴(온라인 후보 조회)이
// 비동기가 되면서, 그 대기(최대 1.5초) 동안 사용자가 빠르게 재입력하면 gs.history 이중 push·turn
// 이중 증가로 게임 상태가 깨질 수 있다. 처리 중 재입력/이의 클릭은 이 플래그로 무시한다.
// (전부 동기였던 게이트 off 시절엔 이 창 자체가 없었음 — 비동기 전환으로 새로 생긴 문제.)
let 게임_비동기처리중 = false;

// 판 세대 토큰(2026-07-27 신설). 온라인 조회를 기다리는 동안 사용자가 리셋·재도전·게임 데이터
// 삭제를 누르면 gs가 통째로 초기화되는데, 종전에는 진행 중이던 단어_처리 IIFE가 그대로 이어져
// 새 판에 history를 push하고 게임오버까지 띄웠다. 되돌아온 결과의 세대가 다르면 폐기한다.
let 게임_세대 = 0;
function 게임_세대올리기(){ 게임_세대 += 1; 게임_비동기처리중 = false; 강제_AI단어 = null; }

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
  const 내세대 = 게임_세대;
  (async () => {
    try{
      로그_추가('▶ ' + raw, 'me');
      let [valid, reason] = validate_word(raw, gs);

      // 로컬 사전에 없어서만 실패했고 국어원 게이트가 켜져 있으면 온라인 조회로 재확인.
      if(!valid && 국어원_활성화 && reason.endsWith('사전에 없는 단어입니다.')){
        로그_추가('🔎 우리말샘에서 찾아보는 중...', 'sys');
        const 존재함 = await 국어원_단어조회(raw);
        // null = 네트워크 실패/시간초과로 "확인 자체를 못 함" — 진짜로 사전에 없는 것과 달리
        // 사용자 잘못이 아니므로 실수(user_defeat)를 매기지 않고 그대로 재시도할 수 있게 둔다.
        if(존재함 === null){
          로그_추가('⚠️ 우리말샘 확인에 실패했습니다(네트워크 문제로 추정). 같은 단어를 다시 입력해 보세요.', 'warn');
          return;
        }
        if(존재함){
          // API로 사전 등재가 확인된 단어 — validate_word의 다음 단계(한방 판정)를 동일하게 재현
          // (사전 소속 여부만 API가 대신했을 뿐, 그 이후 규칙은 로컬 판정과 완전히 같아야 한다)
          세션_수집(raw);   // 확인된 단어는 세션 사전에 쌓는다(네트워크가 끊겨도 판이 이어지게)
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

      // 조회를 기다리는 사이 리셋·재도전·데이터 삭제가 일어났으면 이 턴의 결과를 버린다
      // (새 판의 상태를 오염시키지 않기 위해 — 아래 finally도 세대를 확인한다).
      if(내세대 !== 게임_세대) return;
      await 단어_처리(raw, valid, reason);
    } finally {
      if(내세대 === 게임_세대){
        게임_비동기처리중 = false;
        입력_대기표시(false);
      }
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
    로그_추가(대사(gs, '단어_처리_8', [reason]), 'err');
    const result = user_defeat(gs);
    if(result === 'game_over'){ 게임오버(false); return false; }
    플레이_HUD갱신(); 프롬프트_갱신();
    return false;
  }

  // 원본의 정답 반응(react_correct) — 이식 때 호출부가 통째로 빠져 있어서 맞는 단어를 내도
  // 화면에 아무 반응이 없었다(2026-07-27 복원). AI 단어 반응(react_ai_word)만 살아 있었다.
  로그_추가(react_correct(gs), 'ok');

  gs.history.push({ word: raw, turn: gs.turn });
  gs.turn += 1;
  if(gs.game_mode === 'ARCADE') gs.stage_turn += 1;
  check_title(gs);

  // 층 목표 달성 (아케이드)
  if(gs.game_mode === 'ARCADE'){
    const target = get_stage_target(gs);
    if(gs.stage_turn >= target){
      if(gs.stage === 13){
        if(gs.stage > gs.best) gs.best = gs.stage;
        gs.game_state = 'VICTORY_WAIT';
        로그_추가(대사(gs, '단어_처리_5'), 'ok');
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
  // 관리자 패널에서 다음 상대 단어를 지정해 뒀으면 그것을 먼저 쓴다(1회 소비).
  // 잇기 규칙에 맞지 않으면 예약을 버리고 평소대로 진행한다 — 판이 깨지지 않게.
  let 추가후보 = [], ai_판정사전 = null, ai_word = null;
  if(강제_AI단어){
    const 예약 = 강제_AI단어; 강제_AI단어 = null;
    const 이어짐 = !gs.rev
      ? dueum_check(gs.ai_last_char, 예약[0], gs.dueum)
      : 예약[예약.length - 1] === gs.ai_last_char;
    if(이어짐 && !used_words(gs).includes(예약)){
      ai_word = 예약;
      ai_판정사전 = ai_후보사전(gs, [예약]);
      로그_추가(`🔓 [관리자] 지정 단어 『${예약}』를 사용합니다.`, 'sys');
    } else {
      로그_추가(`🔓 [관리자] 『${예약}』는 지금 이을 수 없어 예약을 버립니다.`, 'warn');
    }
  }
  if(ai_word === null){
    추가후보 = await 온라인후보_가져오기(gs);
    ai_word = ai_generate_word(gs, 추가후보);
    ai_판정사전 = ai_후보사전(gs, 추가후보);
    온라인조회_보고();   // 희귀어를 실제로 받아 썼는지 / 못 받았는지를 화면에 남긴다
  }

  if(ai_word === null){
    if(gs.god_mode_active){
      로그_추가('💀 [AI 패배] 단어를 찾을 수 없습니다.', 'sys');
      로그_추가('🔓 [GOD MODE] 자유 입력권 발동.', 'sys');
      gs.ai_last_word = '[AI 기권]'; gs.ai_last_char = null;
      플레이_HUD갱신(); 프롬프트_갱신();
      return false;
    }
    if(gs.game_mode === 'SURVIVAL'){
      로그_추가(대사(gs, '단어_처리_4', [title(gs)]), 'ok');
      if(gs.turn > gs.best) gs.best = gs.turn;
      게임오버(true);
      return false;
    }
    // 아케이드: AI 기권 = 그 층 클리어(런 종료 아님)
    로그_추가(대사(gs, '단어_처리_3'), 'ok');
    arcade_floor_up(gs, true);
    if(gs.game_state === 'SOFTLOCKED'){ 소프트락_진입(); return false; }
    플레이_HUD갱신(); 프롬프트_갱신();
    return false;
  }

  // 다음 글자를 아직 우리말샘에 물어본 적 없으면 한방인지 알 수 없다 — 모르는 걸 근거로
  // "AI가 한방을 냈으니 사용자 승리"로 판을 끝내면 안 된다(2026-07-29 사전 폐지의 여파).
  if(ai_한방금지인가(gs) && 한방_판정가능인가(ai_word, gs)
     && is_hanbang(ai_word, used_words(gs), gs.rev, gs.dueum, gs.stage, ai_판정사전)){
    if(gs.god_mode_active){
      로그_추가(`💀 [AI 자폭] 『${ai_word}』는 한방 단어입니다.`, 'sys');
      로그_추가('🔓 [GOD MODE] 자유 입력권 발동.', 'sys');
      gs.history.push({ word: ai_word, turn: gs.turn }); gs.ai_last_word = ai_word; gs.ai_last_char = null;
      플레이_HUD갱신(); 프롬프트_갱신();
      return false;
    }
    if(gs.game_mode === 'SURVIVAL'){
      로그_추가(대사(gs, '단어_처리_2', [ai_word, title(gs)]), 'ok');
      if(gs.turn > gs.best) gs.best = gs.turn;
      게임오버(true);
      return false;
    }
    // 아케이드: AI가 한방 단어를 냄 = 실수, 그 층 클리어(런 종료 아님)
    로그_추가(대사(gs, '단어_처리_1', [ai_word]), 'warn');
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

  // ⚠️ 2026-07-29: 50턴 딜·목표 달성 제안을 **AI 턴 뒤로** 옮겼다.
  // 종전에는 사용자 단어를 받자마자(AI 턴 전에) 제안하고 return해서, 상대가 그 턴을 통째로
  // 건너뛰고 gs.ai_last_char도 이전 단어의 것으로 남았다 — 수락/거절 후 사용자가 방금 자기가
  // 이었던 그 글자로 또 내야 했다. AI가 응답한 뒤에 묻는 것이 흐름상으로도 맞다.
  if(서바이벌_제안_확인()) return false;
  // 사용자가 이을 수 있는 단어가 있는지 미리 확인해 알린다(결과를 기다리지 않음 — 위 주석 참조).
  막다른길_확인(게임_세대, gs.ai_last_char);
  // 콜롬비나 음성 배선(Phase 6) — 게이트(음성생성_활성화) off인 동안은 음성생성호출이 즉시 null을
  // 반환해 음성재생 자체가 호출되지 않는다(네트워크·오디오 재생 0건, 기존 동작과 동일). 화면
  // 흐름을 막지 않도록 결과를 기다리지 않는 fire-and-forget으로 둔다.
  (async () => { const 음성 = await 음성생성호출(ai_word); if (음성) 음성재생(음성); })();
  return false;
}

// 서바이벌 마일스톤 제안 — AI 턴이 끝난 뒤에 건다(위 주석 참조).
// 제안을 띄웠으면 true를 돌려줘 호출부가 그 턴을 여기서 끝내게 한다.
function 서바이벌_제안_확인(){
  if(gs.game_mode !== 'SURVIVAL' || gs.infinite) return false;

  // 50턴 무한 모드 제안 (초월/심연, 유한 모드일 때만)
  if(gs.turn === 50 && ['초월','심연'].includes(gs.diff)){
    gs.game_state = 'DEAL_WAIT';
    로그_추가(대사(gs, '단어_처리_7'), 'sys');
    플레이_HUD갱신();
    선택박스_보이기(`
      <div class="q">${document.querySelector('.log').lastChild.textContent}</div>
      <button class="btn sm acc" onclick="딜_응답(true)">수락</button>
      <button class="btn sm" onclick="딜_응답(false)">거절</button>`);
    return true;
  }

  // 목표 턴 달성
  const max_t = get_max_turns(gs);
  if(gs.turn >= max_t){
    if(gs.turn > gs.best) gs.best = gs.turn;
    gs.game_state = 'SURVIVAL_VICTORY_WAIT';
    로그_추가(대사(gs, '단어_처리_6', [max_t]), 'ok');
    플레이_HUD갱신();
    선택박스_보이기(`
      <button class="btn sm acc" onclick="생존승리_응답(true)">계속</button>
      <button class="btn sm" onclick="생존승리_응답(false)">종료</button>`);
    return true;
  }
  return false;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   양보(원본 _handle_yield) · 이의(원본 _handle_dispute) · 허세(원본 bluff_kw)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function 버튼_양보(){
  if(gs.ai_last_char !== null) return;
  // 앞 입력의 온라인 조회·AI 턴이 도는 중에 누르면 user_defeat이 겹쳐 목숨이 이중으로 깎인다
  // (단어_제출·힌트_실행과 같은 재진입 가드를 공유한다). 조용히 무시하지 않고 이유를 알린다.
  if(게임_비동기처리중){ 로그_추가('⏳ 앞의 처리가 끝난 뒤에 다시 눌러 주세요.', 'sys'); return; }
  if(gs.game_state !== 'PLAYING') return;
  gs.yield_attempts += 1;
  if(gs.yield_attempts === 1){
    로그_추가(대사(gs, '버튼_양보_1', {칭호: title(gs)}));
  } else if(gs.yield_attempts === 2){
    로그_추가(대사(gs, '버튼_양보_3'));
  } else if(gs.yield_attempts === 3){
    로그_추가(대사(gs, '버튼_양보_2'), 'err');
  } else {
    로그_추가(대사(gs, '버튼_양보_1'), 'err');
    gs.yield_attempts = 0;
    const result = user_defeat(gs);
    if(result === 'game_over'){ 게임오버(false); return; }
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
   재설계 시 원본 대조용으로 씀). */

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   봉인 해제 (2026-08-19) — 재설계 반영
   ────────────────────────────────────────────────────────────────────────
   위 봉인 사유 4가지를 그대로 고쳤다:
     · 사전을 실제로 확인 → wchain/js/국어원.js의 국어원_단어조회_상세()로 매 클릭마다 실조회
       (뜻풀이는 트랙 A에서 확장한 Worker 계약, wchain/worker/우리말샘-worker.mjs 참조).
     · 5번 눌러야 취소되던 것 → 첫 클릭부터 즉시 판정(사전에 없으면 그 자리에서 취소).
     · 몇 번째인지 안 보이던 것 → 버튼 라벨에 "(n/5)" 진행도 노출(프롬프트_갱신).
     · '그 단어 없어!'가 대사 한 줄짜리 no-op이던 것 → '이의 있음'과 동일한 실조회를 태운다
       (AI는 항상 검증된 단어만 내므로 두 버튼이 주장하는 내용이 사실상 같다 — 아래 참조).
   이의 제기는 판(게임)당 최대 5회로 제한한다(성공·실패 모두 소모 — 기존 상수 재사용,
   확인 자체가 실패한 시도는 소모하지 않음). 원본에 있던 "심연 난이도는 무조건 기각" 특례는
   두지 않는다 — 실제로 확인해서 판정한다는 이번 재설계 취지와 맞지 않기 때문이다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const 이의허세_봉인 = false;
const 이의_최대횟수 = 5;

// 이의있음이든(사전 존재 확인) 적절성 검증이든(그록 판단, 아래 버튼_적절성검증) '이 단어는
// 무효' 판정이 나오면 그 뒤에 벌어지는 일은 같다 — AI 단어를 취소하고 다시 내게 하거나, AI가
// 못 내면 사용자 승리. 두 판정 경로가 이 로직을 각자 복제하지 않도록 공용 함수로 뺐다
// (2026-08-22). 반환값 false면 호출부는 더 진행하지 말고(게임오버·리셋 처리 완료) 즉시
// return해야 한다.
async function AI단어_취소_재출제(disputed, 내세대){
  gs.history = gs.history.filter(h => h.word !== disputed);
  if(gs.history.length){
    const prev = gs.history[gs.history.length - 1].word;
    gs.ai_last_char = !gs.rev ? prev[prev.length - 1] : prev[0];
  } else {
    gs.ai_last_char = null;
  }
  gs.ai_last_word = null;
  const new_ai = await ai_generate_word_비동기(gs);
  if(내세대 !== 게임_세대) return false;   // 대기 중 리셋·재도전이 있었다 — 더 진행하면 안 됨
  if(new_ai){
    gs.history.push({ word: new_ai, turn: gs.turn });
    gs.ai_last_char = !gs.rev ? new_ai[new_ai.length - 1] : new_ai[0];
    gs.ai_last_word = new_ai;
    로그_추가(react_ai_word(gs, new_ai));
    return true;
  }
  로그_추가(대사(gs, '버튼_이의_원본_1', [title(gs)]), 'ok');
  // 원본과 동일: 이의제기로 인한 승리는 서바이벌만 best(턴) 갱신 — 아케이드는 갱신 안 함(원본 그대로)
  if(gs.game_mode === 'SURVIVAL' && gs.turn > gs.best) gs.best = gs.turn;
  게임오버(true);
  return false;
}

async function 버튼_이의(){
  if(게임_비동기처리중) return;   // 앞 처리(온라인 조회·AI 턴) 진행 중이면 무시(재진입 방지)
  if(!gs.ai_last_word) return;
  if(gs.dispute_attempts >= 이의_최대횟수){
    로그_추가(대사(gs, '버튼_이의_소진'), 'err');
    return;
  }
  게임_비동기처리중 = true;
  입력_대기표시(true, '이의 확인 중');
  const 내세대 = 게임_세대;
  try{
    gs.dispute_attempts += 1;
    const disputed = gs.ai_last_word;
    로그_추가('🔎 우리말샘에서 확인하는 중...', 'sys');
    플레이_HUD갱신(); 프롬프트_갱신();   // 진행도 라벨(n/5)을 즉시 반영

    const 결과 = await 국어원_단어조회_상세(disputed);
    if(내세대 !== 게임_세대) return;   // 대기 중 리셋·재도전이 있었다 — 이 판정은 버린다

    if(결과 === null){
      gs.dispute_attempts -= 1;   // 확인 자체를 못 했으니 소모로 치지 않는다
      로그_추가('⚠️ 우리말샘 확인에 실패했습니다(네트워크 문제로 추정). 잠시 후 다시 시도해 주세요.', 'warn');
      return;
    }

    if(!결과.존재){
      // 실제로 사전에 없는 단어 — 즉시 취소하고 AI가 새 단어를 낸다.
      로그_추가(대사(gs, '버튼_이의_원본_2', [disputed]), 'ok');
      if(!await AI단어_취소_재출제(disputed, 내세대)) return;
    } else {
      // 실제로 있는 단어 — 뜻풀이를 근거로 이의 기각.
      const 첫뜻 = (결과.뜻풀이그룹[0] && 결과.뜻풀이그룹[0].뜻풀이[0]) || '(뜻풀이를 불러오지 못했습니다)';
      로그_추가(대사(gs, '버튼_이의_기각', [disputed, 첫뜻]), 'err');
    }
    플레이_HUD갱신(); 프롬프트_갱신();
  } finally {
    if(내세대 === 게임_세대){
      게임_비동기처리중 = false;
      입력_대기표시(false);
    }
  }
}

// '그 단어 없어!'는 '이의 있음'과 주장하는 내용이 완전히 같다(AI가 낸 단어가 사전에 없다는
// 의심) — AI는 항상 검증된 단어만 내므로(ai_generate_word가 HARD_DICT/DICTIONARY/온라인
// 후보에서만 고름) 별도 판정 로직을 둘 이유가 없다. 종전엔 이쪽만 대사 한 줄짜리 no-op이었던
// 것을 없애고 같은 실조회를 태운다(대사표의 버튼_허세_원본_1은 옛 구현 대조용으로 남겨 둔다).
const 버튼_허세 = 버튼_이의;

// '뜻 보기' — 이의있음·적절성검증과 달리 판정도 소모도 없다. 그냥 지금 AI가 낸 단어의 뜻을
// 보여준다(2026-08-22 신설). 우리말샘 조회만 하므로 국어원_단어조회_상세()를 그대로
// 재사용(캐시도 같이 씀) — 새 API 계약이 필요 없다.
async function 버튼_뜻보기(){
  if(게임_비동기처리중) return;
  if(!gs.ai_last_word) return;
  게임_비동기처리중 = true;
  입력_대기표시(true, '뜻 확인 중');
  const 내세대 = 게임_세대;
  try{
    const word = gs.ai_last_word;
    로그_추가('📖 우리말샘에서 뜻을 찾는 중...', 'sys');
    const 결과 = await 국어원_단어조회_상세(word);
    if(내세대 !== 게임_세대) return;
    // 실패 원인을 뭉뚱그리지 않는다 — 셋은 사용자가 할 일이 서로 다르다(2026-08-22).
    //  · 결과가 null   = 확인 자체를 못 함(네트워크·시간초과) → 다시 눌러보면 된다.
    //  · 존재하지 않음 = AI가 사전에 없는 단어를 냈다는 뜻 → '이의 있음'을 누르면 취소된다.
    //                    종전엔 이걸 네트워크 탓으로 안내해서, 정작 쓸모 있는 정보를 숨겼다.
    //  · 존재하나 뜻풀이 없음 = 우리말샘이 뜻을 안 준 경우(표제어만 있는 등) → 안내만.
    if(결과 === null){
      로그_추가(`⚠️ 『${word}』의 뜻을 불러오지 못했습니다(네트워크 문제로 추정). 잠시 후 다시 시도해 주세요.`, 'warn');
      return;
    }
    if(!결과.존재){
      로그_추가(`❓ 『${word}』은(는) 우리말샘에 없는 단어입니다 — '이의 있음'을 누르면 취소할 수 있습니다.`, 'warn');
      return;
    }
    const 줄들 = 뜻풀이_로그줄들(결과);
    if(!줄들){
      로그_추가(`📖 『${word}』은(는) 우리말샘에 있지만 뜻풀이가 제공되지 않습니다.`, 'warn');
      return;
    }
    로그_추가(`📖 『${word}』`, 'sys');
    for(const 줄 of 줄들) 로그_추가(줄, 'sys');
  } finally {
    if(내세대 === 게임_세대){
      게임_비동기처리중 = false;
      입력_대기표시(false);
    }
  }
}

// '적절성 검증' — 이의있음(사전 존재 확인)과 역할이 다르다: 사전엔 있지만 이 판에서 쓰기엔
// 부당한 단어인지(희귀 전문용어·옛말·지명·인명류 등, 후보 필터가 못 거른 경계 케이스)를
// AI에게 판단시킨다(2026-08-22 신설). wchain/js/적절성판정.js·wchain/worker/단어적절성판정
// -worker.mjs 참조. 아직 게이트 봉인 상태(적절성검증_활성화=false, 제공사 미확정·Worker
// 미배포)라 지금은 '준비 중' 안내만 뜨고 dispute_attempts를 소모하지 않는다.
// 이의있음과 같은 예산(gs.dispute_attempts/이의_최대횟수)을 공유한다 — 판당 이의제기 총량이
// 버튼 3개(이의있음·허세·적절성검증)로 쪼개져 늘어나지 않게 하기 위함.
//
// 판정이 '적절'로 나오면 반박(2차 교차검증)을 제안한다 — 아래 반박_제안()·반박_응답() 참조.
// 반박은 예산을 **추가로 쓰지 않는다**(같은 검증의 연장이라 이미 1회 차감했음).
async function 버튼_적절성검증(){
  if(게임_비동기처리중) return;
  if(!gs.ai_last_word) return;
  if(!적절성검증_활성화){
    로그_추가('🔒 적절성 검증은 그록 연동 후 사용 가능합니다.', 'warn');
    return;
  }
  if(gs.dispute_attempts >= 이의_최대횟수){
    로그_추가(대사(gs, '버튼_이의_소진'), 'err');
    return;
  }
  게임_비동기처리중 = true;
  입력_대기표시(true, '적절성 확인 중');
  const 내세대 = 게임_세대;
  // 반박 대기로 넘어가면 아래 finally에서 가드를 풀면 안 된다 — 선택박스가 떠 있는 동안
  // 유틸 버튼들(이의·뜻보기 등, 전부 게임_비동기처리중만 검사함)이 눌려 gs.ai_last_word가
  // 바뀌면 반박이 엉뚱한 단어를 대상으로 돌게 된다. 가드는 반박_취소()/반박_응답()이 푼다.
  let 반박대기로_넘김 = false;
  try{
    gs.dispute_attempts += 1;
    const disputed = gs.ai_last_word;
    로그_추가('🤖 그록에게 판단을 묻는 중...', 'sys');
    플레이_HUD갱신(); 프롬프트_갱신();

    const 결과 = await 적절성_검증(disputed, gs.ai_last_char);
    if(내세대 !== 게임_세대) return;

    if(결과 === null){
      gs.dispute_attempts -= 1;   // 확인 자체를 못 했으니 소모로 치지 않는다
      로그_추가('⚠️ 적절성 검증에 실패했습니다(네트워크 문제로 추정). 잠시 후 다시 시도해 주세요.', 'warn');
      return;
    }

    if(!결과.적절){
      // 부당하다고 판단됨 — 이의있음의 '없는 단어' 분기와 동일하게 취소·재출제.
      로그_추가(`🤖 인정합니다, 『${disputed}』는 부당한 단어였습니다${결과.이유 ? ' — ' + 결과.이유 : ''}. 취소하겠습니다.`, 'ok');
      if(!await AI단어_취소_재출제(disputed, 내세대)) return;
    } else {
      로그_추가(`🤖 『${disputed}』는 적절한 단어입니다${결과.이유 ? ' — ' + 결과.이유 : ''}.`, 'err');
      // 판정이 '적절'이면 여기서 끝내지 않고 반박 기회를 준다. 반대(부당) 판정에는 반박을
      // 안 붙이는 이유: 그건 사용자가 원한 결과라 뒤집을 동기가 없다.
      반박대기로_넘김 = 반박_제안(disputed);
      // 프롬프트_갱신()을 부르면 선택박스가 도로 걷힌다(선택박스_숨기기 호출) — 반박 제안이
      // 실제로 떴을 때만 건너뛴다.
      if(반박대기로_넘김) return;
    }
    플레이_HUD갱신(); 프롬프트_갱신();
  } finally {
    if(내세대 === 게임_세대 && !반박대기로_넘김){
      게임_비동기처리중 = false;
      입력_대기표시(false);
    }
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   반박 (2차 교차검증) — 2026-08-22 신설
   ────────────────────────────────────────────────────────────────────────
   1차 판정이 "적절"로 나왔을 때 사용자가 "아니다, 이건 부당하다"고 반박하면, **다른 제공사
   모델**이 단발로 재판정한다(Worker의 반박사유 모드).

   왜 자유 대화가 아니라 선택지인가: 같은 모델과 같은 대화 안에서 계속 반박하면 아첨·탈옥에
   뚫린다(여러 연구가 "후속 반박이 오면 판정이 뒤집힌다"를 공통 보고). 이 게임은 AI를 설득해
   이기는 구조라 일부러 탈옥을 시도할 유인까지 크다. 그래서 ① 선택지 기반 1회 반박, ② 대화
   맥락을 안 쌓는 단발 호출, ③ 다른 회사 모델로 교차검증 — 세 가지로 압박이 성립할 여지를
   없앤다. 그래도 인젝션을 완전히 막지는 못하므로, 진짜 방어선은 아래 "코드가 강제하는 경계"다:
     · 한 단어당 반박 1회 (gs.반박한단어)
     · 이의 예산 5회 안에서만 (검증 시점에 이미 차감됨)
     · 자유 텍스트 100자 (적절성판정.js·Worker 양쪽에서 자름)
   피해 상한과 그것을 감수하는 근거는 단어적절성판정-worker.mjs 상단에 기록.

   UI는 기존 선택박스 관례를 그대로 쓴다(악마의 거래·시련의 계약과 같은 방식) —
   gs.game_state를 대기 상태로 바꾸고 전역 콜백으로 회수. 선택박스가 떠 있는 동안은
   #입력폼이 숨겨져 입력_대기표시()가 무력하므로, 대기 표시는 선택박스 내용을 갈아서 한다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// 반환값 true = 선택박스를 띄웠으니 호출부는 비동기 가드를 유지한 채 빠져야 한다.
//        false = 제안하지 않았으니 호출부가 평소대로 마무리하면 된다.
function 반박_제안(disputed){
  // 이미 이 단어로 반박했으면 다시 제안하지 않는다(같은 것을 두 번 묻지 못하게).
  if(gs.반박한단어 === disputed){
    로그_추가(대사(gs, '반박_중복', [disputed]), 'sys');
    return false;
  }
  gs.game_state = 'REBUT_WAIT';
  로그_추가(대사(gs, '반박_제안'), 'sys');
  const 버튼들 = 반박_사유목록
    .map(x => `<button class="btn sm${x.코드 === '기타' ? '' : ' acc'}" onclick="반박_사유선택('${x.코드}')">${x.라벨}</button>`)
    .join('\n          ');
  선택박스_보이기(`
          <div class="q">『${HTML막기(disputed)}』가 왜 부당한지 골라 주세요. 다른 심판이 다시 봅니다.</div>
          ${버튼들}
          <button class="btn sm" onclick="반박_취소()">그만두기</button>`);
  return true;
}

// '기타'는 자유 입력을 받아야 하므로 선택박스를 입력창으로 한 번 더 갈아 끼운다.
// 입력창 스타일은 새 클래스를 만들지 않고 관리자 패널(#관리자-단어)의 선례대로
// .input-row input 값을 인라인으로 맞춘다(CLAUDE.md 디자인 일관성 원칙).
function 반박_사유선택(코드){
  if(코드 !== '기타'){ 반박_응답(코드, ''); return; }
  선택박스_보이기(`
          <div class="q">어떤 점이 부당한지 짧게 적어 주세요(${반박보충_최대길이}자 이내).</div>
          <input id="반박입력" maxlength="${반박보충_최대길이}" autocomplete="off"
                 placeholder="예: 특정 지역에서만 쓰는 말입니다"
                 style="width:100%;padding:11px 13px;border:1px solid var(--bdr);border-radius:10px;
                        background:var(--elev);color:var(--txt);font-family:var(--fn);font-size:14px;margin-bottom:8px">
          <button class="btn sm acc" onclick="반박_기타제출()">제출</button>
          <button class="btn sm" onclick="반박_취소()">그만두기</button>`);
  const inp = document.getElementById('반박입력');
  if(inp) inp.focus();
}

function 반박_기타제출(){
  const inp = document.getElementById('반박입력');
  const 보충 = (inp ? inp.value : '').trim();
  if(!보충){ 로그_추가('반박 내용을 입력해 주세요.', 'warn'); return; }
  반박_응답('기타', 보충);
}

function 반박_취소(){
  gs.game_state = 'PLAYING';
  게임_비동기처리중 = false;
  입력_대기표시(false);
  플레이_HUD갱신(); 프롬프트_갱신();   // 선택박스를 걷고 입력폼 복귀
}

async function 반박_응답(사유코드, 보충){
  if(gs.game_state !== 'REBUT_WAIT') return;   // 이미 처리됐거나 판이 바뀜(연타 방지)
  const disputed = gs.ai_last_word;
  if(!disputed){ 반박_취소(); return; }
  gs.game_state = 'PLAYING';
  gs.반박한단어 = disputed;   // 성공·실패와 무관하게 이 단어는 재반박 불가
  const 내세대 = 게임_세대;
  const 고른것 = 반박_사유목록.find(x => x.코드 === 사유코드);
  로그_추가('▶ ' + (고른것 ? 고른것.라벨 : 사유코드) + (보충 ? ` — ${보충}` : ''), 'me');
  // 선택박스가 떠 있어 입력_대기표시()가 못 미치므로 여기서 직접 대기 표시로 갈아 끼운다.
  선택박스_보이기('<div class="q">다른 심판이 확인하는 중<span class="dots"><span>·</span><span>·</span><span>·</span></span></div>');
  try{
    const 결과 = await 적절성_반박(disputed, gs.ai_last_char, 사유코드, 보충);
    if(내세대 !== 게임_세대) return;

    if(결과 === null){
      로그_추가('⚠️ 재검토에 실패했습니다(네트워크 문제로 추정).', 'warn');
    } else if(!결과.적절){
      로그_추가(대사(gs, '반박_인정', [disputed]) + (결과.이유 ? ` (${결과.이유})` : ''), 'ok');
      if(!await AI단어_취소_재출제(disputed, 내세대)) return;
    } else {
      로그_추가(대사(gs, '반박_기각', [disputed]) + (결과.이유 ? ` (${결과.이유})` : ''), 'err');
    }
  } finally {
    if(내세대 === 게임_세대){
      게임_비동기처리중 = false;
      입력_대기표시(false);
      플레이_HUD갱신(); 프롬프트_갱신();   // 선택박스를 걷고 입력폼 복귀
    }
  }
}

/* ── 봉인 해제 전 구현(대조용, 참고 목적으로 보존) ─────────────────────────
async function 버튼_이의_원본(){
  if(게임_비동기처리중) return;   // 앞 처리(온라인 조회·AI 턴) 진행 중이면 무시(재진입 방지)
  게임_비동기처리중 = true;
  try{
    gs.dispute_attempts += 1;
    const disputed = gs.ai_last_word || '?';
    if(gs.dispute_attempts === 1){
      로그_추가(대사(gs, '버튼_이의_원본_7', [disputed]));
    } else if(gs.dispute_attempts === 2){
      로그_추가(대사(gs, '버튼_이의_원본_6'));
    } else if(gs.dispute_attempts === 3){
      로그_추가(대사(gs, '버튼_이의_원본_5'));
    } else if(gs.dispute_attempts === 4){
      로그_추가(대사(gs, '버튼_이의_원본_4', [disputed]));
    } else {
      if(gs.diff === '심연'){
        로그_추가(대사(gs, '버튼_이의_원본_3'), 'err');
        gs.dispute_attempts = 0;
      } else {
        로그_추가(대사(gs, '버튼_이의_원본_2', [disputed]), 'ok');
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
          로그_추가(대사(gs, '버튼_이의_원본_1', [title(gs)]), 'ok');
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
  로그_추가(대사(gs, '버튼_허세_원본_1', [gs.ai_last_word]));
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
  const 사전 = ai_후보사전(gs, 추가후보);   // AI 턴과 같은 풀(우리말샘 + 세션 + 보조 사전)
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
  // 조용히 return하면 "버튼이 안 먹는다"로 보이므로 이유를 알려준다(2026-07-27).
  if(게임_비동기처리중){ 로그_추가('⏳ 앞의 처리가 끝난 뒤에 다시 눌러 주세요.', 'sys'); return; }
  게임_비동기처리중 = true;
  입력_대기표시(true, '힌트 찾는 중');
  const 내세대 = 게임_세대;
  try{
    await 힌트_본체();
  } finally {
    if(내세대 === 게임_세대){
      게임_비동기처리중 = false;
      입력_대기표시(false);
    }
  }
}

async function 힌트_본체(){

  // 13층 이상 + 힌트 소진 = 시련의 탑 대신 바로 비상 탈출구
  if(gs.game_mode === 'ARCADE' && gs.stage >= 13 && gs.hints <= 0){
    로그_추가(대사(gs, '힌트_본체_8'), 'sys');
    gs.game_state = 'ESCAPE_WAIT';
    선택박스_보이기(`
      <div class="q">[비상 탈출구]</div>
      <button class="btn sm acc" onclick="탈출_응답(false)">계속</button>
      <button class="btn sm" onclick="탈출_응답(true)">도망</button>`);
    return;
  }

  // ⚠️ 순서 주의(2026-07-29): 후보 조회는 힌트 잔량 검사 **뒤에** 한다.
  // 종전에는 먼저 조회했는데, 힌트가 0이면 그 결과를 아예 쓰지 않고 악마의 거래·시련의 탑으로
  // 빠진다 — 최대 6초짜리 왕복을 매번 버리고 있었다. 게다가 그 조회가 마지막_온라인조회를
  // 덮어써서 다음 AI 턴의 로그가 엉뚱한 값으로 보고됐다.
  if(gs.hints !== Infinity && gs.hints <= 0){
    if(gs.game_mode === 'ARCADE'){
      gs.trial_tower_entries += 1;
      if(gs.trial_tower_entries === 2){
        로그_추가(대사(gs, '힌트_본체_7'), 'sys');
      } else if(gs.trial_tower_entries >= 3){
        로그_추가(대사(gs, '힌트_본체_6'), 'sys');
      }
      if(gs.trial_rejected_floor === gs.stage){
        로그_추가(대사(gs, '힌트_본체_5'), 'sys');
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
          [2] 생명의 계약 — 목숨+${목숨보상}·힌트+1 / 다음 2층 두음법칙 OFF<br>
          [3] 어둠의 계약 — 목숨+${목숨보상}·힌트+3 / 이번 층 2글자 단어만 허용</div>
          <button class="btn sm acc" onclick="시련_응답(1)">시간의 계약</button>
          <button class="btn sm acc" onclick="시련_응답(2)">생명의 계약</button>
          <button class="btn sm acc" onclick="시련_응답(3)">어둠의 계약</button>
          <button class="btn sm" onclick="시련_응답(0)">거절</button>`);
      }
      return;
    }
    if(!gs.deal_offered){
      if(gs.diff === '심연'){ 로그_추가(대사(gs, '힌트_본체_4'), 'sys'); return; }
      gs.deal_offered = true;
      gs.game_state = 'DEVIL_WAIT';
      const diff_next = { 안온:'격동', 격동:'초월', 초월:'심연' }[gs.diff] ?? gs.diff;
      로그_추가(대사(gs, '힌트_본체_3', [gs.diff, diff_next]), 'sys');
      선택박스_보이기(`
        <button class="btn sm acc" onclick="악마거래_응답(true)">수락</button>
        <button class="btn sm" onclick="악마거래_응답(false)">거절</button>`);
      return;
    }
    로그_추가(대사(gs, '힌트_본체_2'), 'sys');
    return;
  }

  const cands = 힌트_후보(gs, await 온라인후보_가져오기(gs));
  if(!cands.length){
    // 관리자님 제보: "힌트 불가라고 뜨면 내가 진 건가?" — 아니다. 힌트로 **안전하게** 안내할
    // 단어를 못 찾았을 뿐 판은 그대로 진행된다. 오해하지 않게 명시하고 힌트도 차감하지 않는다.
    로그_추가('❌ [힌트 불가] 안내할 만한 단어를 찾지 못했습니다. 진 것이 아니니 직접 입력해 보세요 '
            + '(힌트는 차감되지 않았습니다).', 'sys');
    return;
  }

  if(gs.god_mode_active){
    const answer = cands[Math.floor(Math.random() * cands.length)];
    로그_추가(`🔓 [GOD MODE 힌트] 정답: 『${answer}』 (최고 관리자님 전용 즉시 정답 공개)`, 'ok');
    return;
  }

  if(gs.hints !== Infinity) gs.hints -= 1;
  const hint_word = cands[Math.floor(Math.random() * cands.length)];
  로그_추가(대사(gs, '힌트_본체_1', [표시무한(gs.hints)]));
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
    로그_추가(대사(gs, '악마거래_응답_2', [old, gs.diff]), 'ok');
    // 원본: 계약 즉시 힌트 1회를 바로 제공 (힌트_후보로 통일 — 어둠의 계약·13층 족쇄 필터 반영).
    // ⚠️ 2026-07-29: 종전에는 온라인 후보 없이 힌트_후보(gs)만 불렀다. 내부 사전을 폐지한 지금
    // 그 풀은 "이번 판에서 이미 받아 둔 단어"뿐이라 대개 비고, 그러면 계약을 맺었는데 약속한
    // 힌트가 조용히 안 나온다. AI 턴과 같은 풀을 쓰도록 온라인 조회를 태우고, 그래도 못 찾으면
    // 침묵하지 말고 이유를 알린다. onclick에서 불리므로 결과를 기다리지 않는다.
    (async () => {
      try{
        const cands = 힌트_후보(gs, await 온라인후보_가져오기(gs));
        if(cands.length){
          if(gs.hints !== Infinity) gs.hints -= 1;
          const hint_word = cands[Math.floor(Math.random() * cands.length)];
          로그_추가(`   🔤 초성 : ${extract_chosung(hint_word)}`);
          플레이_HUD갱신();
        } else {
          로그_추가('   ❌ 계약의 힌트를 만들 단어를 찾지 못했습니다(힌트는 차감되지 않았습니다).', 'sys');
        }
      }catch(e){ console.error('[악마의 거래] 즉시 힌트 실패', e); }
    })();
  } else {
    gs.game_state = 'PLAYING';
    로그_추가(대사(gs, '악마거래_응답_1'));
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
    로그_추가(대사(gs, '딜_응답_1'));
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
    로그_추가(대사(gs, '시련_응답_4'), 'ok');
    arcade_floor_up(gs, false);
    if(gs.game_state === 'SOFTLOCKED'){ 소프트락_진입(); return; }
    gs.curse_time_floors = 1;
    플레이_HUD갱신(); 프롬프트_갱신();
  } else if(선택 === 2){
    // ⚠️ 2026-07-29 환산: 실수(strikes) 폐지로 목숨 1개 = 기회 1회가 됐다. 종전 목숨 1개는
    // 실수 4회를 품고 있었으므로 +1 그대로 두면 계약의 가치가 4분의 1로 쪼그라든다.
    // 난이도표를 4배로 올린 것과 같은 기준으로 여기도 함께 환산한다(목숨보상 = 4).
    gs.hearts += 목숨보상;
    if(gs.hints !== Infinity) gs.hints += 1;
    gs.curse_life_floors = 2;
    gs.game_state = 'PLAYING';
    const h = 표시무한(gs.hearts);
    로그_추가(대사(gs, '시련_응답_3', [h, 표시무한(gs.hints)]), 'ok');
    플레이_HUD갱신(); 프롬프트_갱신();
  } else if(선택 === 3){
    gs.hearts += 목숨보상;   // 위 생명의 계약과 같은 환산
    if(gs.hints !== Infinity) gs.hints += 3;
    gs.curse_dark_active = true;
    gs.game_state = 'PLAYING';
    const h = 표시무한(gs.hearts);
    로그_추가(대사(gs, '시련_응답_2', [h, 표시무한(gs.hints)]), 'ok');
    플레이_HUD갱신(); 프롬프트_갱신();
  } else {
    gs.game_state = 'PLAYING';
    gs.trial_rejected_floor = gs.stage;
    로그_추가(대사(gs, '시련_응답_1'));
    플레이_HUD갱신(); 프롬프트_갱신();
  }
}

function 붕괴_응답(입장){
  if(입장){
    const prob = 붕괴확률(gs.trial_attempts_this_floor);
    const roll = 1 + Math.floor(Math.random() * 100);
    if(prob >= 100 || roll <= prob){
      로그_추가('▓▒░ 탑이 무너진다. 대지가 갈라진다. ░▒▓', 'err');
      로그_추가(대사(gs, '붕괴_응답_3', [title(gs)]), 'err');
      로그_추가(`💀 [탑 붕괴 엔딩] ${gs.stage}층에서 소멸.`, 'err');
      if(gs.stage > gs.best) gs.best = gs.stage;
      게임오버(false);
    } else {
      로그_추가(대사(gs, '붕괴_응답_2'), 'ok');
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
    로그_추가(대사(gs, '붕괴_응답_1'));
    플레이_HUD갱신(); 프롬프트_갱신();
  }
}

function 탈출_응답(도망){
  if(도망){
    로그_추가(대사(gs, '탈출_응답_2'), 'err');
    로그_추가(`💀 [비상 탈출] ${gs.stage}층에서 도망쳤습니다.`, 'err');
    if(gs.stage > gs.best) gs.best = gs.stage;
    게임오버(false);
  } else {
    gs.game_state = 'PLAYING';
    로그_추가(대사(gs, '탈출_응답_1'));
    플레이_HUD갱신(); 프롬프트_갱신();
  }
}

function 탑승리_응답(계속){
  if(계속){
    gs.stage = 14; gs.stage_turn = 0; gs.stage_start_turn = gs.turn;
    // 원본은 2였는데, 실수 폐지 뒤로 그건 "두 번 틀리면 끝"이라는 뜻이 됐다(종전 실효 8회).
    // 아케이드 시작값(아케이드_목숨=8)과 같은 기준으로 맞춘다 — 14층부터는 무한 등반이라
    // 시작보다 각박할 이유가 없다.
    gs.hearts = gs.god_mode_active ? Infinity : 아케이드_목숨;
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
      ? 대사(gs, '게임오버_생존승리', {칭호: title(gs)})
      : 대사(gs, '게임오버_생존패배', {칭호: title(gs)});
    document.getElementById('오버-메시지').textContent = (victory ? '🏆 [SURVIVAL 클리어] ' : '💀 [GAME OVER] ') + msg;
    document.getElementById('오버-통계').textContent = `최종 턴: ${gs.turn}  |  최고 기록: ${gs.best}`;
  } else {
    const msg = victory
      ? 대사(gs, '게임오버_1', [title(gs)])
      : 대사(gs, '게임오버_탑패배', {층: gs.stage, 칭호: title(gs)});
    document.getElementById('오버-메시지').textContent = (victory ? '🏆 [13층 클리어] ' : '💀 [GAME OVER] ') + msg;
    document.getElementById('오버-통계').textContent = `최종 층: ${gs.stage}  |  최고 기록: ${gs.best}층`;
  }
}

function 다시시작(){
  게임_세대올리기();   // 진행 중이던 턴의 결과가 새 판에 섞이지 않게
  // 아케이드도 설정 화면을 거친다(2026-07-29) — 재도전 때 두음법칙·구 허용을 바꿀 수 있어야 한다.
  // reset_game이 stage=1까지 처리하므로 여기서 따로 손대지 않는다.
  gs.game_state = 'READY';
  reset_game(gs);
  화면('설정');
  설정_렌더();
}

function 전체리셋(){
  // 원본 !리셋 처리(WordChainGame.run): full_reset() 후 GOD MODE 여부와 무관하게 항상
  // show_init()(페르소나 선택)으로 돌아간다 — god_mode_active는 화면 안내 문구만 다를 뿐 분기 없음.
  게임_세대올리기();   // 진행 중이던 턴의 결과가 초기화된 상태에 섞이지 않게
  full_reset(gs);
  세션_비우기();       // 이전 판의 수집 단어·조회 실패 카운터를 새 판으로 넘기지 않는다
  로그_비우기();
  화면('페르소나');
}
function 버튼_리셋(){ 전체리셋(); }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   설명서 · 상태 다시 표시 · GOD MODE 백도어
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function 버튼_설명(){ document.getElementById('설명Bg').classList.add('show'); }
function 버튼_설명닫기(){ document.getElementById('설명Bg').classList.remove('show'); }
function 버튼_상태(){
  플레이_HUD갱신();
  // ⚠️ 선택박스가 떠 있는 대기 상태(악마의 거래·시련의 계약·탑 붕괴·반박 등)에서는
  //    프롬프트_갱신()을 부르면 안 된다 — 그 안의 선택박스_숨기기()가 선택지를 통째로
  //    지워 버려 응답할 방법이 사라진다(2026-08-22 실측으로 확인. 반박 대기에서는
  //    게임_비동기처리중까지 걸린 채라 아예 소프트락이 됐다).
  //    HUD 갱신은 어느 상태에서든 무해하므로 위에서 먼저 하고, 입력폼·버튼 복원만 건너뛴다.
  if(gs.game_state === 'PLAYING') 프롬프트_갱신();
}

function 갓모드_활성화(){
  gs.god_mode_active = true;
  gs.hints = Infinity; gs.hearts = Infinity;
  gs.user_title = '최고 관리자님';
  if(gs.persona === null) gs.persona = 'Arrogant';
  로그_추가('🔓 어서 오십시오, 최고 관리자님. (힌트 ∞ · 목숨 ∞)', 'ok');
  로그_추가('🔓 보조 버튼에 「관리자」가 열렸습니다.', 'sys');
  if(gs.game_state === 'PLAYING'){ 플레이_HUD갱신(); 프롬프트_갱신(); }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   관리자 패널 (2026-07-29 신설 — 관리자님 지시)
   ────────────────────────────────────────────────────────────────
   "백도어 승인 후 원래 Gemini일 때를 생각해 보면 완전 천하무적인데, 지금은 AI도 없고
    그냥 코드만 굴러가는 거니까 (…) 따로 새 토글 하나 만들어서 턴수 이동이나 전의 위엄을
    살리면 좋겠어 (…) 누르면 10턴 이동이 아니라 1~99까지 자유롭게 이동할 수 있도록"

   자연어 지시를 알아듣는 AI는 없으므로, 같은 결과를 내는 조작을 직접 제공한다.
   토글을 넷 만들면 지저분하다는 지시에 따라 **버튼 하나 → 모달 하나**에 네 구역을 모았다.
   백도어(god_mode_active) 승인 후에만 버튼이 보인다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// 다음 AI 턴에 강제로 낼 단어(1회 소비). 단어_처리의 AI 턴이 이 값을 먼저 확인한다.
let 강제_AI단어 = null;

function 관리자_패널열기(){
  if(!gs.god_mode_active) return;
  const 아케 = gs.game_mode === 'ARCADE';
  document.getElementById('관리자-본문').innerHTML = `
    <div class="set-sec" style="margin-bottom:8px">
      <div class="set-lbl">${아케 ? '층 이동' : '턴 이동'}</div>
      <div class="srs" style="margin-bottom:8px">1~499 사이 값으로 즉시 이동합니다.
        현재 ${아케 ? `${gs.stage}층` : `${gs.turn}턴`}.</div>
      <div style="display:flex;gap:6px">
        <input id="관리자-턴" type="number" min="1" max="499" value="${아케 ? gs.stage : gs.turn || 1}"
          style="flex:1;font-family:var(--fn);font-size:15px;color:var(--txt);background:var(--elev);
                 border:1px solid var(--bdr);border-radius:8px;padding:9px 12px;outline:none">
        <button class="btn sm acc" style="margin:0" onclick="관리자_턴이동()">이동</button>
      </div>
    </div>

    <div class="set-sec" style="margin-bottom:8px">
      <div class="set-lbl">다음 상대 단어 지정</div>
      <div class="srs" style="margin-bottom:8px">상대가 다음 턴에 낼 단어를 직접 정합니다(1회).
        ${강제_AI단어 ? `현재 예약: 『${강제_AI단어}』` : '예약 없음.'}</div>
      <div style="display:flex;gap:6px">
        <input id="관리자-단어" placeholder="예) 사과" maxlength="20" autocomplete="off"
          style="flex:1;font-family:var(--fn);font-size:15px;color:var(--txt);background:var(--elev);
                 border:1px solid var(--bdr);border-radius:8px;padding:9px 12px;outline:none">
        <button class="btn sm acc" style="margin:0" onclick="관리자_단어지정()">예약</button>
      </div>
    </div>

    <div class="set-sec" style="margin-bottom:8px">
      <div class="set-lbl">목숨 · 힌트</div>
      <div class="srs" style="margin-bottom:8px">현재 목숨 ${표시무한(gs.hearts)} ·
        힌트 ${표시무한(gs.hints)}</div>
      <div class="fs-opts">
        <button class="fs-opt" onclick="관리자_자원('hearts', 1)">목숨 1</button>
        <button class="fs-opt" onclick="관리자_자원('hearts', 10)">목숨 10</button>
        <button class="fs-opt" onclick="관리자_자원('hearts', Infinity)">목숨 ∞</button>
        <button class="fs-opt" onclick="관리자_자원('hints', 1)">힌트 1</button>
        <button class="fs-opt" onclick="관리자_자원('hints', 5)">힌트 5</button>
        <button class="fs-opt" onclick="관리자_자원('hints', Infinity)">힌트 ∞</button>
      </div>
    </div>

    <div class="set-sec">
      <div class="set-lbl">상태 강제</div>
      <div class="srs" style="margin-bottom:8px">연출·엔딩을 바로 확인합니다.</div>
      <div class="fs-opts">
        <button class="fs-opt" onclick="관리자_강제('승리')">즉시 승리</button>
        <button class="fs-opt" onclick="관리자_강제('패배')">즉시 패배</button>
        <button class="fs-opt" onclick="관리자_강제('시련')">시련의 탑</button>
        <button class="fs-opt" onclick="관리자_강제('소프트락')">20층 소프트락</button>
      </div>
    </div>`;
  document.getElementById('관리자Bg').classList.add('show');
}
function 관리자_패널닫기(){ document.getElementById('관리자Bg').classList.remove('show'); }

// 패널 안에서 뭔가 바꾼 뒤 화면·패널을 함께 갱신
function 관리자_반영(문구){
  로그_추가('🔓 [관리자] ' + 문구, 'ok');
  플레이_HUD갱신();
  관리자_패널열기();   // 현재값 표시를 다시 그린다
}

function 관리자_턴이동(){
  const v = Number(document.getElementById('관리자-턴').value);
  // 상한 499 — 심연 목표가 160턴이고 아케이드는 14층부터 무한 등반이라 99로는 닿지 않았다
  // (관리자님 제보: "심연에서 160 이동이 불가함").
  if(!Number.isInteger(v) || v < 1 || v > 499){
    로그_추가('🔓 [관리자] 1~499 사이의 정수만 가능합니다.', 'err'); return;
  }
  if(gs.game_mode === 'ARCADE'){
    gs.stage = v;
    // 층을 건너뛰면 그 층의 진행도·시작 턴도 함께 맞춰야 목표 달성 판정이 어긋나지 않는다
    gs.stage_turn = 0; gs.stage_start_turn = gs.turn;
    gs.curse_dark_active = false; gs.curse_dark_strikes = 0;
    gs.trial_rejected_floor = -1; gs.trial_attempts_this_floor = 0;
    gs.ai_last_char = null; gs.ai_last_word = null;
    관리자_반영(`${v}층으로 이동. 목표 ${get_stage_target(gs)}턴.`);
  } else {
    gs.turn = v;
    if(gs.turn > gs.best) gs.best = gs.turn;
    관리자_반영(`${v}턴으로 이동. 목표 ${gs.infinite ? '∞' : get_max_turns(gs)}턴.`);
  }
  프롬프트_갱신();
}

function 관리자_단어지정(){
  const w = (document.getElementById('관리자-단어').value || '').trim();
  if(!w){ 강제_AI단어 = null; 관리자_반영('다음 상대 단어 예약을 해제했습니다.'); return; }
  if(!/^[가-힣]+( [가-힣]+)?$/.test(w)){
    로그_추가('🔓 [관리자] 한글 단어만 지정할 수 있습니다(공백 1개까지).', 'err'); return;
  }
  강제_AI단어 = w;
  관리자_반영(`다음 상대 단어를 『${w}』로 예약했습니다.`);
}

function 관리자_자원(키, 값){
  gs[키] = 값;
  관리자_반영(`${키 === 'hearts' ? '목숨' : '힌트'}을(를) ${표시무한(값)}(으)로 설정했습니다.`);
}

function 관리자_강제(무엇){
  관리자_패널닫기();
  if(무엇 === '승리'){
    if(gs.game_mode === 'SURVIVAL' && gs.turn > gs.best) gs.best = gs.turn;
    if(gs.game_mode === 'ARCADE' && gs.stage > gs.best) gs.best = gs.stage;
    로그_추가('🔓 [관리자] 즉시 승리 처리.', 'ok');
    게임오버(true); return;
  }
  if(무엇 === '패배'){
    로그_추가('🔓 [관리자] 즉시 패배 처리.', 'err');
    게임오버(false); return;
  }
  if(무엇 === '시련'){
    if(gs.game_mode !== 'ARCADE'){
      로그_추가('🔓 [관리자] 시련의 탑은 아케이드 전용입니다.', 'err'); return;
    }
    gs.game_state = 'TRIAL_WAIT';
    로그_추가('░▒▓ [시련의 탑] ▓▒░ (관리자 호출)', 'sys');
    선택박스_보이기(`
      <div class="q">[1] 시간의 계약 — 이번 층 즉시 클리어 / 다음 1층 목표 턴 ×1.3<br>
      [2] 생명의 계약 — 목숨+${목숨보상}·힌트+1 / 다음 2층 두음법칙 OFF<br>
      [3] 어둠의 계약 — 목숨+${목숨보상}·힌트+3 / 이번 층 2글자 단어만 허용</div>
      <button class="btn sm acc" onclick="시련_응답(1)">시간의 계약</button>
      <button class="btn sm acc" onclick="시련_응답(2)">생명의 계약</button>
      <button class="btn sm acc" onclick="시련_응답(3)">어둠의 계약</button>
      <button class="btn sm" onclick="시련_응답(0)">거절</button>`);
    return;
  }
  if(무엇 === '소프트락'){
    gs.game_state = 'SOFTLOCKED';
    소프트락_진입();
  }
}

if (typeof module !== 'undefined') module.exports = { gs, get_status };

// '잇는' 게임 규칙 — 파이썬 원본 validate_word·ai_generate_word·user_defeat·check_title 이식
// (Phase 3: 서바이벌 모드 한정 경로만 실제로 타짐. 아케이드 분기는 원본과 동일하게 구조만 보존).
// 로그 출력은 원본의 print()를 그대로 옮긴 것 — 전역 로그_추가(text)는 서바이벌.js(UI 레이어)가 정의.
// 클래식 스크립트, 사전.js·엔진.js·게임상태.js 뒤에 로드.

// 단어 검증 — 원본과 반환 형태([통과여부, 사유문자열])까지 동일하게 유지(호출부가 사유로 분기하는
// 원본 관례를 그대로 살림: 'DARK_CONTRACT_VIOLATION' 매직 스트링, "한방 단어" 부분일치 등).
function validate_word(word, gs){
  if(gs.game_mode === 'ARCADE' && gs.curse_dark_active){
    if(word.length !== 2) return [false, 'DARK_CONTRACT_VIOLATION'];
  }
  if(gs.game_mode === 'ARCADE' && gs.stage >= 13){
    if(word.length < 3) return [false, '『영구 족쇄』 3글자 미만 단어는 허용되지 않습니다.'];
  }
  // 구(句) 허용 — 원본에 없던 신규 규칙(관리자님 확정, 2026-07-25). 공백 1개(두 단어)까지만
  // 허용하고, 그마저도 gs.phrase 설정이 켜져 있어야 통과시킨다. word는 이후 로직 전체에서
  // 여전히 통짜 문자열로 취급되므로(잇기 규칙·중복 체크·한방 판정 전부 word[0]/word[len-1]/정확
  // 일치만 봄) 이 검사 하나만 추가하면 나머지는 손댈 필요가 없다.
  {
    const 공백수 = (word.match(/ /g) || []).length;
    if(공백수 > 1) return [false, '구는 공백 1개(두 단어)까지만 허용됩니다.'];
    if(공백수 === 1 && !gs.phrase) return [false, '『구 허용』 설정을 켜야 두 단어를 이어 쓸 수 있습니다.'];
  }
  if(gs.ai_last_char !== null){
    if(!gs.rev){
      const user_head = word[0];
      if(gs.game_mode === 'ARCADE' && gs.curse_life_floors > 0){
        if(user_head !== gs.ai_last_char){
          return [false, `『${gs.ai_last_char}』(으)로 정확히 시작해야 합니다. (⛓ 생명의 계약 — 두음법칙 적용 불가)`];
        }
      } else {
        if(!dueum_check(gs.ai_last_char, user_head, gs.dueum)){
          return [false, `『${gs.ai_last_char}』(으)로 시작해야 합니다.`];
        }
      }
    } else {
      if(word[word.length - 1] !== gs.ai_last_char){
        return [false, `『${gs.ai_last_char}』(으)로 끝나야 합니다.`];
      }
    }
  }
  if(used_words(gs).includes(word)) return [false, `『${word}』은(는) 이미 사용된 단어입니다.`];
  // 사전 판정 기준은 우리말샘이다(2026-07-29). 여기서는 보조 사전(유행어·줄임말)만 즉시 통과시키고,
  // 나머지는 "사전에 없는 단어" 사유로 넘겨 UI 레이어가 우리말샘에 물어보게 한다.
  // 반환 형태·사유 문자열은 그대로라 호출부(사유로 분기하는 원본 관례)가 영향받지 않는다.
  if(!추가사전.includes(word)) return [false, `『${word}』은(는) 사전에 없는 단어입니다.`];
  if(is_hanbang(word, used_words(gs), gs.rev, gs.dueum, gs.stage)){
    if(gs.game_mode === 'ARCADE') return [false, `『${word}』은(는) 한방 단어입니다. (아케이드에서 사용 불가)`];
    else if(!gs.hanbang) return [false, `『${word}』은(는) 한방 단어입니다. (일반 모드에서 사용 불가)`];
  }
  return [true, ''];
}

// AI 상대 단어 생성 — 랜덤 선택 자체는 파이썬 random과 1:1 재현 불가(다른 PRNG)라 대조 대상이
// 아니며, 후보 풀 구성 로직(필터·공격 모드 확률표)만 원본과 동일하게 이식.
// 추가후보(2번째 인자): 국어원 API가 온라인으로 찾아준 후보 단어들(있으면). 로컬 사전과 합쳐서
// 같은 필터·선택 로직을 그대로 태운다 — attack_mode/safe_filter 등 기존 검증된 로직은 전혀
// 손대지 않고 "입력 풀만 넓히는" 방식이라 회귀 위험이 적다.
// AI가 이번 턴에 실제로 고를 수 있는 단어 풀. 후보 선택과 **한방 판정**이 같은 사전을 봐야
// 정합적이므로(2026-07-27), 종전에 ai_generate_word 안에만 있던 계산을 밖으로 꺼내 공유한다.
// 2026-07-29 전환: **온라인(우리말샘) 후보가 기본이고, 보조 사전을 그 위에 얹는다.**
// 종전과 정반대 — 종전에는 로컬 280단어가 기본이고 온라인이 "추가"였다.
// 세션_수집어는 이번 판에서 이미 받아 둔 단어들로, 네트워크가 끊겨도 AI가 계속 둘 수 있게 하는 안전망.
function ai_후보사전(gs, 추가후보 = []){
  return [...new Set([...추가후보, ...세션_수집어, ...추가사전])];
}

// AI가 한방 단어를 내면 안 되는 국면인지. 아케이드는 validate_word가 사용자의 한방 단어를 항상
// 거부하므로(45행), AI에게만 허용하면 일방적으로 불리해진다 — hanbang 설정과 무관하게 항상 금지.
// (2026-07-27 hanbang 기본값을 true로 올리면서 드러난 문제 — 종전엔 기본값이 false라 가려져 있었다.)
function ai_한방금지인가(gs){ return !gs.hanbang || gs.game_mode === 'ARCADE'; }

function ai_generate_word(gs, 추가후보 = []){
  const search_char = gs.ai_last_char;
  const used = used_words(gs);
  const ai_dueum = gs.dueum;

  const current_dict = ai_후보사전(gs, 추가후보);

  const min_len = gs.stage >= 13 ? 3 : 0;

  // ⚠️ 2026-07-27: 판정 사전을 current_dict로 넘긴다. 종전에는 후보 풀에 온라인 희귀어를 넣어
  // 놓고 한방 판정만 로컬 DICTIONARY(280개)로 해서, 온라인 후보가 거의 전부 "한방"으로 탈락했다
  // — 난이도 계층화(초월/심연에서 희귀어 사용)가 6초 네트워크만 쓰고 결과는 버리는 상태였다.
  // 다음 글자를 아직 물어본 적 없으면 한방인지 알 수 없다 → 거르지 않는다(위 조회글자 주석 참조).
  function safe_filter(candidates){
    if(!ai_한방금지인가(gs)) return candidates;
    const safe = candidates.filter(
      w => !한방_판정가능인가(w, gs)
        || !is_hanbang(w, [...used, w], gs.rev, ai_dueum, gs.stage, current_dict));
    return safe.length ? safe : candidates;
  }

  let attack_mode = false;
  if(gs.hanbang && gs.game_mode !== 'ARCADE' && gs.attack_streak === 0){
    let chance;
    if(gs.game_mode === 'SURVIVAL') chance = 난이도설정(gs).공격확률;
    else if(gs.stage <= 4) chance = 10;
    else if(gs.stage <= 8) chance = 30;
    else if(gs.stage <= 12) chance = 50;
    else chance = 70;
    if(Math.floor(Math.random() * 100) < chance) attack_mode = true;
  }

  if(attack_mode){
    const attack_cands = [];
    for(const w of find_words(search_char, used, gs.rev, ai_dueum, 0, min_len, current_dict)){
      const last = !gs.rev ? w[w.length - 1] : w[0];
      if(['ㄴ','ㄹ','ㅁ','ㅇ'].includes(extract_chosung(last))) attack_cands.push(w);
    }
    if(attack_cands.length){
      gs.attack_streak = 1;
      return 탐욕_선택(gs, attack_cands, used, current_dict);
    }
  }

  const cands = find_words(search_char, used, gs.rev, ai_dueum, 0, min_len, current_dict);
  const safe = safe_filter(cands);
  if(safe.length){
    gs.attack_streak = 0;
    return 탐욕_선택(gs, safe, used, current_dict);
  }
  return null;
}

// 난이도 탐욕도에 따라 후보 하나를 고른다 (2026-07-29 신설 — 관리자님 "난이도 차이가 안 느껴진다").
//
// 각 후보에 대해 "이 단어를 내면 사용자가 이을 수 있는 후보가 몇 개 남는가"를 세고, 그 수를 기준으로
// 정렬한 뒤 탐욕도만큼 한쪽 끝에서 뽑는다. 판정 함수(validate_word·is_hanbang)는 전혀 건드리지 않고
// **선택 단계만** 바꾸므로 파이썬 대조는 그대로 통과한다.
//
// 탐욕도 0(격동)이면 기존과 완전히 동일한 균등 랜덤이라 회귀가 없다.
function 탐욕_선택(gs, 후보들, used, 사전){
  const 탐욕도 = 난이도설정(gs).탐욕도;
  if(!탐욕도 || 후보들.length < 2) return 후보들[Math.floor(Math.random() * 후보들.length)];

  const min_len = gs.stage >= 13 ? 3 : 0;
  // 후보 수 계산은 후보마다 사전을 훑으므로, 후보가 아주 많으면 비용이 커진다.
  // 무작위로 40개만 표본으로 뽑아 그 안에서 고른다(체감 차이는 유지되고 비용은 상한이 걸린다).
  const 표본 = 후보들.length > 40
    ? [...후보들].sort(() => Math.random() - 0.5).slice(0, 40)
    : 후보들;

  // "남는 수가 N개 있다"는 언제나 확실하다(실제로 세어 봤으니까). 불확실한 건 **0일 때**뿐이다 —
  // 풀에 없을 뿐 우리말샘에는 있을 수 있기 때문. 그래서 0인데 아직 그 글자를 물어본 적이 없으면
  // "모름"으로 보고 정렬에서 뺀다. 판이 진행되며 조회한 글자가 늘수록 난이도가 또렷해진다
  // (추가 네트워크 호출 0건).
  const 점수 = 표본.map(w => {
    const 남는수 = find_words(!gs.rev ? w[w.length - 1] : w[0], [...used, w],
                             gs.rev, gs.dueum, 0, min_len, 사전).length;
    if(남는수 === 0 && !한방_판정가능인가(w, gs)) return null;   // 모름
    return { 단어: w, 남는수 };
  }).filter(Boolean);
  if(!점수.length) return 표본[Math.floor(Math.random() * 표본.length)];   // 전부 판정 불가
  // ⚠️ 공정성 한계: 탐욕도가 높으면 "남는 수 0"(=사용자가 이을 수 없는 한방 단어)이 최적이 되어
  // 심연에서 AI가 답이 없는 단어를 내고 이기는 국면이 나온다(실측 평균 0.63). 이길 수 없는 수를
  // 두는 건 난이도가 아니라 불공정이므로, **이을 수 있는 후보가 하나라도 있으면 0짜리는 제외**한다.
  // (한방 모드가 꺼져 있으면 safe_filter가 이미 걸러내므로, 이 가드는 한방 허용 상태를 위한 것.)
  const 이을수있음 = 점수.filter(x => x.남는수 > 0);
  const 대상 = 이을수있음.length ? 이을수있음 : 점수;

  // 탐욕도>0이면 남는 수가 적은 순, <0이면 많은 순
  대상.sort((a, b) => (탐욕도 > 0 ? a.남는수 - b.남는수 : b.남는수 - a.남는수));

  // |탐욕도|가 1이면 맨 앞(최적) 하나, 0에 가까울수록 넓은 구간에서 무작위.
  const 폭 = Math.max(1, Math.round(대상.length * (1 - Math.abs(탐욕도))));
  return 대상[Math.floor(Math.random() * 폭)].단어;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   우리말샘 후보 조회 (2026-07-29 전면 전환 — 관리자님 "90 정도를 온라인에 초점을 둔다")
   ────────────────────────────────────────────────────────────────
   종전의 `희귀어_난이도인가`(초월·심연/11층+만 온라인 조회)는 **삭제**했다. 이제 전 난이도가
   우리말샘을 탄다. 난이도는 후보의 "출처"가 아니라 `난이도_슬라이스`(어느 구간을 쓰나)와
   `탐욕_선택`(그중 무엇을 고르나)이 만든다.

   ⚠️ 로컬 사전이 없어졌으므로 네트워크 실패 = 게임 정지가 될 수 있다. 안전망 두 겹을 둔다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// 안전망 ① — 이번 판에서 우리말샘이 준 단어·검증을 통과한 단어를 누적한다.
// 조회가 실패해도 이미 받아 둔 단어로 AI가 계속 둘 수 있다.
let 세션_수집어 = [];
function 세션_수집(단어들){
  const 새것 = (Array.isArray(단어들) ? 단어들 : [단어들]).filter(w => typeof w === 'string' && w);
  if(새것.length) 세션_수집어 = [...new Set([...세션_수집어, ...새것])];
}

// 이번 판에서 우리말샘에 **실제로 물어본** 글자들. 한방 판정의 전제가 된다.
//
// ⚠️ 이게 왜 필요한가: 로컬 사전이 있던 시절에는 후보 풀이 곧 "세상의 모든 단어"였으므로
// "풀에 이을 단어가 없다 = 한방"이 성립했다. 이제 풀은 **이번 글자에 대해 받아 온 목록**뿐이라
// 다음 글자의 후보는 아직 모른다. 모르는 걸 "없다"로 단정하면 AI가 내는 정상 단어가 전부
// 한방으로 오판돼 매 턴 사용자가 이겨 버린다(실측으로 확인).
// → **물어본 적 있는 글자에 대해서만 한방을 판정한다.**
let 세션_조회글자 = new Set();
function 조회한_글자인가(글자, rev){ return 세션_조회글자.has((rev ? 'end:' : 'start:') + 글자); }
function 한방_판정가능인가(word, gs){
  const 다음 = !gs.rev ? word[word.length - 1] : word[0];
  return 조회한_글자인가(다음, gs.rev);
}

// 안전망 ② — 연속 실패가 쌓이면 조용히 이상하게 돌지 말고 호출부가 명시적으로 알리게 한다.
let 연속_조회실패 = 0;
const 조회실패_한계 = 3;
function 우리말샘_불통인가(){ return 연속_조회실패 >= 조회실패_한계; }

function 세션_비우기(){ 세션_수집어 = []; 세션_조회글자 = new Set(); 연속_조회실패 = 0; }

// 난이도별 후보 구간 — 우리말샘은 표제어 순으로 오므로 앞쪽이 상대적으로 흔한 말이고 뒤로 갈수록
// 희귀어다. 종전에 "로컬(자연스러운 말)이냐 온라인(희귀어)이냐"로 나누던 품질 축을 이걸로 대체한다.
function 난이도_슬라이스(gs, 목록){
  if(!목록.length || gs.game_mode === 'ARCADE') return 목록;
  const 비율 = { 안온:0.4, 격동:0.7, 초월:1.0, 심연:1.0 }[gs.diff] ?? 1.0;
  if(비율 >= 1) return 목록;
  return 목록.slice(0, Math.max(1, Math.round(목록.length * 비율)));
}

// 마지막 온라인 후보 조회의 결과 — UI가 화면에 상태를 설명하는 데 쓴다.
//   상태: '미시도'(게이트 off 등) | '성공' | '실패'(네트워크·시간초과) | '없음'(0건)
let 마지막_온라인조회 = { 상태:'미시도', 개수:0 };

// 이번 턴 후보를 우리말샘에서 받아 온다. **난이도와 무관하게 항상** 호출한다(2026-07-29).
//
// ⚠️ 두음법칙 변형 글자까지 함께 조회한다(2026-07-29 수정).
// 종전에는 gs.ai_last_char 한 글자만 물어봤다. 그런데 끝말잇기에서 '락'으로 끝났으면 '낙'·'악'으로
// 시작하는 단어도 규칙상 정답이다 — 그 글자들은 아예 물어보지도 않아 후보에서 통째로 빠져 있었다.
// 게다가 한방 판정(한방_확정인가)은 이미 get_valid_start_chars로 변형까지 다 확인하고 있어서,
// **"AI는 못 찾는데 한방은 아니다"** 라는 어긋난 상태가 만들어졌다. 두 곳의 기준을 맞춘다.
// 부수 효과로 후보 풀이 두세 배 넓어져, Worker가 후보를 적게 주는 현 상황(Worker_수정요청.md ②)의
// 완화책도 된다. 앞말잇기(rev)는 "그 글자로 끝나는 단어"라 변형이 없다 — 종전과 동일하게 1회 호출.
async function 온라인후보_가져오기(gs){
  마지막_온라인조회 = { 상태:'미시도', 개수:0 };
  if(!국어원_활성화 || !gs.ai_last_char) return [];

  const 방향 = gs.rev ? 'end' : 'start';
  const 조회할글자 = gs.rev ? [gs.ai_last_char]
                           : get_valid_start_chars(gs.ai_last_char, gs.dueum);
  const 결과들 = await Promise.all(조회할글자.map(c => 국어원_후보목록조회(c, 방향)));

  // 전부 실패했을 때만 실패로 본다 — 하나라도 받아 왔으면 그걸로 진행하는 편이 낫다.
  if(결과들.every(r => r === null)){
    연속_조회실패 += 1;
    마지막_온라인조회 = { 상태:'실패', 개수:0 };
    return [];
  }
  연속_조회실패 = 0;

  const 목록 = [];
  결과들.forEach((r, i) => {
    if(r === null) return;
    // 실제로 응답을 받은 글자만 "물어본 글자"로 기록한다(한방 판정의 전제).
    세션_조회글자.add(방향 + ':' + 조회할글자[i]);
    for(const w of r) if(!목록.includes(w)) 목록.push(w);
  });
  세션_수집(목록);                       // 받은 건 전부 세션에 쌓아 둔다(안전망 ①)
  const 슬라이스 = 난이도_슬라이스(gs, 목록);
  마지막_온라인조회 = { 상태: 슬라이스.length ? '성공' : '없음', 개수: 슬라이스.length };
  return 슬라이스;
}

// 이 단어가 **정말** 한방 단어인지 확정 (2026-07-27 신설 — 관리자님 "바로 패배" 제보의 핵심 수정).
//
// 로컬 is_hanbang은 280단어짜리 DICTIONARY만 보므로 "이을 단어가 없다"는 결론을 그대로 믿을 수
// 없다(실측: 흔한 단어의 44%가 오판). 그래서 로컬이 한방이라고 말할 때만 국어원 API로 실제
// 이을 수 있는 단어가 있는지 한 번 더 확인하고, 있으면 판정을 뒤집는다.
//
// 판정 우선순위:
//   1. 로컬에서 이을 단어를 찾음        → 한방 아님 (네트워크 0건 — 대부분의 턴이 여기서 끝난다)
//   2. 게이트 off                        → 로컬 판정이 유일한 근거이므로 그대로 (기존 동작 보존)
//   3. 온라인 조회 실패(null)            → **한방으로 단정하지 않는다.** 확인을 못 했을 뿐인데
//                                          사용자에게 불이익을 주지 않는다(국어원 실패 공정성).
//   4. 온라인 후보에 이을 단어가 있음    → 한방 아님
//   5. 온라인으로도 0개임을 확인         → 한방 확정
async function 한방_확정인가(word, gs){
  const used = used_words(gs);
  if(!is_hanbang(word, used, gs.rev, gs.dueum, gs.stage)) return false;   // 1
  if(!국어원_활성화) return true;                                          // 2

  const 다음글자 = !gs.rev ? word[word.length - 1] : word[0];
  const 방향 = gs.rev ? 'end' : 'start';
  // 끝말잇기는 두음법칙 변환형으로도 이을 수 있으므로 그 글자들까지 전부 확인한다
  // (앞말잇기는 "그 글자로 끝나는 단어"라 변환형이 없다 — find_words의 reverse 분기와 동일).
  const 조회할글자 = gs.rev ? [다음글자] : get_valid_start_chars(다음글자, gs.dueum);
  // 직렬로 돌면 변형 수만큼 왕복이 쌓인다(최대 6초 × 3). 한꺼번에 물어본다.
  const 결과들 = await Promise.all(조회할글자.map(c => 국어원_후보목록조회(c, 방향)));
  if(결과들.some(r => r === null)) return false;                           // 3

  const 목록 = [];
  결과들.forEach((r, i) => {
    // 이미 값을 치른 조회다 — 세션 사전·조회글자에 반드시 반영한다. 종전에는 여기서 받은
    // 목록을 판정에만 쓰고 버려서, 같은 글자를 AI 턴에 또 물어보고 안전망에도 안 쌓였다.
    세션_조회글자.add(방향 + ':' + 조회할글자[i]);
    for(const w of r) if(!목록.includes(w)) 목록.push(w);
  });
  세션_수집(목록);
  // 이미 쓴 단어·자기 자신을 빼고, 그 층의 길이 제약을 통과하는 후보가 하나라도 남는지 본다.
  if(find_words(다음글자, [...used, word], gs.rev, gs.dueum, 0,
                gs.stage >= 13 ? 3 : 0, 목록).length) return false;        // 4
  return true;                                                             // 5
}

// 온라인 후보까지 포함해 AI 단어를 고르는 비동기 래퍼(2026-07-24 신설, 관리자님 지시).
// 게이트 off·API 실패(네트워크 오류 등)면 빈 배열로 강등돼 기존 ai_generate_word(gs)와 동일하게
// 로컬 사전만으로 동작한다(하이브리드: 실패 시 로컬 폴백). 어떤 풀을 쓸지는 위 난이도 규칙이 결정.
async function ai_generate_word_비동기(gs){
  const 추가후보 = await 온라인후보_가져오기(gs);
  return ai_generate_word(gs, 추가후보);
}

// 칭호 체크 — 서바이벌 턴 마일스톤(95/100/200/30배수) + 아케이드(Phase 4) 자리 보존
function check_title(gs){
  if(gs.god_mode_active){ gs.user_title = '최고 관리자님'; return; }
  if(gs.game_mode === 'SURVIVAL'){
    if(gs.turn === 95 && ['초월','심연'].includes(gs.diff)){
      gs.user_title = is_arrogant(gs) ? '각성자' : '숙련자님';
      로그_추가(대사(gs, 'check_title_4'));
    } else if(gs.turn === 100 && ['안온','격동'].includes(gs.diff)){
      gs.user_title = is_arrogant(gs) ? '각성자' : '숙련자님';
      로그_추가(대사(gs, 'check_title_3'));
    } else if(gs.turn === 200 && ['초월','심연'].includes(gs.diff)){
      gs.user_title = is_arrogant(gs) ? '초월자' : '마스터님';
      로그_추가(대사(gs, 'check_title_2'));
    } else if(gs.turn > 0 && gs.turn % 30 === 0 && ![60,90,95,100,150,200].includes(gs.turn)){
      로그_추가(대사(gs, 'check_title_1', [gs.turn]));
    }
  } else if(gs.game_mode === 'ARCADE'){
    if(gs.stage >= 14 && !['탑의지배자','탑의주인님'].includes(gs.user_title)){
      gs.user_title = is_arrogant(gs) ? '탑의지배자' : '탑의주인님';
    }
  }
}

// 패배 처리(틀리면 목숨 -1) — 원본 100턴/95턴 직전 탈락 특수 대사 포함.
// 2026-07-29: 원본의 '실수(strikes) 4회 = 목숨 1개' 2단 구조를 폐지하고 목숨 하나로 통일했다.
function user_defeat(gs){
  if(gs.game_mode === 'SURVIVAL'){
    if(['안온','격동'].includes(gs.diff) && gs.turn >= 90 && gs.turn <= 99){
      로그_추가(대사(gs, 'user_defeat_4'));
    } else if(['초월','심연'].includes(gs.diff) && gs.turn >= 85 && gs.turn <= 94){
      로그_추가(대사(gs, 'user_defeat_3'));
    }
  }

  // 2026-07-29 관리자님 지시: "실수 값을 없애고 목숨 값으로만 진행" — 종전의 2단 구조
  // (실수 4회가 쌓여야 목숨 1개 소모)를 없애고 **틀리면 곧바로 목숨 -1**로 통일했다.
  // 실효 기회 수를 유지하려고 난이도표의 목숨을 종전의 4배 선으로 올렸다(난이도표 주석 참조).
  gs.hearts -= 1;
  const h = gs.hearts === Infinity ? '∞' : String(gs.hearts);
  if(gs.hearts < 0) gs.hearts = 0;

  if(gs.hearts === 0){
    if(gs.game_mode === 'SURVIVAL'){
      로그_추가(대사(gs, 'user_defeat_패배', {칭호: title(gs)}));
      if(gs.turn > gs.best) gs.best = gs.turn;
    } else {
      로그_추가(대사(gs, 'user_defeat_한계', {층: gs.stage, 칭호: title(gs)}));
      if(gs.stage > gs.best) gs.best = gs.stage;
    }
    return 'game_over';
  } else {
    로그_추가(대사(gs, 'user_defeat_1', [h]));
    // 아케이드의 '층 재시작'은 원본에서 "목숨 1개를 대가로 층을 다시"라는 뜻이었는데,
    // 목숨이 한 번에 하나씩 깎이게 되면서 그 대가 관계가 사라졌다 → 층 재시작 폐지.
    // 이제 두 모드 모두 목숨이 0이 될 때까지 그 자리에서 계속 이어간다.
    return 'continue';
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   아케이드 — 층 이동·시련의 탑 (Phase 4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// 시련의 탑 붕괴 확률 — 같은 층에서 재도전할수록 위험 증가(2회 50% / 3회 75% / 4회+ 100%)
function 붕괴확률(attempts){
  if(attempts === 2) return 50;
  if(attempts === 3) return 75;
  if(attempts >= 4) return 100;
  return 0;
}

// 층 클리어 → 다음 층 진입. ai_defeated=true면 AI가 단어를 못 찾아 클리어된 경우.
function arcade_floor_up(gs, ai_defeated){
  const cleared = gs.stage;
  gs.stage += 1; gs.stage_turn = 0; gs.stage_start_turn = gs.turn;

  if(gs.stage === 9) gs.erosion_level = 1;
  if(gs.stage === 20){ gs.game_state = 'SOFTLOCKED'; return; }

  if(gs.curse_time_floors > 0) gs.curse_time_floors -= 1;
  if(gs.curse_life_floors > 0) gs.curse_life_floors -= 1;
  gs.curse_dark_active = false; gs.curse_dark_strikes = 0;
  gs.trial_rejected_floor = -1; gs.trial_attempts_this_floor = 0;

  if(cleared % 2 === 0){
    if(gs.hints !== Infinity) gs.hints += 1;
    로그_추가(`💡 [${cleared}층 보상] 힌트 +1 획득. 남은 힌트: ${표시무한(gs.hints)}`, 'ok');
  }

  const target = get_stage_target(gs);
  if(gs.curse_time_floors > 0) 로그_추가(`⛓ [시간의 계약] 이번 층 목표 턴 +30% (${target}턴)`, 'sys');
  if(gs.curse_life_floors > 0) 로그_추가(`⛓ [생명의 계약] 두음법칙 OFF 유지 (${gs.curse_life_floors}층 남음)`, 'sys');

  if(ai_defeated){
    로그_추가(대사(gs, 'arcade_floor_up_3'), 'ok');
  } else {
    로그_추가(대사(gs, 'arcade_floor_up_2', [cleared, gs.stage]), 'ok');
  }
  if(gs.stage === 13){
    로그_추가(대사(gs, 'arcade_floor_up_1'), 'warn');
  }
  gs.ai_last_char = null; gs.ai_last_word = null;
}

/* ⚠️ 봉인 (2026-07-29) — 아케이드 '층 재시작'
   원본에서 이 함수는 "실수 4회로 목숨 1개를 잃으면 그 대가로 층을 처음부터 다시"라는 뜻이었다.
   실수(strikes)를 폐지하고 목숨 하나로 통일하면서 그 대가 관계 자체가 사라져 호출부가 없어졌다
   (이제 두 모드 모두 목숨이 0이 될 때까지 그 자리에서 계속 이어간다 — user_defeat 참조).
   되살릴 근거를 남겨 두려고 지우지 않고 주석으로 보존한다(이의/허세 봉인과 같은 관례).

function arcade_restart_floor(gs){
  gs.stage_turn = 0; gs.curse_dark_strikes = 0;
  gs.ai_last_char = null; gs.ai_last_word = null;
}
*/

if (typeof module !== 'undefined') module.exports = {
  validate_word, ai_generate_word, ai_generate_word_비동기, check_title, user_defeat,
  붕괴확률, arcade_floor_up,   // arcade_restart_floor는 봉인(위 주석)
  온라인후보_가져오기, 세션_수집, 세션_비우기, 우리말샘_불통인가, 난이도_슬라이스,
  조회한_글자인가, 한방_판정가능인가,
  get 세션_수집어(){ return 세션_수집어; }, ai_후보사전, ai_한방금지인가, 한방_확정인가, 탐욕_선택,
  get 마지막_온라인조회(){ return 마지막_온라인조회; }
};

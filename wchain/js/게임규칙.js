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
  if(!DICTIONARY.includes(word) && !HARD_DICT.includes(word)) return [false, `『${word}』은(는) 사전에 없는 단어입니다.`];
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
function ai_후보사전(gs, 추가후보 = []){
  let current_dict = 추가후보.length ? [...new Set([...DICTIONARY, ...추가후보])] : DICTIONARY;
  if(gs.stage >= 11) current_dict = [...new Set([...current_dict, ...HARD_DICT])];
  return current_dict;
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
  function safe_filter(candidates){
    if(!ai_한방금지인가(gs)) return candidates;
    const safe = candidates.filter(
      w => !is_hanbang(w, [...used, w], gs.rev, ai_dueum, gs.stage, current_dict));
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

  const 점수 = 표본.map(w => ({
    단어: w,
    남는수: find_words(!gs.rev ? w[w.length - 1] : w[0], [...used, w],
                      gs.rev, gs.dueum, 0, min_len, 사전).length,
  }));
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

// 희귀어 풀(온라인)을 쓸 난이도인지 판정 — 2026-07-26 신설, 관리자님 지시
// ("희귀어는 어려운 난이도로 보내고, 일반 명사는 낮은 난이도 쪽으로").
//
// 근거(실측): 국어원 후보 목록은 우리말샘 원본이라 방언·옛말·고유명사가 그대로 섞여 나온다.
// '스'로 시작하는 단어를 요청하면 스가랴(성경 인명)·스굼푸·스까락·스께또·스그머니·스나조…처럼
// 표제어 순서상 앞쪽의 희귀어만 잘려서 온다. 반면 로컬 DICTIONARY(280)+HARD_DICT(80)는 원본
// 파이썬에서 기계 추출한 자연스러운 일반 단어 집합이다. 이 두 집합의 성격 차이를 그대로
// 난이도에 매핑한다 — 낮은 난이도는 자연스러운 단어로, 높은 난이도는 희귀어까지.
//
// 부수 효과(의도됨): 낮은 난이도에선 온라인 호출 자체가 사라져 AI 턴 지연도 함께 없어진다.
function 희귀어_난이도인가(gs){
  if(gs.game_mode === 'ARCADE') return gs.stage >= 11;   // 기존 HARD_DICT 합류 기준과 동일한 층
  return gs.diff === '초월' || gs.diff === '심연';
}

// AI 턴·힌트가 공유하는 후보 풀 조회(2026-07-26 신설). 난이도에 따라 온라인 희귀어 풀을
// 섞을지 정하고, 낮은 난이도에선 로컬 후보가 하나라도 있으면 네트워크를 아예 타지 않는다.
// 반환값은 ai_generate_word/find_words에 넘길 "추가 후보 배열"(로컬은 호출부가 이미 갖고 있음).
// 마지막 온라인 후보 조회의 결과 — UI가 "왜 희귀어가 안 나오는지"를 화면에 설명하는 데 쓴다.
// 관리자님 제보: "심연인데 희귀어가 그렇게 많이 나오는 느낌을 못 받았다".
// 종전에는 조회 실패 시 조용히 빈 배열로 강등돼(?? []) 사용자가 알 방법이 아예 없었다.
//   상태: '미시도'(낮은 난이도라 안 부름) | '성공' | '실패'(네트워크·시간초과) | '없음'(0건)
let 마지막_온라인조회 = { 상태:'미시도', 개수:0 };

async function 온라인후보_가져오기(gs){
  마지막_온라인조회 = { 상태:'미시도', 개수:0 };
  if(!국어원_활성화 || !gs.ai_last_char) return [];
  if(!희귀어_난이도인가(gs)){
    // 낮은 난이도 — 로컬 큐레이션 사전에 이을 단어가 있으면 그걸로 충분(희귀어 불필요).
    // 어둠의 계약(정확히 2글자)이 걸린 층에서는 그 제약까지 반영해야 "로컬로 충분"이 참이 된다.
    const dark_filter = (gs.game_mode === 'ARCADE' && gs.curse_dark_active) ? 2 : 0;
    const 로컬후보 = find_words(gs.ai_last_char, used_words(gs), gs.rev, gs.dueum, dark_filter,
                              gs.stage >= 13 ? 3 : 0);
    if(로컬후보.length) return [];
    // 로컬이 완전히 막힌 경우에만 온라인으로 확장(막다른 길 방지 — 기존 폴백 취지 유지).
  }
  // 조회 실패(null)는 빈 배열로 정규화 — AI 턴은 로컬 사전만으로 안전하게 강등된다.
  // 다만 "실패해서 강등됐다"는 사실은 기록해 둔다(위 마지막_온라인조회 주석 참조).
  const 목록 = await 국어원_후보목록조회(gs.ai_last_char, gs.rev ? 'end' : 'start');
  if(목록 === null){ 마지막_온라인조회 = { 상태:'실패', 개수:0 }; return []; }
  마지막_온라인조회 = { 상태: 목록.length ? '성공' : '없음', 개수: 목록.length };
  return 목록;
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
  // 끝말잇기는 두음법칙 변환형으로도 이을 수 있으므로 그 글자들까지 전부 확인한다
  // (앞말잇기는 "그 글자로 끝나는 단어"라 변환형이 없다 — find_words의 reverse 분기와 동일).
  const 조회할글자 = gs.rev ? [다음글자] : get_valid_start_chars(다음글자, gs.dueum);

  for(const 글자 of 조회할글자){
    const 목록 = await 국어원_후보목록조회(글자, gs.rev ? 'end' : 'start');
    if(목록 === null) return false;                                        // 3
    // 이미 쓴 단어·자기 자신을 빼고, 그 층의 길이 제약을 통과하는 후보가 하나라도 남는지 본다.
    if(find_words(다음글자, [...used, word], gs.rev, gs.dueum, 0,
                  gs.stage >= 13 ? 3 : 0, 목록).length) return false;      // 4
  }
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
      로그_추가(say(gs, "⚔ [각성] 95턴 생존. '각성자'가 되었군.", '⚔ [각성] 95턴 돌파! 숙련자님 축하드립니다!'));
    } else if(gs.turn === 100 && ['안온','격동'].includes(gs.diff)){
      gs.user_title = is_arrogant(gs) ? '각성자' : '숙련자님';
      로그_추가(say(gs, "🎉 100턴. '각성자'로 인정하마.", '🎉 100턴 돌파! 축하드립니다, 숙련자님!'));
    } else if(gs.turn === 200 && ['초월','심연'].includes(gs.diff)){
      gs.user_title = is_arrogant(gs) ? '초월자' : '마스터님';
      로그_추가(say(gs, "🎉 [HIDDEN] 200턴... '초월자'.", '🎉 [HIDDEN] 200턴 달성! 진정한 마스터님!'));
    } else if(gs.turn > 0 && gs.turn % 30 === 0 && ![60,90,95,100,150,200].includes(gs.turn)){
      로그_추가(say(gs, `흥... ${gs.turn}턴. 조금은 봐줄 만하군.`, `🎉 [MILESTONE] ${gs.turn}턴 돌파!`));
    }
  } else if(gs.game_mode === 'ARCADE'){
    if(gs.stage >= 14 && !['탑의지배자','탑의주인님'].includes(gs.user_title)){
      gs.user_title = is_arrogant(gs) ? '탑의지배자' : '탑의주인님';
    }
  }
}

// 패배 처리(실수 4회 → 목숨 -1) — 원본 100턴/95턴 직전 탈락 특수 대사 포함
function user_defeat(gs){
  if(gs.game_mode === 'SURVIVAL'){
    if(['안온','격동'].includes(gs.diff) && gs.turn >= 90 && gs.turn <= 99){
      로그_추가(say(gs, '이런... 100턴 직전에 미끄러지다니. (깔깔)', '아쉽네요... 100턴이 바로 앞이었는데!'));
    } else if(['초월','심연'].includes(gs.diff) && gs.turn >= 85 && gs.turn <= 94){
      로그_추가(say(gs, "95턴 '각성' 바로 직전이었는데.", '아쉽네요! 95턴 달성이 코앞이었어요!'));
    }
  }

  gs.strikes += 1;

  if(gs.strikes < 4){
    로그_추가(say(gs, `쯧쯧... ⚠️ [실수 ${gs.strikes}/4]`, `⚠️ [실수 ${gs.strikes}/4] 힘내세요!`));
    return 'continue';
  }

  gs.strikes = 0;
  gs.hearts -= 1;
  const h = gs.hearts === Infinity ? '∞' : String(gs.hearts);
  if(gs.hearts < 0) gs.hearts = 0;

  if(gs.hearts === 0){
    if(gs.game_mode === 'SURVIVAL'){
      로그_추가(say(gs, `푸하하! [4회 실수] 패배다, ${title(gs)}!`, '💀 [4회 실수] 패배했습니다. 수고하셨어요!'));
      if(gs.turn > gs.best) gs.best = gs.turn;
    } else {
      로그_추가(say(gs, `크크크... ${gs.stage}층이 네 한계였나, ${title(gs)}.`, `수고하셨습니다! ${gs.stage}층까지 잘하셨어요!`));
      if(gs.stage > gs.best) gs.best = gs.stage;
    }
    return 'game_over';
  } else {
    로그_추가(say(gs, `💔 [목숨 -1] 남은 목숨: ${h}. 더 집중하지 못하나?`, `💔 [목숨 -1] 남은 목숨: ${h}. 괜찮아요, 다시 해봐요!`));
    if(gs.game_mode === 'ARCADE') return 'restart_floor';   // Phase 4에서 실제 층 재시작 연결
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
    로그_추가(say(gs, '크윽... 단어가 없다. 이번 층은 네가 가져라.', '앗... 단어가 없네요! 이번 층은 통과하셨습니다!'), 'ok');
  } else {
    로그_추가(say(gs, `흥... ${cleared}층은 클리어했군. ${gs.stage}층으로 진입한다.`, `🎉 [${cleared}층 클리어!] ${gs.stage}층으로 진입합니다!`), 'ok');
  }
  if(gs.stage === 13){
    로그_추가(say(gs, '얄팍한 두 글자 단어로 연명하는 꼴은 여기까지다. 이제 세 마디 이상의 무게를 증명해라.',
                  '이제부터 두 글자 단어는 시스템에서 접수하지 않습니다. 조금 더 성의 있는 단어를 준비해 주시죠.'), 'warn');
  }
  gs.ai_last_char = null; gs.ai_last_word = null;
}

// 실수 4회로 목숨 소진 → 같은 층 재시작(서바이벌과 달리 게임오버 아님)
function arcade_restart_floor(gs){
  gs.stage_turn = 0; gs.curse_dark_strikes = 0;
  gs.ai_last_char = null; gs.ai_last_word = null;
}

if (typeof module !== 'undefined') module.exports = {
  validate_word, ai_generate_word, ai_generate_word_비동기, check_title, user_defeat,
  붕괴확률, arcade_floor_up, arcade_restart_floor,
  희귀어_난이도인가, 온라인후보_가져오기, ai_후보사전, ai_한방금지인가, 한방_확정인가, 탐욕_선택,
  get 마지막_온라인조회(){ return 마지막_온라인조회; }
};

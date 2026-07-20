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
function ai_generate_word(gs){
  const search_char = gs.ai_last_char;
  const used = used_words(gs);
  const ai_dueum = gs.dueum;

  let current_dict = DICTIONARY;
  if(gs.stage >= 11) current_dict = [...new Set([...DICTIONARY, ...HARD_DICT])];

  const min_len = gs.stage >= 13 ? 3 : 0;

  function safe_filter(candidates){
    if(gs.hanbang) return candidates;
    const safe = candidates.filter(w => !is_hanbang(w, [...used, w], gs.rev, ai_dueum, gs.stage));
    return safe.length ? safe : candidates;
  }

  let attack_mode = false;
  if(gs.hanbang && gs.attack_streak === 0){
    let chance;
    if(gs.game_mode === 'SURVIVAL') chance = { 안온:5, 격동:15, 초월:35, 심연:50 }[gs.diff] ?? 15;
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
      return attack_cands[Math.floor(Math.random() * attack_cands.length)];
    }
  }

  const cands = find_words(search_char, used, gs.rev, ai_dueum, 0, min_len, current_dict);
  const safe = safe_filter(cands);
  if(safe.length){
    gs.attack_streak = 0;
    return safe[Math.floor(Math.random() * safe.length)];
  }
  return null;
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

if (typeof module !== 'undefined') module.exports = { validate_word, ai_generate_word, check_title, user_defeat };

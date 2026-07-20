// '잇는' 한글 엔진 — 파이썬 원본(K-WordChain v2.2)의 결정론 로직 1:1 이식.
// 함수명은 원본(snake_case)과 동일하게 유지 — 파이썬↔JS 자동 대조 검증의 기준.
// 클래식 스크립트(전역 공유, Llove와 동일 원칙). 사전.js 뒤에 로드할 것.
// 검증: scripts/…대조 러너가 원본에서 추출한 벡터(두음 1,176·탐색 400·한방 500 등)와 전수 비교.

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   두음법칙 및 한글 처리 (원본 275~357줄)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const _INITIALS = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ',
                   'ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
// ㅣ계 모음(중성 인덱스): ㅑ2 ㅒ3 ㅕ6 ㅖ7 ㅛ12 ㅠ17 ㅣ20 — 두음법칙에서 ㄹ→ㅇ 계열 판단 기준
const _VOWEL_I_GROUP = new Set([2, 3, 6, 7, 12, 17, 20]);

// 한글 음절 분해 → [초성, 중성, 종성] 인덱스. 비한글은 [-1,-1,-1].
function _decompose(char){
  const code = char.codePointAt(0);
  if(!(0xAC00 <= code && code <= 0xD7A3)) return [-1, -1, -1];
  const offset = code - 0xAC00;
  return [Math.floor(offset / 588), Math.floor((offset % 588) / 28), offset % 28];
}

// 초/중/종성 인덱스 → 음절 재합성. 범위 밖이면 null.
function _recompose(ini, mid, fin){
  const code = 0xAC00 + ini * 588 + mid * 28 + fin;
  return (0xAC00 <= code && code <= 0xD7A3) ? String.fromCodePoint(code) : null;
}

// char의 두음법칙 허용 변환형 목록 (mode: 'OFF' | 'Flexible' | 'Strict')
function get_dueum_variants(char, mode){
  if(mode === 'OFF') return [];
  const [ini, mid, fin] = _decompose(char);
  if(ini === -1) return [];

  const initial = _INITIALS[ini];
  const variants = [];

  if(initial === 'ㄹ'){
    // ⚠️ 원본 결함 수정: 파이썬 원본은 ㄴ 자리에 인덱스 1(_INITIALS[1]='ㄲ')을 써서
    //    ㄹ→ㄲ('로'→'꼬')으로 변환되는 오프바이원 버그가 있었다. 두음법칙 의도(ㄹ→ㄴ,
    //    '로'→'노')대로 ㄴ=인덱스 2로 교정 — 대조 벡터도 교정판 기준으로 재생성해 검증.
    if(mode === 'Flexible'){
      const new_ini = _VOWEL_I_GROUP.has(mid) ? 11 : 2;   // ㅣ계 모음이면 ㅇ, 아니면 ㄴ
      const v = _recompose(new_ini, mid, fin);
      if(v) variants.push(v);
    } else {
      if(!_VOWEL_I_GROUP.has(mid)){                        // Strict: ㄹ→ㄴ만 (ㅣ계 제외)
        const v = _recompose(2, mid, fin);
        if(v) variants.push(v);
      }
    }
  } else if(initial === 'ㄴ' && mode === 'Flexible'){
    if(_VOWEL_I_GROUP.has(mid)){                           // ㄴ→ㅇ (ㅣ계 모음 한정)
      const v = _recompose(11, mid, fin);
      if(v) variants.push(v);
    }
  }
  return variants;
}

// actual_char이 expected_char의 두음법칙 허용 범위인지
function dueum_check(expected_char, actual_char, dueum_mode){
  if(actual_char === expected_char) return true;
  if(dueum_mode === 'OFF') return false;
  return get_dueum_variants(expected_char, dueum_mode).includes(actual_char);
}

// char 기준 시작 가능한 모든 글자 목록 (자기 자신 + 두음 변환형)
function get_valid_start_chars(char, dueum_mode){
  const valid = [char];
  if(dueum_mode === 'OFF') return valid;
  for(const v of get_dueum_variants(char, dueum_mode)){
    if(!valid.includes(v)) valid.push(v);
  }
  return valid;
}

// 단어의 초성 추출 (비한글 문자는 그대로 통과 — 원본 동일)
function extract_chosung(word){
  let result = '';
  for(const ch of word){
    const code = ch.codePointAt(0);
    if(0xAC00 <= code && code <= 0xD7A3){
      result += _INITIALS[Math.floor((code - 0xAC00) / 588)];
    } else {
      result += ch;
    }
  }
  return result;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   단어 탐색 · 한방 판정 (원본 379~409줄)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// 조건에 맞는 단어 목록 탐색.
// reverse=false: start_char(+두음 변환형)로 "시작"하는 단어 / true(앞말잇기): start_char로 "끝나는" 단어.
// length_filter>0: 정확히 그 길이만(어둠의 계약 2글자) / min_length>0: 그 길이 이상(13층+ 3글자 족쇄).
function find_words(start_char, used, reverse = false, dueum_mode = 'OFF',
                    length_filter = 0, min_length = 0, dictionary_source = null){
  const result = [];
  const current_dict = (dictionary_source !== null && dictionary_source !== undefined)
    ? dictionary_source : DICTIONARY;
  const used_set = new Set(used);   // 원본은 리스트 in 검사 — 의미 동일, 성능만 개선

  if(!reverse){
    const valid_starts = get_valid_start_chars(start_char, dueum_mode);
    for(const w of current_dict){
      if(used_set.has(w)) continue;
      if(length_filter > 0 && w.length !== length_filter) continue;
      if(min_length > 0 && w.length < min_length) continue;
      if(valid_starts.includes(w[0])) result.push(w);
    }
  } else {
    for(const w of current_dict){
      if(used_set.has(w)) continue;
      if(length_filter > 0 && w.length !== length_filter) continue;
      if(min_length > 0 && w.length < min_length) continue;
      if(w[w.length - 1] === start_char) result.push(w);
    }
  }
  return result;
}

// 한방 단어 판정 — 이 단어를 낸 뒤 상대가 이을 단어가 0개면 true.
// stage>=13: 3글자 족쇄가 걸린 층이므로 min_length=3 기준으로 판정 (원본 동일).
function is_hanbang(word, used, reverse = false, dueum_mode = 'OFF', stage = 0){
  const next_char = !reverse ? word[word.length - 1] : word[0];
  const min_len = stage >= 13 ? 3 : 0;
  return find_words(next_char, [...used, word], reverse, dueum_mode, 0, min_len).length === 0;
}

// jsdom/node 대조 테스트용 내보내기 (브라우저에선 무시)
if (typeof module !== 'undefined') module.exports = {
  _INITIALS, _VOWEL_I_GROUP, _decompose, _recompose,
  get_dueum_variants, dueum_check, get_valid_start_chars, extract_chosung,
  find_words, is_hanbang
};

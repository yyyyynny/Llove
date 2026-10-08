// '잇는' 한글 엔진 — 파이썬 원본(K-WordChain v2.2)의 결정론 로직 이식.
// 함수명은 원본(snake_case) 그대로. 2026-09-27(Q6) 원본 1:1 구조를 풀고 중복·죽은 분기를 정리했다
// (전 음절 × 두음 모드 3종 · 사전 탐색 무작위 표본으로 정리 전후 결과 동일 확인).
// 클래식 스크립트(전역 공유, Llove와 동일 원칙). 사전.js 뒤에 로드할 것.
// 검증: 2026-07-20 원본에서 추출한 벡터(두음 1,176·탐색 400·한방 500 등)와 전수 대조해 일치 확인
//   (당시 세션에서 1회 실행, 러너는 미커밋). 다시 대조하려면 tests/test-wchain-한방.cjs처럼
//   vm으로 이 파일을 불러와 함수를 꺼내 쓰면 된다(node용 module.exports는 2026-09-26 삭제).

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

// 초/중/종성 인덱스 → 음절 재합성(호출부는 항상 유효 인덱스만 넘긴다).
function _recompose(ini, mid, fin){
  return String.fromCodePoint(0xAC00 + ini * 588 + mid * 28 + fin);
}

// char의 두음법칙 허용 변환형 목록 (mode: 'OFF' | 'Flexible' | 'Strict')
function get_dueum_variants(char, mode){
  if(mode === 'OFF') return [];
  const [ini, mid, fin] = _decompose(char);
  if(ini === -1) return [];

  const ㅣ계 = _VOWEL_I_GROUP.has(mid);
  // 초성 인덱스: ㄴ=2 ㄹ=5 ㅇ=11. 변환형은 최대 1개(초성이 바뀌므로 원래 글자와 같을 수 없다).
  // ⚠️ 원본 결함 수정: 파이썬 원본은 ㄹ→ㄴ 자리에 인덱스 1('ㄲ')을 써서 '로'→'꼬'가 되는
  //    오프바이원 버그가 있었다. 두음법칙 의도(ㄹ→ㄴ, '로'→'노')대로 2로 교정.
  if(ini === 5){
    if(mode === 'Flexible') return [_recompose(ㅣ계 ? 11 : 2, mid, fin)];  // ㅣ계면 ㅇ, 아니면 ㄴ
    return ㅣ계 ? [] : [_recompose(2, mid, fin)];                          // Strict: ㄹ→ㄴ만
  }
  if(ini === 2 && mode === 'Flexible' && ㅣ계) return [_recompose(11, mid, fin)];  // ㄴ→ㅇ
  return [];
}

// actual_char이 expected_char의 두음법칙 허용 범위인지
function dueum_check(expected_char, actual_char, dueum_mode){
  return get_valid_start_chars(expected_char, dueum_mode).includes(actual_char);
}

// char 기준 시작 가능한 모든 글자 목록 (자기 자신 + 두음 변환형)
function get_valid_start_chars(char, dueum_mode){
  return [char, ...get_dueum_variants(char, dueum_mode)];
}

// 다음 사람이 이어야 할 글자 — 끝말잇기면 끝 글자, 앞말잇기(rev)면 첫 글자
function 이을글자(word, rev){
  return rev ? word[0] : word[word.length - 1];
}

// 13층부터 걸리는 3글자 족쇄 — 그 층의 최소 단어 길이(0 = 제한 없음)
function 족쇄_최소길이(stage){
  return stage >= 13 ? 3 : 0;
}

// 단어의 초성 추출 (비한글 문자는 그대로 통과 — 원본 동일)
function extract_chosung(word){
  let result = '';
  for(const ch of word){
    const ini = _decompose(ch)[0];
    result += ini === -1 ? ch : _INITIALS[ini];
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
  // 2026-07-29: 기본 사전이 DICTIONARY(280) → 추가사전(보조, 기본 비어 있음)으로 바뀌었다.
  // 실질적으로 호출부는 거의 항상 dictionary_source를 넘긴다(우리말샘 후보 풀).
  // 인자를 생략하면 보조 사전만 보게 되는데, 이는 "온라인을 못 쓰는 상황"과 같은 의미다.
  const current_dict = (dictionary_source !== null && dictionary_source !== undefined)
    ? dictionary_source : 추가사전;
  const used_set = new Set(used);   // 원본은 리스트 in 검사 — 의미 동일, 성능만 개선
  // 정방향은 첫 글자가 start_char(+두음 변환형), 앞말잇기는 끝 글자가 start_char(두음 없음)
  const 맞는글자 = !reverse ? get_valid_start_chars(start_char, dueum_mode) : [start_char];

  for(const w of current_dict){
    if(used_set.has(w)) continue;
    if(length_filter > 0 && w.length !== length_filter) continue;
    if(min_length > 0 && w.length < min_length) continue;
    if(맞는글자.includes(!reverse ? w[0] : w[w.length - 1])) result.push(w);
  }
  return result;
}

// 한방 단어 판정 — 이 단어를 낸 뒤 상대가 이을 단어가 0개면 true.
// stage>=13: 3글자 족쇄가 걸린 층이므로 min_length=3 기준으로 판정 (원본 동일).
//
// ⚠️ 2026-07-27 추가: dictionary_source(6번째 인자).
// 종전에는 find_words에 사전을 안 넘겨 **항상 로컬 DICTIONARY(280개)만** 뒤졌다. 국어원 API를
// 켜고 나서 실제 플레이 공간은 우리말샘 전체가 됐는데 판정만 280단어 기준이라, 흔한 단어의
// 24~44%가 "한방 단어"로 오판됐다(실측: DICTIONARY가 이을 수 있는 시작 글자는 175종뿐).
// 그 오판이 즉시 패배·실수 누적으로 직결돼 관리자님이 "바로 패배해버림"을 제보한 원인이었다.
// 인자 기본값 null은 이제 "보조 사전(추가사전)"을 뜻한다. 파이썬 원본 대조는
// tests/fixtures/원본사전.cjs의 고정 벡터를 dictionary_source로 주입해 계속 수행한다.
function is_hanbang(word, used, reverse = false, dueum_mode = 'OFF', stage = 0,
                    dictionary_source = null){
  return find_words(이을글자(word, reverse), [...used, word], reverse, dueum_mode, 0,
                    족쇄_최소길이(stage), dictionary_source).length === 0;
}

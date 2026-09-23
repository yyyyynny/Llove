// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   v3.7 항목5: 이의있음! 유의어 변별 맥락 확장 (KNOWLEDGE 5섹션)
   - 컨텍스트 인자로 분기, 데모는 모달 텍스트만 변경
   - 실제 호출 위치는 기존 openObj 등 — 데모는 컨텍스트 전역값으로 단순화
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let 이의제기_컨텍스트 = 'general';  // 'general' | 'synonym' | 'speak'

function 이의제기_컨텍스트_설정(컨텍스트){
  이의제기_컨텍스트 = 컨텍스트;
  // 모달이 열린 상태에서 호출되면 안내 텍스트도 갱신
  const titleEl = document.querySelector('.obj-title');
  const subEl   = document.querySelector('.obj-sub');
  if(titleEl && subEl){
    if(컨텍스트 === 'synonym'){
      titleEl.textContent = '이의있음! (예문형)';
      subEl.textContent   = '"제가 고른 게 이 맥락에선 더 적절한 것 같은데요?" — AI가 맥락 기반으로 재판정합니다.';
    } else if(컨텍스트 === 'speak'){
      titleEl.textContent = '이의있음! (구어 교정)';
      subEl.textContent   = '교정안에 동의하지 않으시면 Grok 교차검증으로 재판정합니다.';
    } else {
      titleEl.textContent = '이의있음!';
      subEl.textContent   = '답변에 동의하지 않으시면 Grok 교차검증으로 재판정합니다.';
    }
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   빌드1: 질문하기 일일 100회 표시 폐기 (KNOWLEDGE 22)
   - 구 AI챗_이용량_갱신/질문하기_사용량_모달 제거 → 토큰표시_갱신/토큰차감안내_모달로 통합
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

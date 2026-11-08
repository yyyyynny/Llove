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
      subEl.textContent   = '고른 답이 이 문장에 더 맞는다면 이유를 적어 주세요. AI가 다시 판단해요.';
    } else if(컨텍스트 === 'speak'){
      titleEl.textContent = '이의있음! (구어 교정)';
      subEl.textContent   = '교정안이 틀렸다면 어디가 틀렸는지 알려 주세요. AI가 다시 확인해요.';
    } else {
      titleEl.textContent = '이의있음!';
      subEl.textContent   = '어디가 틀렸는지 알려 주세요. AI가 다시 확인해요.';
    }
  }
}

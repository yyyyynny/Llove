// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   v3.7 항목11,12: 「오늘 한 문장」 슬라이드 시스템
   - 프레임 개념(rAF/GSAP) 폐기, 시간 기반 setInterval만 사용
   - 6초 자동 순환, 카드 빈 곳 탭 → 즉시 다음 + 타이머 리셋
   - 문장 내 [단어] 표기 → .kc-word 스팬 + 단어 탭 시 해당 플래시카드로 이동(데모는 토스트)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let 슬라이드인덱스 = 0;
let 슬라이드타이머 = null;
const 슬라이드간격ms = 6000;

function 슬라이드빌드(){
  const wrap = document.getElementById('quoteSlides');
  const dots = document.getElementById('quoteDots');
  if(!wrap || !dots) return;

  // β8: 한문장풀 — 정령왕 JSON 7건 (로드 실패 시 폴백 6건)
  // 문장 내 [단어] → .kc-word 스팬으로 치환. 단어 탭은 카드 전체 onclick 전파 차단.
  wrap.innerHTML = 한문장풀.map((q, i)=>{
    const html = q.t.replace(/\[([^\]]+)\]/g, (m, w)=>
      `<span class="kc-word" onclick="event.stopPropagation();단어로이동('${w}')">${w}</span>`
    );
    return `<div class="kc-slide${i===0?' on':''}" data-i="${i}">
      <div class="kt">${html}</div>
      <div class="kt-author">${q.a}</div>
    </div>`;
  }).join('');

  dots.innerHTML = 한문장풀.map((_, i)=>
    `<div class="kc-dot${i===0?' on':''}" data-i="${i}"></div>`
  ).join('');

  슬라이드인덱스 = 0;
}

function 슬라이드전환(다음idx){
  const slides = document.querySelectorAll('#quoteSlides .kc-slide');
  const dotsAll = document.querySelectorAll('#quoteDots .kc-dot');
  if(slides.length === 0) return;
  slides.forEach((el, i)=> el.classList.toggle('on', i===다음idx));
  dotsAll.forEach((el, i)=> el.classList.toggle('on', i===다음idx));
  슬라이드인덱스 = 다음idx;
}

function 다음슬라이드(){
  if(한문장풀.length === 0) return;
  const next = (슬라이드인덱스 + 1) % 한문장풀.length;
  슬라이드전환(next);
}

function 슬라이드시작(){
  슬라이드정지();  // 중복 타이머 방지
  슬라이드타이머 = setInterval(다음슬라이드, 슬라이드간격ms);
}

function 슬라이드정지(){
  if(슬라이드타이머){ clearInterval(슬라이드타이머); 슬라이드타이머 = null; }
}

// v3.7 항목12: 카드 탭 → 즉시 다음 슬라이드 + 자동 타이머 리셋
function quoteNext(ev){
  // 단어 .kc-word 탭은 이미 stopPropagation으로 분리됨
  다음슬라이드();
  슬라이드시작();  // 타이머 리셋
}

// 문장 내 학습 단어 탭 처리 — 플래시카드 DB 구축 후 해당 카드로 직행 연결 예정
function 단어로이동(단어){
  showToastMsg(`「${단어}」 플래시카드 연결은 단어 DB 구축 후 제공됩니다`);
}

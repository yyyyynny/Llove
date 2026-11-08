// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   「오늘 한 문장」 — 날짜로 정한 한 문장을 보여 주고, 카드를 탭하면 다음 문장
   - 2026-11-07: 6초 자동 순환 폐지(읽는 중에 넘어가고 멈출 수단이 없었음 — WCAG 2.2.2),
     문장이 30개로 늘어 점 30개 대신 「n / 전체」 표시
   - 문장 내 [단어] 표기 → .kc-word 스팬
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let 슬라이드인덱스 = 0;

function 슬라이드빌드(){
  const wrap = document.getElementById('quoteSlides');
  const dots = document.getElementById('quoteDots');
  if(!wrap || !dots || !한문장풀.length) return;
  // 날짜(로컬 기준 일수)로 오늘의 문장을 정한다 — 같은 날엔 누구에게나 같은 문장
  const d = new Date();
  슬라이드인덱스 = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5) % 한문장풀.length;
  // 단어 탭은 카드 전체 onclick 전파 차단.
  wrap.innerHTML = 한문장풀.map((q, i)=>{
    const html = q.t.replace(/\[([^\]]+)\]/g, (m, w)=>
      `<span class="kc-word" onclick="event.stopPropagation();단어로이동('${w}')">${w}</span>`
    );
    return `<div class="kc-slide${i===슬라이드인덱스?' on':''}" data-i="${i}">
      <div class="kt">${html}</div>
      <div class="kt-author">${q.a}</div>
    </div>`;
  }).join('');
  슬라이드전환(슬라이드인덱스);
}

function 슬라이드전환(다음idx){
  const slides = document.querySelectorAll('#quoteSlides .kc-slide');
  if(slides.length === 0) return;
  slides.forEach((el, i)=> el.classList.toggle('on', i===다음idx));
  슬라이드인덱스 = 다음idx;
  const dots = document.getElementById('quoteDots');
  if(dots) dots.textContent = (다음idx + 1) + ' / ' + slides.length;
}

// 카드 탭 → 다음 문장
function quoteNext(ev){
  // 단어 .kc-word 탭은 이미 stopPropagation으로 분리됨
  if(한문장풀.length) 슬라이드전환((슬라이드인덱스 + 1) % 한문장풀.length);
}

// 문장 내 학습 단어 탭 처리 — 플래시카드 DB 구축 후 해당 카드로 직행 연결 예정
function 단어로이동(단어){
  showToastMsg(`「${단어}」 카드는 준비 중이에요`);
}

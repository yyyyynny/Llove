// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   빌드1 β10: 성장 상세 화면 sg 렌더 (KNOWLEDGE 17-1)
   - 현재 상태 요약 + 전체 EXP 진행 바 + 소칭호 로드맵 + 획득 방법 안내
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function 렌더_성장상세(){
  const body=document.getElementById('sgBody');
  if(!body) return;
  // 개발자 오버레이 표시 합성
  const 표시Lv=표시레벨(), 표시Exp=표시EXP(), 표시Max=expForLevel(표시Lv);
  const 칭호 = 소칭호계산(표시Lv, 사용자.창조주달성);
  const 등급 = 등급정보(표시Lv);  // 세션5 버그5: 현황 탭과 동일한 등급 표시 (강림자 등 불일치 해소)
  // Lv.1→70 총 필요 EXP 대비 현재 위치 (α3 보정 공식 합산)
  let 총필요=0, 누적=0;
  for(let l=1; l<최대레벨; l++){
    총필요 += expForLevel(l);
    if(l < 표시Lv) 누적 += expForLevel(l);
  }
  const 전체진행 = Math.min(100, ((누적 + 표시Exp) / 총필요) * 100);
  const 로드맵=[
    {t:'필멸자',  r:'Lv.1~15',  min:1},
    {t:'초월자',  r:'Lv.16~25', min:16},
    {t:'시련',    r:'Lv.26~35', min:26},
    {t:'하급신',  r:'Lv.36~46', min:36},
    {t:'중급신',  r:'Lv.47~57', min:47},
    {t:'최고신',  r:'Lv.58~68', min:58},
    {t:'주҉신҉',  r:'Lv.69~70', min:69},
    {t:'폐하',    r:'창조주 달성', min:Infinity}
  ];
  const 색상키 = t => (t==='주҉신҉') ? '주신' : t;
  body.innerHTML = `
    <div class="sg-sec fu">
      <div class="sg-sec-t">현재 상태</div>
      <div style="font-size:15px;font-weight:700">${userName} <span style="font-size:12px;color:${소칭호색상표[색상키(칭호)]||'var(--accl)'};text-shadow:0 1px 3px rgba(0,0,0,.38)">(${칭호})</span></div>
      <div style="font-size:12px;color:var(--txt);margin-top:4px">🏷️ 등급: <b>${등급.등급}</b>${등급.세부!==등급.등급?` · ${등급.세부}`:''}</div>
      <div style="font-size:12px;color:var(--txt2);margin-top:4px">Lv.${표시Lv} — EXP ${표시Exp} / ${표시Max} · 총누적 ${(사용자.총누적EXP||0).toLocaleString('ko-KR')}</div>
    </div>
    <div class="sg-sec fu s1">
      <div class="sg-sec-t">전체 성장 진행 (Lv.1 → 70)</div>
      <div class="exp-track"><div class="exp-fill" style="width:${전체진행.toFixed(1)}%"></div></div>
      <div style="font-size:10px;color:var(--txt2);margin-top:5px;text-align:right">${전체진행.toFixed(1)}%</div>
    </div>
    <div class="sg-sec fu s2">
      <div class="sg-sec-t">소칭호 로드맵</div>
      ${로드맵.map(it=>{
        const 달성 = (it.min===Infinity) ? !!사용자.창조주달성 : 표시Lv >= it.min;
        const 현재구간 = (칭호 === it.t);
        return `<div class="sg-road-item">
          <span style="color:${소칭호색상표[색상키(it.t)]||'#b4b4c4'};font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,.38)${현재구간?';text-decoration:underline':''}">(${it.t})</span>
          <span class="sg-road-range">${it.r}</span>
          <span class="sg-road-state" style="color:${달성?'var(--ok)':'var(--txtm)'}">${달성?'달성':'미달성'}</span>
        </div>`;
      }).join('')}
    </div>
    <div class="sg-sec fu s3">
      <div class="sg-sec-t">EXP 획득 방법</div>
      <div style="font-size:12px;color:var(--txt2);line-height:2">
        퀴즈 정답 +20 · 플래시카드 알았다 +20 / 헷갈린다 +8<br>
        퍼펙트 세션 +150 · 구어 교정 완료 +60 · 반박 성공 +100<br>
        [꾸준한 발걸음] 배율 ×1.01~×1.22 — 현재 ×${EXP배율(사용자.연속학습일||0)}
      </div>
    </div>`;
}

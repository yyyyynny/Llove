// Llove 재구조화 — 클래식 스크립트 분할(전역 스코프 공유).
// 로드 순서는 index.html의 <script src> 태그 순서를 따른다. 임의 재배열·모듈화 금지(초기 실행 의존).

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   '잇는' 포탈 — 이세계(끝말잇기 게임 차원, 코드네임 별바다) 진입 관문
   - 홈(#sh) 우측 상단 포탈 아이콘. 잠금 상태에선 탭 시 '잇' 회전 퍼즐이 열리고,
     퍼즐을 풀면 사용자.잇는개방=true 를 영구 저장(Firestore)한 뒤 wchain/으로 이동.
   - 개방 후엔 포탈 탭 시 바로 wchain/으로 이동.
   - 재잠금: 학습 데이터 초기화(js/레벨.js 리셋 객체), 다른 계정 로그인(다른 문서라 자연히),
     추후 wchain 내 게임 데이터 삭제(Phase 4)에서 잇는개방=false.
   ⚠️ 회전 애니메이션 예외: Llove 일반 학습 UI는 회전 금지(CLAUDE.md)지만, 이 퍼즐은
     '게임(wchain)의 관문'이라 게임 예외로 90° 회전을 허용한다(퍼즐의 본질). 일반 UI엔 미적용.
   ⚠️ 세계/포탈 표시 이름은 미정 → 임시 '잇는'. 확정 시 표시 문자열·필드명(잇는개방) 일괄 치환.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// 이세계 진입 경로 (같은 도메인 하위 폴더 — 로그인 자동 공유)
const 잇는_경로 = 'wchain/';

// 조각별 '정답으로 인정하는 각도'. ㅇ 좌/우 반링(모양 비대칭)=0°만, ㅣ·ㅅ 대칭 조각=0°·180°.
// (대칭 조각은 뒤집혀도 똑같이 보이므로 각도 함정 없이 '보이는 대로' 정답 처리)
const 잇는_정답각 = [[0],[0],[0,180],[0,180],[0,180],[0,180],[0,180]];
let 잇는_각도 = new Array(7).fill(0);   // 현재 7조각 회전각
let 잇는_풀림 = false;

const 잇는_norm = a => ((a % 360) + 360) % 360;

// 홈 포탈 아이콘 상태 갱신 (afterNav('sh')에서 호출)
function 잇는_포탈갱신(){
  const el = document.getElementById('잇는포탈');
  if(!el) return;
  el.classList.toggle('open', !!사용자.잇는개방);
  el.setAttribute('aria-label', 사용자.잇는개방 ? '잇는 세계로 이동' : '잇는 세계 — 잠김');
}

// 포탈 탭: 개방 상태면 바로 이동, 아니면 '잇' 퍼즐 열기
function 잇는_포탈탭(){
  if(사용자.잇는개방){ 잇는_이동(); return; }
  잇는_퍼즐열기();
}

function 잇는_이동(){
  location.href = 잇는_경로;
}

/* ── '잇' 회전 퍼즐 ── */
function 잇는_퍼즐열기(){
  const bg = document.getElementById('잇는퍼즐Bg');
  if(!bg) return;
  잇는_섞기();
  bg.classList.add('show');
}
function 잇는_퍼즐닫기(){
  document.getElementById('잇는퍼즐Bg')?.classList.remove('show');
}

function 잇는_렌더(){
  const shards = document.querySelectorAll('#잇는퍼즐Svg .shard');
  shards.forEach((s,i)=>{ s.style.transform = `rotate(${잇는_각도[i]}deg)`; });
}
function 잇는_판정됨(){
  return 잇는_각도.every((a,i)=> 잇는_정답각[i].includes(잇는_norm(a)));
}
function 잇는_섞기(){
  잇는_풀림 = false;
  document.getElementById('잇는퍼즐Stage')?.classList.remove('solved');
  const msg = document.getElementById('잇는퍼즐Msg');
  if(msg){ msg.textContent = '조각을 탭하면 90°씩 돌아갑니다.'; msg.classList.remove('done'); }
  do{ 잇는_각도 = Array.from({length:7}, ()=> 90*Math.floor(Math.random()*4)); }
  while(잇는_판정됨());   // 이미 풀린 채로 시작하지 않게
  잇는_렌더();
}
function 잇는_조각회전(i){
  if(잇는_풀림) return;
  잇는_각도[i] += 90;
  잇는_렌더();
  if(잇는_판정됨()) 잇는_완성();
}
function 잇는_완성(){
  잇는_풀림 = true;
  document.getElementById('잇는퍼즐Stage')?.classList.add('solved');
  const msg = document.getElementById('잇는퍼즐Msg');
  if(msg){ msg.textContent = '✦ 이어졌다 ✦'; msg.classList.add('done'); }
  // 영구 개방 저장 (런타임 + Firestore. 게스트는 사용자데이터_저장이 로컬만 반영)
  사용자.잇는개방 = true;
  사용자데이터_저장({잇는개방: true});
  잇는_포탈갱신();
  // 잠깐 여운 후 이세계로 이동
  setTimeout(()=>{ 잇는_퍼즐닫기(); 잇는_이동(); }, 1100);
}

// wchain '잇는' — 실제 페이지 플레이 회귀 테스트 (2026-07-27)
//
// wchain/index.html을 jsdom에 띄우고 실제 버튼·입력폼을 조작해, 관리자님 제보로 드러난
// 플레이 결함들이 재발하지 않는지 확인한다.
//   · 즉시 패배 철회 — 한방 단어를 내도 판이 끝나지 않고 실수 1회로 계산되는가
//   · 정답 반응 대사(react_correct)가 실제로 화면에 나오는가
//   · 매 턴 입력창 포커스가 유지되는가(2026-07-26 회귀)
//   · 리셋 중 진행 중이던 턴이 새 상태를 오염시키지 않는가
//   · 조회 중 힌트 버튼이 이유를 알려주는가
//
// 국어원 Worker는 fetch 스텁으로 대체한다(이 환경은 실제 Worker에 도달하지 못한다).

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const 루트 = path.join(__dirname, '..');
const WCHAIN = path.join(루트, 'wchain');

let 통과 = 0, 실패 = 0;
function 확인(이름, 조건, 비고 = ''){
  if(조건){ 통과++; console.log(`  ✓ ${이름}`); }
  else { 실패++; console.log(`  ✗ ${이름}${비고 ? ' — ' + 비고 : ''}`); }
}

// ── 페이지 띄우기 ────────────────────────────────────────────────────────
// CDN 스크립트(firebase)는 jsdom이 못 받으므로 제거하고, 로컬 js/*.js는 인라인으로 주입한다
// (load.cjs가 Llove에 쓰는 방식과 같은 접근 — 로드 순서는 index.html의 태그 순서 그대로).
function 페이지열기({ 온라인 = '정상' } = {}){
  let html = fs.readFileSync(path.join(WCHAIN, 'index.html'), 'utf8');
  const 순서 = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
  html = html.replace(/<script src="https:\/\/[^"]+"><\/script>/g, '');
  for(const src of 순서){
    const 코드 = fs.readFileSync(path.join(WCHAIN, src), 'utf8');
    html = html.replace(`<script src="${src}"></script>`,
                        `<script>${코드.replace(/<\/script>/g, '<\\/script>')}</script>`);
  }

  const 요청기록 = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://example.invalid/wchain/',
    pretendToBeVisual: true,
    beforeParse(win){
      win.fetch = async (url, opt) => {
        const payload = JSON.parse(opt.body);
        요청기록.push(payload);
        if(온라인 === '실패') throw new Error('네트워크 실패(스텁)');
        if(payload.단어 !== undefined){
          return { ok: true, json: async () => ({ 존재: true }) };
        }
        // 후보 목록 — 요청한 글자로 이을 수 있는 3글자 단어를 만들어 준다
        const 후보 = 온라인 === '없음' ? []
          : (payload.방향 === 'end' ? ['우리' + payload.글자] : [payload.글자 + '우리']);
        return { ok: true, json: async () => ({ 후보 }) };
      };
    }
  });
  const win = dom.window;
  return { dom, win, 요청기록 };
}

const 잠깐 = (ms = 0) => new Promise(r => setTimeout(r, ms));
// 클래식 스크립트의 최상위 const/let(gs·게임_비동기처리중 등)은 window의 속성이 되지 않는다
// (함수 선언만 속성이 된다) — 값이 필요하면 window 스코프에서 평가해 꺼낸다.
const 값 = (win, 식) => win.eval(식);
const 상태 = win => win.eval('gs');
const 로그텍스트 = win => [...win.document.querySelectorAll('#로그 .line')]
  .map(e => e.textContent).join('\n');

// 서바이벌 판을 시작한 상태까지 진행
function 판시작(win, 설정 = {}){
  win.선택_페르소나('Polite');
  win.선택_모드('SURVIVAL');
  Object.assign(상태(win), 설정);
  win.게임_시작();
}

// 단어를 넣고 비동기 턴이 끝날 때까지 기다린다
async function 단어넣기(win, 단어){
  win.document.getElementById('단어입력').value = 단어;
  win.단어_제출();
  for(let i = 0; i < 60 && 값(win, '게임_비동기처리중'); i++) await 잠깐(5);
  await 잠깐(5);
}

async function main(){
  console.log('\n━━━ wchain 실제 페이지 플레이 회귀 테스트 ━━━\n');

  /* ── 1. 즉시 패배 철회 (제보 ①②) ───────────────────────────────────── */
  console.log('[1] 즉시 패배 철회 — 한방 단어를 내도 판이 안 끝난다');
  {
    const { win } = 페이지열기({ 온라인: '없음' });   // 온라인으로도 이을 단어가 없음 = 진짜 한방
    판시작(win, { hanbang: false });                  // 한방 금지 모드를 일부러 선택
    await 단어넣기(win, '사슴');                       // 로컬 사전 단어, '슴'으로 이을 수 없음

    확인('게임오버 화면으로 넘어가지 않음',
         !win.document.getElementById('s-오버').classList.contains('active'),
         '즉시 패배가 아직 살아 있다');
    확인('실수 1회로 계산됨', 상태(win).strikes === 1, `strikes=${상태(win).strikes}`);
    확인('목숨은 그대로', 상태(win).hearts === 2, `hearts=${상태(win).hearts}`);
    확인('실수 안내가 화면에 나옴', 로그텍스트(win).includes('[실수 1/4]'));
  }

  /* ── 2. 정상 단어는 한방으로 막히지 않는다 ──────────────────────────── */
  console.log('\n[2] 정상 단어 통과 (제보 재현)');
  {
    const { win } = 페이지열기();
    판시작(win, { hanbang: false });
    await 단어넣기(win, '사랑');   // 로컬 기준으론 한방 오판 대상

    확인('실수가 매겨지지 않음', 상태(win).strikes === 0, `strikes=${상태(win).strikes}`);
    확인('턴이 진행됨', 상태(win).turn === 1, `turn=${상태(win).turn}`);
    확인('게임오버 아님', !win.document.getElementById('s-오버').classList.contains('active'));
  }

  /* ── 3. 정답 반응 대사 복원 (결함 ⑤) ────────────────────────────────── */
  console.log('\n[3] 정답 반응 대사');
  {
    const { win } = 페이지열기();
    판시작(win);
    await 단어넣기(win, '나무');
    const 로그 = 로그텍스트(win);
    const 반응들 = ['좋아요! 잘하고 계십니다!', '정답입니다! 훌륭해요!', '멋진 단어 선택이에요!'];
    확인('맞는 단어에 정답 반응이 출력됨', 반응들.some(r => 로그.includes(r)),
         '호출부가 여전히 빠져 있음');
  }

  /* ── 4. 매 턴 입력창 포커스 유지 (결함 ④ — 어제 커밋 회귀) ──────────── */
  console.log('\n[4] 입력창 포커스 유지');
  {
    const { win } = 페이지열기();
    판시작(win);
    const inp = win.document.getElementById('단어입력');
    await 단어넣기(win, '나무');
    확인('턴이 끝나면 입력창 잠금이 풀림', inp.disabled === false);
    확인('턴이 끝나면 포커스가 입력창에 있음', win.document.activeElement === inp,
         `현재 포커스: ${win.document.activeElement?.id || win.document.activeElement?.tagName}`);
    확인('전송 버튼도 복구됨',
         win.document.querySelector('#입력폼 button[type=submit]').textContent === '전송');
  }

  /* ── 5. 리셋 경합 (결함 ⑥) ──────────────────────────────────────────── */
  console.log('\n[5] 리셋 중 진행 턴이 새 상태를 오염시키지 않음');
  {
    const { win } = 페이지열기();
    판시작(win);
    // 온라인 조회가 필요한 단어를 넣어 비동기 창을 연 뒤, 기다리는 사이에 전체 리셋
    win.document.getElementById('단어입력').value = '사랑';
    win.단어_제출();
    win.전체리셋();
    for(let i = 0; i < 60; i++) await 잠깐(5);

    확인('리셋 후 페르소나 화면', win.document.getElementById('s-페르소나').classList.contains('active'));
    확인('버려진 턴이 history에 남지 않음', 상태(win).history.length === 0,
         `history=${JSON.stringify(상태(win).history)}`);
    확인('버려진 턴이 turn을 올리지 않음', 상태(win).turn === 0, `turn=${상태(win).turn}`);
    확인('리셋 후 새 입력을 받을 수 있음', 값(win, '게임_비동기처리중') === false);
  }

  /* ── 6. 조회 중 힌트 버튼 안내 (결함 ⑦) ─────────────────────────────── */
  console.log('\n[6] 처리 중 힌트 버튼 안내');
  {
    const { win } = 페이지열기();
    판시작(win);
    // 첫 턴은 "첫 단어는 자유롭게" 안내로 먼저 빠져나가므로, 한 턴 두고 2턴째에서 확인한다
    await 단어넣기(win, '나무');
    win.document.getElementById('단어입력').value = '사랑';
    win.단어_제출();            // 비동기 창 열림
    win.버튼_힌트();            // 그 사이 힌트 클릭
    await 잠깐(0);
    확인('조용히 무시하지 않고 이유를 알려줌',
         로그텍스트(win).includes('앞의 처리가 끝난 뒤에 다시 눌러 주세요'));
    for(let i = 0; i < 60 && 값(win, '게임_비동기처리중'); i++) await 잠깐(5);
  }

  /* ── 7. 문구·스타일 정합성 (결함 ⑩⑪⑫) ──────────────────────────────── */
  console.log('\n[7] 문구·스타일');
  {
    const { win } = 페이지열기();
    const html = fs.readFileSync(path.join(WCHAIN, 'index.html'), 'utf8');

    확인('설명서가 실수 1회 규칙을 안내',
         win.document.getElementById('설명Bg').textContent.includes('실수 1회로 계산됩니다'));
    확인('설명서에 "즉시 패배" 문구가 남아 있지 않음',
         !win.document.getElementById('설명Bg').textContent.includes('즉시 패배'));
    확인('낡은 주석(게이트 봉인) 제거', !html.includes('국어원_활성화=false 봉인'));
    확인('전송 버튼·입력창에 disabled 스타일 적용',
         html.includes('.input-row button:disabled') && html.includes('.input-row input:disabled'));

    // 설정 화면 설명도 새 규칙을 반영해야 한다
    win.선택_페르소나('Polite'); win.선택_모드('SURVIVAL');
    const 설정 = win.document.getElementById('설정-항목').textContent;
    확인('설정 화면 한방 모드 설명이 새 규칙과 일치',
         설정.includes('실수 1회로 계산됩니다') && !설정.includes('즉시 패배합니다'));
    확인('한방 모드 기본 선택이 "켜기"', [...win.document.querySelectorAll('#설정-항목 .set-row')]
         .find(r => r.textContent.includes('한방 모드'))
         ?.querySelector('.btn.acc')?.textContent === '켜기');
  }

  console.log(`\n━━━ 결과: ${통과} 통과 / ${실패} 실패 ━━━\n`);
  process.exit(실패 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

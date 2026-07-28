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
        // data/*.json은 디스크에서 그대로 읽어 준다 — 페르소나 대사(data/대사.json)가 실제 파일과
        // 맞물리는지까지 이 테스트로 검증된다(키 오타·JSON 깨짐이 여기서 잡힌다).
        if(typeof url === 'string' && url.startsWith('data/')){
          const 본문 = fs.readFileSync(path.join(WCHAIN, url), 'utf8');
          return { ok: true, json: async () => JSON.parse(본문) };
        }
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

// 대사(data/대사.json)는 비동기로 적재된다 — 판을 시작하기 전에 반드시 기다린다.
async function 대사대기(win){ await win.대사_로드(); }

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

    // 설정 화면(Llove 문법 이식 후): 한방 모드는 .mt 토글이며 기본 켜짐, srs가 상태 설명을 보여준다
    win.선택_페르소나('Polite'); win.선택_모드('SURVIVAL');
    const 한방행 = [...win.document.querySelectorAll('#설정-토글 .set-row')]
      .find(r => r.textContent.includes('한방 모드'));
    확인('한방 모드 토글이 기본 켜짐', 한방행?.querySelector('.mt input')?.checked === true);
    확인('켬 상태 설명이 새 규칙과 일치', 한방행?.textContent.includes('자유롭게 쓸 수 있습니다'));
    // 토글을 끄면 srs가 "실수 1회" 규칙 설명으로 바뀐다
    const 스위치 = 한방행.querySelector('.mt input');
    스위치.checked = false;
    스위치.dispatchEvent(new win.Event('change'));
    const 한방행2 = [...win.document.querySelectorAll('#설정-토글 .set-row')]
      .find(r => r.textContent.includes('한방 모드'));
    확인('끔 상태 설명이 실수 1회 규칙을 안내', 한방행2?.textContent.includes('실수 1회로 계산됩니다'));
    확인('토글 조작이 gs에 반영됨', 상태(win).hanbang === false);
  }

  /* ── 8. UI 구조 (2026-07-28 정돈) ──────────────────────────────────── */
  console.log('\n[8] UI 구조');
  {
    const { win } = 페이지열기();
    const d = win.document;

    // 진입 화면에서는 타이틀 블록이 온전히 보이고, 플레이 중에는 접힌다
    확인('진입 화면에서는 타이틀이 펼쳐짐', !d.body.classList.contains('playing'));
    판시작(win);
    확인('플레이 중에는 body.playing으로 타이틀을 접음', d.body.classList.contains('playing'));

    // 첫 턴 — 상대 단어가 없으므로 카드를 안내 한 줄로 접는다
    확인('첫 턴에는 상대 단어 카드가 접힘', d.querySelector('.ai-word').classList.contains('empty'));

    await 단어넣기(win, '나무');
    확인('상대가 단어를 내면 카드가 펼쳐짐',
         !d.querySelector('.ai-word').classList.contains('empty'));
    확인('상대 단어 라벨이 표시됨', d.getElementById('ai-라벨').textContent === '상대의 단어');
    확인('이어야 할 글자가 배지로 강조됨', !!d.querySelector('#prompt-안내 .need'));
    확인('배지 안에 실제 글자가 들어감',
         d.querySelector('#prompt-안내 .need').textContent === 상태(win).ai_last_char,
         `배지=${d.querySelector('#prompt-안내 .need')?.textContent} / 기대=${상태(win).ai_last_char}`);
    확인('끝말잇기는 "시작하는"으로 안내', d.getElementById('prompt-안내').textContent.includes('시작하는'));
    확인('내가 낸 단어에 me 클래스', !!d.querySelector('#로그 .line.me'));

    // HUD — 진행바가 HUD 밖으로 나가고 상태 배지는 턴 칸 안으로 들어갔다
    확인('HUD가 3칸', d.querySelectorAll('.hud .hud-item').length === 3);
    확인('진행바가 HUD 밖에 있음', !d.querySelector('.hud .bar-track') && !!d.querySelector('.bar-track'));
    확인('상태 배지가 턴 칸 안에 있음', !!d.querySelector('.hud .hud-item #hud-상태'));

    // 봉인 버튼은 시각적으로 강등
    확인('봉인 버튼에 locked 클래스', d.getElementById('btn-이의').classList.contains('locked')
         && d.getElementById('btn-허세').classList.contains('locked'));

    // 앞말잇기는 안내 문구가 뒤집힌다
    const { win: w2 } = 페이지열기();
    판시작(w2, { rev: true, dueum: 'OFF' });
    await 단어넣기(w2, '나무');
    확인('앞말잇기는 "끝나는"으로 안내',
         w2.document.getElementById('prompt-안내').textContent.includes('끝나는'));
  }

  /* ── 9. 설정 화면 — Llove 문법(set-sec/set-row/fs-opt/.mt) 이식 검증 ── */
  console.log('\n[9] 설정 화면 Llove 문법');
  {
    const { win } = 페이지열기();
    win.선택_페르소나('Polite'); win.선택_모드('SURVIVAL');
    const d = win.document;

    확인('섹션 3개(게임 규칙·특수 규칙·사전)가 set-sec로 놓임',
         d.querySelectorAll('#s-설정 .set-sec').length === 3);
    확인('섹션 라벨이 set-lbl · 첫 라벨에 모드 이름',
         [...d.querySelectorAll('#s-설정 .set-lbl')].map(e => e.textContent).join(',')
           === '서바이벌 · 게임 규칙,특수 규칙,사전');

    // 칩 항목: 난이도 4 / 진행 방향 2 / 두음법칙 3, 각 그룹에서 선택은 정확히 1개
    const 칩행 = [...d.querySelectorAll('#설정-규칙 .set-row')];
    확인('칩 항목 3개(난이도·방향·두음)', 칩행.length === 3);
    확인('칩 개수: 난이도 4 · 방향 2 · 두음 3',
         칩행.map(r => r.querySelectorAll('.fs-opt').length).join(',') === '4,2,3');
    확인('각 그룹에서 .on(선택)이 정확히 1개',
         칩행.every(r => r.querySelectorAll('.fs-opt.on').length === 1));
    확인('행 구조가 Llove(sri+srl+srs)', 칩행.every(r =>
         r.querySelector('.sri') && r.querySelector('.srl') && r.querySelector('.srs')));

    // 칩 실클릭 → gs 반영 + srs가 선택된 값의 설명으로 갱신
    const 심연칩 = [...d.querySelectorAll('#설정-규칙 .fs-opt')].find(c => c.textContent === '심연');
    심연칩.click();
    확인('칩 클릭이 gs에 반영됨(난이도 심연)', 상태(win).diff === '심연');
    const 난이도행 = [...d.querySelectorAll('#설정-규칙 .set-row')][0];
    확인('srs가 선택 값 설명으로 갱신됨', 난이도행.textContent.includes('160턴'));

    // 토글 항목 3개(.mt 스위치), 사전 행은 잠금(🔒) 표시
    확인('토글 항목 3개(한방·무한·구)', d.querySelectorAll('#설정-토글 .mt input').length === 3);
    확인('사전 행은 잠금 표시', d.getElementById('설정-사전').textContent.includes('🔒'));
  }

  /* ── 10. 네비게이션·모드 (2026-07-29 제보 1·2·7) ─────────────────── */
  console.log('\n[10] 뒤로가기 · 아케이드 설정 · 모드 이름');
  {
    const { win } = 페이지열기();
    const d = win.document;
    const 활성 = () => [...d.querySelectorAll('.screen.active')].map(e => e.id).join();

    // 1번 — 뒤로가기
    win.선택_페르소나('Polite');
    확인('페르소나 선택 후 모드 화면', 활성() === 's-모드');
    win.뒤로_페르소나();
    확인('모드 → 페르소나로 되돌아감', 활성() === 's-페르소나');
    win.선택_페르소나('Polite'); win.선택_모드('SURVIVAL');
    확인('모드 선택 후 설정 화면', 활성() === 's-설정');
    win.뒤로_모드();
    확인('설정 → 모드로 되돌아감', 활성() === 's-모드');

    // 2번 — 아케이드도 설정 화면을 거친다
    win.선택_모드('ARCADE');
    확인('아케이드도 설정 화면을 거침', 활성() === 's-설정');
    확인('아케이드 설정 제목', d.getElementById('설정-제목').textContent === '아케이드 · 게임 규칙');
    const 칩라벨 = [...d.querySelectorAll('#설정-규칙 .srl')].map(e => e.textContent);
    확인('아케이드에서는 난이도 항목이 숨겨짐', !칩라벨.includes('난이도'), 칩라벨.join(','));
    확인('아케이드에도 두음법칙·방향은 노출', 칩라벨.includes('두음법칙') && 칩라벨.includes('진행 방향'));
    const 토글라벨 = [...d.querySelectorAll('#설정-토글 .srl')].map(e => e.textContent);
    확인('아케이드에서는 무한 모드가 숨겨짐', !토글라벨.includes('무한 모드'), 토글라벨.join(','));
    const 한방행 = [...d.querySelectorAll('#설정-토글 .set-row')].find(r => r.textContent.includes('한방 모드'));
    확인('아케이드 한방 모드는 잠금(스위치 없음)',
         !한방행.querySelector('.mt input') && 한방행.textContent.includes('🔒'));
    확인('잠금 이유를 함께 표시', 한방행.textContent.includes('탑의 규칙'));

    // 7번 — 서바이벌에도 모드 이름이 뜬다
    win.게임_시작();
    확인('아케이드 요약에 모드 이름', d.getElementById('설정요약').textContent.includes('아케이드'));
    win.전체리셋(); win.선택_페르소나('Polite'); win.선택_모드('SURVIVAL'); win.게임_시작();
    확인('서바이벌 요약에도 모드 이름', d.getElementById('설정요약').textContent.includes('서바이벌'),
         d.getElementById('설정요약').textContent);
  }

  /* ── 11. reset_game의 stage 초기화 (뒤로가기로 새로 열린 경로) ────── */
  console.log('\n[11] 모드 전환 시 층 초기화');
  {
    const { win } = 페이지열기();
    win.선택_페르소나('Polite'); win.선택_모드('ARCADE'); win.게임_시작();
    상태(win).stage = 7;                       // 아케이드 7층까지 올라간 상태를 흉내
    win.버튼_리셋();                           // 전체 리셋 → 페르소나
    win.선택_페르소나('Polite'); win.선택_모드('SURVIVAL'); win.게임_시작();
    확인('서바이벌로 넘어오면 층이 1로 초기화', 상태(win).stage === 1, `stage=${상태(win).stage}`);

    // 뒤로가기 경로(리셋을 거치지 않음)도 같은지 — 이 경로가 이번에 새로 열렸다
    const { win: w2 } = 페이지열기();
    w2.선택_페르소나('Polite'); w2.선택_모드('ARCADE'); w2.게임_시작();
    상태(w2).stage = 9;
    w2.전체리셋(); w2.선택_페르소나('Polite'); w2.선택_모드('SURVIVAL');
    확인('모드 재선택만으로도 층이 1로 초기화', 상태(w2).stage === 1, `stage=${상태(w2).stage}`);
  }

  /* ── 12. 페르소나 대사 분리 (2026-07-29 제보 6) ───────────────────── */
  console.log('\n[12] 페르소나 대사 (data/대사.json)');
  {
    const 표 = JSON.parse(fs.readFileSync(path.join(WCHAIN, 'data/대사.json'), 'utf8'));
    const 키목록 = Object.keys(표);
    확인(`대사 ${키목록.length}건이 JSON에 있다`, 키목록.length >= 60);
    확인('모든 항목이 폭군·비서 두 문구를 갖춘다',
         키목록.every(k => 표[k].폭군 && 표[k].비서),
         키목록.filter(k => !표[k].폭군 || !표[k].비서).join(','));

    // 코드가 참조하는 키가 전부 JSON에 있는지 (오타·누락 방지)
    const 고정키 = new Set(), 조립접두 = new Set();
    for(const f of ['게임상태.js', '게임규칙.js', '서바이벌.js']){
      const src = fs.readFileSync(path.join(WCHAIN, 'js', f), 'utf8');
      for(const m of src.matchAll(/대사\(gs,\s*'([^']+)'(\s*\+)?/g)){
        if(m[2]) 조립접두.add(m[1]); else 고정키.add(m[1]);
      }
    }
    확인(`코드가 참조하는 키 ${고정키.size}개가 전부 JSON에 있다`,
         [...고정키].every(k => 표[k]), [...고정키].filter(k => !표[k]).join(','));
    확인('JSON에 죽은 키가 없다',
         키목록.every(k => 고정키.has(k) || [...조립접두].some(p => k.startsWith(p))),
         키목록.filter(k => !고정키.has(k) && ![...조립접두].some(p => k.startsWith(p))).join(','));

    // 로직 파일에는 대사 문자열이 남아 있지 않아야 한다(say 정의 한 곳만 예외)
    const say호출 = ['게임규칙.js', '서바이벌.js']
      .map(f => (fs.readFileSync(path.join(WCHAIN, 'js', f), 'utf8').match(/say\(gs,/g) || []).length)
      .reduce((a, b) => a + b, 0);
    확인('로직 파일에 인라인 say() 호출이 남아 있지 않다', say호출 === 0, `${say호출}건 남음`);

    // 실제 렌더링 — 페르소나에 따라 다른 문구가 나오고 자리표시자가 채워진다
    const { win } = 페이지열기();
    await 대사대기(win);
    const g = 상태(win);
    g.persona = 'Arrogant'; g.user_title = '필멸자';
    const 폭군문구 = win.대사(g, 'user_defeat_패배', { 칭호: win.title(g) });
    g.persona = 'Polite';
    const 비서문구 = win.대사(g, 'user_defeat_패배', { 칭호: win.title(g) });
    확인('페르소나별로 다른 문구가 나온다', 폭군문구 !== 비서문구);
    확인('이름 자리표시자가 채워진다', 폭군문구.includes('필멸자') && !폭군문구.includes('{칭호}'),
         폭군문구);

    g.persona = 'Arrogant';
    const 위치문구 = win.대사(g, 'user_defeat_3', [2]);   // `⚠️ [실수 {0}/4]` 계열
    확인('위치 자리표시자가 채워진다', !/\{\d\}/.test(위치문구), 위치문구);

    확인('없는 키는 조용히 비지 않고 표시된다',
         win.대사(g, '존재하지_않는_키').includes('대사 없음'));
  }

  /* ── 13. GOD MODE 관리자 패널 (2026-07-29 제보 8) ─────────────────── */
  console.log('\n[13] 관리자 패널');
  {
    const { win } = 페이지열기();
    await 대사대기(win);
    const d = win.document;
    판시작(win);

    확인('백도어 전에는 관리자 버튼이 숨겨져 있다',
         d.getElementById('btn-관리자').style.display === 'none');

    // 백도어 승인
    d.getElementById('단어입력').value = 'yyyyynny';
    win.단어_제출();
    확인('백도어 승인 후 관리자 버튼이 열린다',
         d.getElementById('btn-관리자').style.display !== 'none');
    확인('GOD MODE 진입 안내', 로그텍스트(win).includes('관리자'));

    // 1구역 — 턴 이동 (1~99)
    win.관리자_패널열기();
    확인('패널이 열린다', d.getElementById('관리자Bg').classList.contains('show'));
    d.getElementById('관리자-턴').value = '47';
    win.관리자_턴이동();
    확인('서바이벌에서 47턴으로 이동', 상태(win).turn === 47, `turn=${상태(win).turn}`);

    d.getElementById('관리자-턴').value = '150';           // 범위 밖
    win.관리자_턴이동();
    확인('1~99 밖은 거부되고 턴이 그대로', 상태(win).turn === 47);
    확인('거부 사유를 알려준다', 로그텍스트(win).includes('1~99 사이의 정수만'));

    // 2구역 — 다음 상대 단어 지정
    d.getElementById('관리자-단어').value = '나비';
    win.관리자_단어지정();
    확인('단어 예약이 기록된다', 값(win, '강제_AI단어') === '나비');
    d.getElementById('관리자-단어').value = 'apple';       // 한글 아님
    win.관리자_단어지정();
    확인('한글이 아니면 거부', 로그텍스트(win).includes('한글 단어만'));

    // 3구역 — 자원 조정
    win.관리자_자원('hearts', 3);
    확인('목숨을 3으로 설정', 상태(win).hearts === 3);
    상태(win).strikes = 2;
    win.관리자_실수초기화();
    확인('실수를 0으로 초기화', 상태(win).strikes === 0);

    // 예약한 단어가 실제 AI 턴에 쓰이는지 — '나비'는 '나'로 시작
    win.관리자_패널닫기();
    상태(win).ai_last_char = null;
    await 단어넣기(win, '가나');           // 끝 글자 '나' → 예약 '나비'가 이어진다
    확인('예약한 단어를 상대가 실제로 냈다', 상태(win).ai_last_word === '나비',
         `ai_last_word=${상태(win).ai_last_word}`);
    확인('예약은 1회만 쓰인다', 값(win, '강제_AI단어') === null);

    // 4구역 — 상태 강제
    const { win: w2 } = 페이지열기();
    await 대사대기(w2);
    판시작(w2);
    w2.갓모드_활성화();
    w2.관리자_강제('승리');
    확인('즉시 승리로 게임오버 화면 전환',
         w2.document.getElementById('s-오버').classList.contains('active'));
    확인('승리 표시(🏆)', w2.document.getElementById('오버-이모지').textContent === '🏆');
  }

  console.log(`\n━━━ 결과: ${통과} 통과 / ${실패} 실패 ━━━\n`);
  process.exit(실패 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

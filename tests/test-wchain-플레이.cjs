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
        // 후보 목록 — 실제 우리말샘은 글자당 10~수백 개를 준다. 하나만 주면 AI가 곧바로
        // 막혀(기권 = 사용자 승리) 테스트가 게임 흐름을 재현하지 못하므로, 서로 이어지는
        // 3글자 후보 여러 개를 준다(끝 글자가 다시 조회 가능한 글자가 되도록).
        const 꼬리 = ['가', '나', '다', '라', '마'];
        // '적음' = 지금 Worker가 실제로 보이는 상태(글자당 2~10개)를 재현한다
        const 쓸꼬리 = 온라인 === '적음' ? 꼬리.slice(0, 2) : 꼬리;
        const 후보 = 온라인 === '없음' ? []
          : 쓸꼬리.map(t => payload.방향 === 'end' ? t + '우' + payload.글자
                                                   : payload.글자 + '우' + t);
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
    // 2026-07-29 실수 폐지 — 틀리면 곧바로 목숨 -1(격동 기본 7 → 6)
    확인('목숨이 1개 깎인다', 상태(win).hearts === 6, `hearts=${상태(win).hearts}`);
    확인('목숨 감소 안내가 화면에 나옴', 로그텍스트(win).includes('[목숨 -1]'));
    확인('실수(strikes) 개념이 더는 쓰이지 않는다', 상태(win).strikes === 0);
    // 2026-08-15 신설 — 목숨이 줄면 HUD가 흔들려서 알린다(종전엔 다른 갱신과 똑같이 조용했음)
    확인('목숨 감소 시 HUD가 흔들린다(.hit)',
         win.document.getElementById('hud-목숨').classList.contains('hit'));
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

    확인('설명서가 목숨 규칙을 안내',
         win.document.getElementById('설명Bg').textContent.includes('목숨 1개가 깎입니다'));
    확인('설명서에 "즉시 패배"·"실수" 문구가 남아 있지 않음',
         !win.document.getElementById('설명Bg').textContent.includes('즉시 패배')
         && !win.document.getElementById('설명Bg').textContent.includes('실수 4회'));
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
    확인('끔 상태 설명이 목숨 규칙을 안내', 한방행2?.textContent.includes('목숨 1개가 깎입니다'));
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
    // 2026-08-15 신설 — 새 로그 줄이 fadeUp으로 들어온다(종전엔 즉시 나타나기만 했음)
    확인('로그 줄에 fu 진입 애니메이션', !!d.querySelector('#로그 .line.fu'));

    // HUD — 진행바가 HUD 밖으로 나가고 상태 배지는 턴 칸 안으로 들어갔다
    확인('HUD가 3칸', d.querySelectorAll('.hud .hud-item').length === 3);
    확인('진행바가 HUD 밖에 있음', !d.querySelector('.hud .bar-track') && !!d.querySelector('.bar-track'));
    확인('상태 배지가 턴 칸 안에 있음', !!d.querySelector('.hud .hud-item #hud-상태'));

    // 이의·허세 진행도 라벨(2026-08-19, 봉인 해제) — 아직 안 썼으면 (0/5)에 잠금 없음
    확인('이의 버튼에 진행도(0/5) 표시', d.getElementById('btn-이의').textContent.includes('(0/5)'));
    확인('허세 버튼도 같은 진행도(0/5) 표시', d.getElementById('btn-허세').textContent.includes('(0/5)'));
    확인('소진 전에는 locked 클래스가 없음', !d.getElementById('btn-이의').classList.contains('locked'));
    // 5회 다 쓰면(가상으로 상태만 채움) 라벨이 (5/5)로 바뀌고 잠금 스타일이 붙는다
    상태(win).dispute_attempts = 5;
    win.eval('프롬프트_갱신()');
    확인('소진 후 (5/5) 표시', d.getElementById('btn-이의').textContent.includes('(5/5)'));
    확인('소진 후 locked 클래스', d.getElementById('btn-이의').classList.contains('locked')
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

    확인('섹션 4개(게임 규칙·특수 규칙·화면·사전)가 set-sec로 놓임',
         d.querySelectorAll('#s-설정 .set-sec').length === 4);
    확인('섹션 라벨이 set-lbl · 첫 라벨에 모드 이름',
         [...d.querySelectorAll('#s-설정 .set-lbl')].map(e => e.textContent).join(',')
           === '서바이벌 · 게임 규칙,특수 규칙,화면,사전');

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
    // 대사_무작위로 뽑는 묶음(react_correct_1~3 등)은 페르소나마다 문구 수가 달라도 되고,
    // 모자란 칸은 ""로 비워 둔다(그 페르소나에서는 후보에서 빠짐). 따라서 "둘 다 채워져 있을 것"은
    // 무작위 묶음이 아닌 1:1 대사에만 적용하고, 묶음은 "양쪽 모두 최소 1줄"로 검사한다.
    const 무작위접두 = new Set();
    for(const f of ['게임상태.js', '게임규칙.js', '서바이벌.js']){
      const src = fs.readFileSync(path.join(WCHAIN, 'js', f), 'utf8');
      for(const m of src.matchAll(/대사_무작위\(gs,\s*'([^']+)'/g)) 무작위접두.add(m[1]);
    }
    const 무작위키 = k => [...무작위접두].some(p => new RegExp(`^${p}_\\d+$`).test(k));
    const 단일키목록 = 키목록.filter(k => !무작위키(k));
    확인('1:1 대사는 폭군·비서 두 문구를 갖춘다',
         단일키목록.every(k => 표[k].폭군 && 표[k].비서),
         단일키목록.filter(k => !표[k].폭군 || !표[k].비서).join(','));
    확인(`무작위 대사 묶음 ${무작위접두.size}종이 양쪽 페르소나에 최소 1줄씩 있다`,
         [...무작위접두].every(p => {
           const 묶음 = 키목록.filter(k => new RegExp(`^${p}_\\d+$`).test(k));
           return 묶음.some(k => 표[k].폭군) && 묶음.some(k => 표[k].비서);
         }), [...무작위접두].join(','));

    // 코드가 참조하는 키가 전부 JSON에 있는지 (오타·누락 방지)
    const 고정키 = new Set(), 조립접두 = new Set(무작위접두);
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

    // 상한 499 — 심연 목표가 160턴이라 99로는 닿지 않았다(관리자님 제보)
    d.getElementById('관리자-턴').value = '160';
    win.관리자_턴이동();
    확인('심연 목표(160턴)까지 이동 가능', 상태(win).turn === 160, `turn=${상태(win).turn}`);
    d.getElementById('관리자-턴').value = '500';           // 범위 밖
    win.관리자_턴이동();
    확인('1~499 밖은 거부되고 턴이 그대로', 상태(win).turn === 160);
    확인('거부 사유를 알려준다', 로그텍스트(win).includes('1~499 사이의 정수만'));

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
    win.관리자_자원('hints', 5);
    확인('힌트를 5로 설정', 상태(win).hints === 5);

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

  /* ── 14. Llove 테마 연동 토글 (2026-07-29 제보 3) ─────────────────── */
  console.log('\n[14] Llove 테마 연동');
  {
    const { win } = 페이지열기();
    const d = win.document;
    win.선택_페르소나('Polite'); win.선택_모드('SURVIVAL');

    // 기본은 꺼짐 — 잇는 고유 테마(관리자님: "기본적으로는 따로 구분을 할 수 있도록")
    확인('연동 기본값은 꺼짐', win.테마연동_켜짐() === false);
    확인('꺼진 상태에서는 data-theme가 없다(잇는 :root 기본)',
         !d.body.hasAttribute('data-theme'));
    const 화면행 = d.querySelector('#설정-화면 .set-row');
    확인('설정 화면에 연동 토글이 있다', !!화면행?.querySelector('.mt input'));
    확인('꺼짐 설명이 잇는 고유 테마를 안내', 화면행.textContent.includes('잇는 고유 테마'));

    // Llove가 저장해 둔 테마를 흉내 내고 연동을 켠다
    win.localStorage.setItem('plx_테마', 'forest');
    win.테마연동_설정(true);
    확인('연동을 켜면 Llove 테마가 적용된다', d.body.getAttribute('data-theme') === 'forest');
    확인('theme-color 메타도 따라간다',
         d.querySelector('meta[name="theme-color"]').getAttribute('content') === '#060c08');
    win.설정_렌더();
    확인('설명이 현재 Llove 테마를 알려준다',
         d.querySelector('#설정-화면 .set-row').textContent.includes('포레스트'));

    // 다시 끄면 잇는 고유 테마로 복귀
    win.테마연동_설정(false);
    확인('끄면 잇는 테마로 돌아온다', !d.body.hasAttribute('data-theme'));
    확인('theme-color도 복귀',
         d.querySelector('meta[name="theme-color"]').getAttribute('content') === '#0e1016');

    // Llove에서 테마를 고른 적이 없으면 연동해도 깨지지 않는다
    win.localStorage.removeItem('plx_테마');
    win.테마연동_설정(true);
    확인('Llove 테마가 없으면 잇는 기본으로 폴백', !d.body.hasAttribute('data-theme'));
    win.설정_렌더();
    확인('그 사실을 설명에 알려준다',
         d.querySelector('#설정-화면 .set-row').textContent.includes('아직 테마를 고른 적이 없어'));

    // 잇는에서 조작해도 Llove 설정(plx_테마)은 건드리지 않는다
    win.localStorage.setItem('plx_테마', 'navy');
    win.테마연동_설정(false);
    win.테마연동_설정(true);
    확인('연동 조작이 Llove의 plx_테마를 바꾸지 않는다',
         win.localStorage.getItem('plx_테마') === 'navy');
  }

  /* ── 15. 문구·레이아웃·삭제 (2026-07-29 제보 4·9·10) ──────────────── */
  console.log('\n[15] 우리말샘 문구 · 데스크탑 · 데이터 삭제');
  {
    const html = fs.readFileSync(path.join(WCHAIN, 'index.html'), 'utf8');
    const 서바 = fs.readFileSync(path.join(WCHAIN, 'js/서바이벌.js'), 'utf8');

    // 4번 — 실제 소스는 우리말샘 하나뿐인데 화면은 "국립국어원"이라고 말하고 있었다
    확인('조회 중 문구가 우리말샘', 서바.includes('우리말샘에서 찾아보는 중'));
    확인('사용자에게 보이는 문구에 "국립국어원 사전"이 남지 않음',
         !서바.includes('국립국어원 사전'));
    확인('설명서도 우리말샘', html.includes('우리말샘 사전으로 실제 확인합니다'));

    // 9번 — 데스크탑에서 세로·가로가 차야 한다
    확인('로그 높이 상한(420px)이 제거됨', !html.includes('max-height:min(50dvh, 420px)'));
    확인('넓은 화면용 미디어 쿼리가 있다', /@media \(min-width:760px\)/.test(html));
    확인('넓은 화면에서 폭이 넓어진다', /max-width:640px/.test(html));

    // 10번 — 삭제가 로컬 흔적까지 지우고, 온보딩을 건너뛴 홈으로 보낸다
    const 연동 = fs.readFileSync(path.join(WCHAIN, 'js/연동.js'), 'utf8');
    확인('삭제가 잇는 로컬 캐시도 지운다', 연동.includes('잇는_로컬삭제'));
    확인('캐시 키 3종을 지운다',
         연동.includes('plx_잇는_국어원캐시_v2') && 연동.includes('plx_잇는_국어원후보캐시_v2')
         && 연동.includes('plx_잇는_테마연동'));
    // 버전 접미사를 올릴 때마다 목록을 늘리는 대신 접두사로 쓸어 담는다 — 구버전 키가 남지 않게
    확인('plx_잇는_ 접두사 키를 전부 쓸어 담는다',
         연동.includes('잇는_로컬접두') && 연동.includes('startsWith(잇는_로컬접두)'));
    확인('온보딩을 건너뛴 홈으로 보낸다', 연동.includes("'../Llove/#home'"));
    // 삭제 버튼은 페르소나 화면에 있어 로그창이 안 보인다 — 안내는 모달이어야 읽힌다
    확인('비로그인 안내가 로그가 아니라 모달로 뜬다',
         연동.includes('서버(계정) 기록에는 손대지 않았습니다')
         && /게임데이터_확인모달\('ℹ️ 이 기기의 기록만/.test(연동));

    // 실제 삭제 동작 — 캐시가 비워지는지
    const { win } = 페이지열기();
    win.localStorage.setItem('plx_잇는_국어원캐시_v2', '{"가":true}');
    win.localStorage.setItem('plx_잇는_국어원후보캐시', '{"start:가":[]}');
    win.localStorage.setItem('plx_테마', 'navy');          // Llove 것 — 건드리면 안 된다
    win.잇는_로컬삭제();
    확인('삭제 후 잇는 캐시가 비워진다',
         !win.localStorage.getItem('plx_잇는_국어원캐시_v2')
         && !win.localStorage.getItem('plx_잇는_국어원후보캐시'));
    확인('Llove의 localStorage는 건드리지 않는다',
         win.localStorage.getItem('plx_테마') === 'navy');

    // 10번 — Llove 쪽 온보딩 버그(Firestore 실패 시 영영 안 걷힘)
    const fb = fs.readFileSync(path.join(루트, 'Llove/js/firebase.js'), 'utf8');
    확인('Llove 온보딩 걷기가 한 함수로 모임', fb.includes('function 온보딩_걷기()'));
    확인('Firestore 실패 경로에서도 온보딩을 걷는다',
         /\.catch\(e=>\{[\s\S]*?온보딩_걷기\(\)/.test(fb));
    확인('실패해도 홈으로 보낸다', /\.catch\(e=>\{[\s\S]*?goNav\('sh'/.test(fb));
  }

  /* ── 16. 마일스톤 제안이 AI 턴을 건너뛰지 않는다 (실사용 결함) ────── */
  console.log('\n[16] 50턴 딜 · 목표 달성 시 상대가 턴을 건너뛰지 않는다');
  {
    const { win } = 페이지열기();
    await 대사대기(win);
    판시작(win, { diff: '안온' });      // 목표 50턴
    const g = 상태(win);

    // 49턴까지 진행한 것처럼 두고 한 수를 둔다 → 50턴 도달
    await 단어넣기(win, '나무');
    const 이전상대단어 = g.ai_last_word;
    g.turn = 49;
    // 지금 이을 수 있는 실제 단어를 엔진에서 골라 넣는다(아무 단어나 넣으면 실수로 처리된다)
    // 사전이 폐지돼 find_words 기본 사전은 비어 있다 — AI가 쓰는 풀(우리말샘+세션)을 넘겨야 한다.
    const 풀 = win.ai_후보사전(g, await win.온라인후보_가져오기(g));
    const 이을단어 = win.find_words(g.ai_last_char, win.used_words(g), g.rev, g.dueum, 0, 0, 풀)[0];
    확인('테스트가 이을 수 있는 단어를 찾았다', !!이을단어, `ai_last_char=${g.ai_last_char}`);
    await 단어넣기(win, 이을단어);

    const 대기 = ['DEAL_WAIT', 'SURVIVAL_VICTORY_WAIT'].includes(g.game_state);
    확인('목표 턴에 도달하면 제안이 뜬다', 대기, `game_state=${g.game_state}`);
    확인('제안 전에 상대가 자기 턴을 마쳤다', g.ai_last_word !== 이전상대단어,
         `ai_last_word가 ${g.ai_last_word}로 그대로 — 상대가 턴을 건너뜀`);
    확인('이어야 할 글자가 상대의 새 단어 기준으로 갱신됨',
         g.ai_last_char === (g.rev ? g.ai_last_word[0] : g.ai_last_word[g.ai_last_word.length - 1]));

    // '계속'을 고르면 무한 모드로 그대로 이어진다
    win.생존승리_응답(true);
    확인('계속을 고르면 무한 모드로 진행', g.infinite === true && g.game_state === 'PLAYING');
    확인('계속 후에도 이어야 할 글자가 유지됨', g.ai_last_char !== null);
  }

  /* ── 17. 우리말샘 붙임표(-) 폴백 (2026-07-29 제보 2) ──────────────── */
  console.log('\n[17] 합성어 붙임표 폴백');
  {
    // 실측: 우리말샘 표제어는 합성어에 붙임표가 들어간다(가마솥 → `가마-솥`).
    // Worker가 붙임표를 지우지 않고 정확 비교해서 합성어가 전부 "사전에 없는 단어"가 됐다.
    // 그 상황을 그대로 흉내 내는 스텁: 붙임표가 든 형태만 존재한다고 답한다.
    let html = fs.readFileSync(path.join(WCHAIN, 'index.html'), 'utf8');
    const 순서 = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
    html = html.replace(/<script src="https:\/\/[^"]+"><\/script>/g, '');
    for(const src of 순서){
      html = html.replace(`<script src="${src}"></script>`,
        `<script>${fs.readFileSync(path.join(WCHAIN, src), 'utf8').replace(/<\/script>/g, '<\\/script>')}</script>`);
    }
    const 물어본단어 = [];
    const dom = new JSDOM(html, {
      runScripts: 'dangerously', url: 'https://example.invalid/wchain/', pretendToBeVisual: true,
      beforeParse(w){
        w.fetch = async (url, opt) => {
          if(typeof url === 'string' && url.startsWith('data/')){
            return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(WCHAIN, url), 'utf8')) };
          }
          const p = JSON.parse(opt.body);
          if(p.단어 !== undefined){
            물어본단어.push(p.단어);
            // 우리말샘 실제 표제어와 같은 집합 — 붙여 쓴 형태는 없다
            const 등재 = ['가마-솥', '뽕-나무', '눈-사람'];
            return { ok: true, json: async () => ({ 존재: 등재.includes(p.단어) }) };
          }
          return { ok: true, json: async () => ({ 후보: [] }) };
        };
      }
    });
    const w = dom.window;

    확인('붙여 쓴 형태로는 못 찾는다(제보 상황 재현)',
         (await w.국어원_POST({ 단어: '가마솥' }, 1000)).존재 === false);
    확인('붙임표를 끼워 재시도해 찾아낸다', (await w.국어원_단어조회('가마솥')) === true);
    확인('실제로 붙임표 변형을 물어봤다', 물어본단어.includes('가마-솥'), 물어본단어.join(','));
    확인('뽕나무도 통과', (await w.국어원_단어조회('뽕나무')) === true);
    확인('눈사람도 통과', (await w.국어원_단어조회('눈사람')) === true);
    확인('진짜 없는 단어는 그대로 없음', (await w.국어원_단어조회('없는말말')) === false);

    // 변형 생성 규칙
    확인('2~6글자 한글만 변형을 만든다',
         w.붙임표_변형('가마솥').length === 2 && w.붙임표_변형('가').length === 0
         && w.붙임표_변형('두 단어').length === 0);
    확인('변형은 가능한 모든 위치',
         w.붙임표_변형('가마솥').join(',') === '가-마솥,가마-솥');
  }

  /* ── 18. Llove 복귀 시 온보딩 (제보 1) ───────────────────────────── */
  console.log('\n[18] 학습 세계 복귀');
  {
    const html = fs.readFileSync(path.join(WCHAIN, 'index.html'), 'utf8');
    확인('돌아가기 링크가 온보딩을 건너뛴 홈으로 간다',
         html.includes('href="../Llove/#home"'));
    const 연동 = fs.readFileSync(path.join(WCHAIN, 'js/연동.js'), 'utf8');
    확인('데이터 삭제도 같은 목적지', 연동.includes("'../Llove/#home'"));

    const fb = fs.readFileSync(path.join(루트, 'Llove/js/firebase.js'), 'utf8');
    확인('Llove가 #home 해시를 보면 즉시 온보딩을 걷는다',
         /location\.hash === '#home'[\s\S]{0,120}온보딩_걷기\(\)/.test(fb));
    확인('해시는 1회용으로 지운다', fb.includes('history.replaceState'));
    확인('DB 미초기화 경로에서도 온보딩을 걷는다',
         /db 미초기화[\s\S]{0,120}온보딩_걷기\(\)/.test(fb));
  }

  /* ── 19. 실수 폐지 잔여 환산 · 후보 풀 확장 (2026-07-29 2차 점검) ─── */
  console.log('\n[19] 목숨 환산 잔여분 · 후보 풀 · 캐시');
  {
    const { win } = 페이지열기();
    await 대사대기(win);

    // (1) 실수 폐지 때 난이도표만 4배로 올리고 빠뜨린 상수들 — 아케이드 시작·계약 보상·14층
    win.선택_페르소나('Polite'); win.선택_모드('ARCADE'); win.게임_시작();
    const 아케목숨 = 값(win, '아케이드_목숨');
    확인('아케이드 시작 목숨이 환산값(2×4)', 상태(win).hearts === 아케목숨 && 아케목숨 === 8,
         `hearts=${상태(win).hearts}`);

    상태(win).hearts = 5;
    win.시련_응답(2);                                   // 생명의 계약 — 원본 +1
    확인('생명의 계약 보상도 환산(+4)', 상태(win).hearts === 5 + 값(win, '목숨보상'),
         `hearts=${상태(win).hearts}`);

    상태(win).hearts = 5;
    win.시련_응답(3);                                   // 어둠의 계약 — 원본 +1
    확인('어둠의 계약 보상도 환산(+4)', 상태(win).hearts === 5 + 값(win, '목숨보상'));

    상태(win).stage = 13;
    win.탑승리_응답(true);                              // 14층 무한 등반 진입
    확인('14층 진입 목숨이 아케이드 시작값과 같다', 상태(win).hearts === 아케목숨,
         `hearts=${상태(win).hearts}`);

    // (2) 모드를 바꿔 재시작해도 시련의 탑 진입 횟수가 남지 않는다
    상태(win).trial_tower_entries = 3;
    win.전체리셋(); win.선택_페르소나('Polite'); win.선택_모드('SURVIVAL'); win.게임_시작();
    확인('시련의 탑 진입 횟수가 초기화된다', 상태(win).trial_tower_entries === 0);
    확인('전체리셋이 세션 수집어도 비운다', 값(win, '세션_수집어').length === 0);
  }
  {
    // (3) 두음법칙 변형 글자까지 후보를 물어본다 — 종전엔 한 글자만 물어 후보가 좁았고,
    //     한방 판정(변형까지 확인)과 기준이 어긋나 있었다.
    const { win, 요청기록 } = 페이지열기();
    await 대사대기(win);
    판시작(win, { dueum: 'Flexible' });
    await 단어넣기(win, '가락');                        // '락' → 두음 변형 '낙'
    const 글자요청 = 요청기록.filter(r => r.글자 !== undefined).map(r => r.글자);
    확인('원래 글자를 물어본다', 글자요청.includes('락'), 글자요청.join(','));
    확인('두음 변형 글자도 함께 물어본다', 글자요청.includes('낙'), 글자요청.join(','));

    const { win: w2, 요청기록: 기록2 } = 페이지열기();
    await 대사대기(w2);
    판시작(w2, { dueum: 'OFF' });
    await 단어넣기(w2, '가락');
    const 글자2 = 기록2.filter(r => r.글자 !== undefined).map(r => r.글자);
    확인('두음 OFF면 변형을 묻지 않는다', !글자2.includes('낙'), 글자2.join(','));
  }
  {
    // (4) 후보 캐시 — 버전 접미사가 붙고, 빈 목록은 저장하지 않는다.
    //     빈 목록이 영구히 박히면 Worker를 고쳐도 그 기기에서는 계속 막다른 길이 된다.
    const 국어원 = fs.readFileSync(path.join(WCHAIN, 'js/국어원.js'), 'utf8');
    확인('후보 캐시 키에 버전이 붙었다', 국어원.includes("'plx_잇는_국어원후보캐시_v3'"));

    const { win } = 페이지열기({ 온라인: '없음' });     // 후보 0건을 돌려주는 스텁
    await 대사대기(win);
    판시작(win);
    await 단어넣기(win, '사슴');
    const 캐시 = JSON.parse(win.localStorage.getItem('plx_잇는_국어원후보캐시_v3') || '{}');
    확인('빈 후보 목록은 캐시에 남지 않는다', Object.keys(캐시).length === 0,
         JSON.stringify(캐시));
  }

  /* ── 20. 후보 부족 안내 · 힌트 낭비 호출 · 값 이중 관리 (2026-07-29 3차) ── */
  console.log('\n[20] 막다른 길 안내 · 힌트 조회 순서 · 설명 문구 동기화');
  {
    // (1) 후보가 3개 이하면 "곧 막힐 수 있습니다" 경고로 바뀐다
    const { win } = 페이지열기({ 온라인: '적음' });
    await 대사대기(win);
    판시작(win);
    await 단어넣기(win, '사슴');
    const 로그 = 로그텍스트(win);
    확인('후보가 적으면 곧 막힌다고 경고한다', 로그.includes('곧 막힐 수 있습니다'),
         로그.split('\n').filter(l => l.includes('우리말샘 후보')).join(' | '));

    const { win: w2 } = 페이지열기();          // 후보 5개 = 넉넉
    await 대사대기(w2);
    판시작(w2);
    await 단어넣기(w2, '사슴');
    확인('후보가 넉넉하면 경고하지 않는다', !로그텍스트(w2).includes('곧 막힐 수 있습니다'));
  }
  {
    // (2) 막다른길_확인 — 이을 단어를 못 찾으면 미리 알리고, 있으면 조용하다
    const { win } = 페이지열기({ 온라인: '없음' });
    await 대사대기(win);
    판시작(win);
    상태(win).ai_last_char = '가';
    await win.막다른길_확인(값(win, '게임_세대'), '가');
    확인('이을 단어가 없으면 미리 알린다', 로그텍스트(win).includes('찾지 못했습니다'));
    확인('진 것이 아님을 함께 알린다', 로그텍스트(win).includes('그대로 입력해 보세요'));

    const { win: w2 } = 페이지열기();
    await 대사대기(w2);
    판시작(w2);
    상태(w2).ai_last_char = '가';
    await w2.막다른길_확인(값(w2, '게임_세대'), '가');
    확인('이을 단어가 있으면 조용하다', !로그텍스트(w2).includes('찾지 못했습니다'));

    // 되돌아왔을 때 판이 바뀌었으면 버린다(리셋 중 되살아나지 않게)
    const { win: w3 } = 페이지열기({ 온라인: '없음' });
    await 대사대기(w3);
    판시작(w3);
    상태(w3).ai_last_char = '가';
    await w3.막다른길_확인(값(w3, '게임_세대') - 1, '가');
    확인('세대가 다르면 안내를 버린다', !로그텍스트(w3).includes('찾지 못했습니다'));
  }
  {
    // (3) 힌트가 0이면 결과를 쓰지도 않을 온라인 조회를 하지 않는다(최대 6초 왕복 낭비)
    const { win, 요청기록 } = 페이지열기();
    await 대사대기(win);
    판시작(win, { diff: '격동' });
    await 단어넣기(win, '사슴');
    상태(win).hints = 0; 상태(win).deal_offered = false;
    const 이전 = 요청기록.filter(r => r.글자 !== undefined).length;
    win.버튼_힌트();
    for(let i = 0; i < 60 && 값(win, '게임_비동기처리중'); i++) await 잠깐(5);
    const 이후 = 요청기록.filter(r => r.글자 !== undefined).length;
    확인('힌트 소진 상태에서는 후보를 조회하지 않는다', 이후 === 이전, `${이전} → ${이후}`);
    확인('대신 악마의 거래가 열린다', 상태(win).game_state === 'DEVIL_WAIT',
         상태(win).game_state);
  }
  {
    // (4) 난이도 설명의 숫자가 난이도표와 어긋나지 않는다(종전엔 손으로 적어 둬 실제로 어긋났다)
    const { win } = 페이지열기();
    const 표 = 값(win, '난이도표');
    const 설명 = 값(win, "설정_항목.find(x => x.키 === 'diff').선택지");
    확인('난이도 칩 설명이 난이도표 값을 그대로 쓴다',
         설명.every(([키, , 문구]) =>
           문구.includes(`${표[키].턴}턴`) && 문구.includes(`목숨${표[키].목숨}`)
           && 문구.includes(`힌트${표[키].힌트}`)),
         설명.map(x => x[2]).join(' | '));

    // (5) 층 재시작 폐지로 호출부가 사라진 함수가 남아 있지 않다
    확인('arcade_restart_floor가 봉인됐다', typeof win.arcade_restart_floor === 'undefined');
    const 규칙 = fs.readFileSync(path.join(WCHAIN, 'js/게임규칙.js'), 'utf8');
    확인('봉인 근거가 주석으로 남아 있다', 규칙.includes('봉인 (2026-07-29) — 아케이드'));
  }

  /* ── 21. '이의 있음'·'그 단어 없어!' 재설계 (2026-08-19, 봉인 해제) ─── */
  console.log('\n[21] 이의 있음 재설계');
  {
    // (a) 사전에 실제로 없는 단어로 판정 → 즉시 취소되고 AI가 새 단어를 낸다
    const { win } = 페이지열기();
    await 대사대기(win);
    판시작(win);
    await 단어넣기(win, '나무');
    const g = 상태(win);
    const 가짜단어 = g.ai_last_word;
    // 취소 후 재출제는 gs.ai_last_char가 그대로("나무"만 history에 남으므로 다시 "무")라, 안
    // 지우면 아래 필터가 걸린 새 스텁을 우회해 가짜단어가 다시 뽑힐 수 있다 — 두 안전망 다:
    //   · localStorage 캐시(plx_잇는_국어원후보캐시_v3) — 예전(필터 안 된) 후보가 그대로 남음
    //   · 세션_수집어(게임규칙.js 모듈 스코프, "네트워크 끊겨도 이어지게" 하는 안전망) — 방금
    //     받은 후보가 전부 여기 쌓여서, localStorage를 지워도 이 목록엔 가짜단어가 남아 있다
    //     (실측: 두 캐시 중 세션_수집어만 지웠을 땐 60회 중 13회 재현되는 진짜 원인이었음).
    win.localStorage.clear();
    win.세션_비우기();
    win.fetch = async (url, opt) => {
      if(typeof url === 'string' && url.startsWith('data/')){
        return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(WCHAIN, url), 'utf8')) };
      }
      const p = JSON.parse(opt.body);
      if(p.단어 !== undefined) return { ok: true, json: async () => ({ 존재: false, 뜻풀이그룹: [] }) };
      const 꼬리 = ['가', '나', '다', '라', '마'];
      // 취소된 단어(가짜단어)는 후보에서 뺀다 — 방금 사전에 없다고 판정해 history에서 지운
      // 참이라 "이미 쓴 단어" 필터에도 안 걸려서, 안 빼면 AI가 우연히 같은 단어를 다시 뽑을 수
      // 있다(로컬에선 드물게 통과하고 CI에서만 걸리는 진짜 플레이키 원인이었음).
      const 후보 = 꼬리
        .map(t => p.방향 === 'end' ? t + '우' + p.글자 : p.글자 + '우' + t)
        .filter(w => w !== 가짜단어);
      return { ok: true, json: async () => ({ 후보 }) };
    };
    await win.버튼_이의();
    for(let i = 0; i < 60 && 값(win, '게임_비동기처리중'); i++) await 잠깐(5);
    확인('없는 단어로 판정되면 즉시 취소된다', g.history.every(h => h.word !== 가짜단어));
    확인('AI가 새 단어를 낸다', g.ai_last_word !== 가짜단어 && g.ai_last_word !== null,
         `ai_last_word=${g.ai_last_word}`);
    확인('취소 로그가 남는다', 로그텍스트(win).includes('취소'));
    확인('시도 횟수가 1로 기록됨', g.dispute_attempts === 1, `dispute_attempts=${g.dispute_attempts}`);
  }
  {
    // (b) 사전에 실제로 있는 단어 → 뜻풀이를 근거로 기각, AI 단어는 그대로 유지
    const { win } = 페이지열기();
    await 대사대기(win);
    판시작(win);
    await 단어넣기(win, '나무');
    const g = 상태(win);
    const 대상단어 = g.ai_last_word;
    win.fetch = async (url, opt) => {
      if(typeof url === 'string' && url.startsWith('data/')){
        return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(WCHAIN, url), 'utf8')) };
      }
      const p = JSON.parse(opt.body);
      if(p.단어 !== undefined){
        return { ok: true, json: async () => ({ 존재: true, 뜻풀이그룹: [{ 번호: 1, 뜻풀이: ['테스트용 뜻풀이입니다.'] }] }) };
      }
      return { ok: true, json: async () => ({ 후보: [] }) };
    };
    await win.버튼_이의();
    for(let i = 0; i < 60 && 값(win, '게임_비동기처리중'); i++) await 잠깐(5);
    확인('있는 단어면 기각되고 AI 단어가 유지된다', g.ai_last_word === 대상단어);
    확인('뜻풀이가 근거로 표시된다', 로그텍스트(win).includes('테스트용 뜻풀이입니다.'));
    확인('기각도 시도 횟수를 소모한다', g.dispute_attempts === 1, `dispute_attempts=${g.dispute_attempts}`);
  }
  {
    // (c) 확인 자체가 실패(네트워크) → 게임 상태 불변, 시도 횟수도 소모하지 않는다
    const { win } = 페이지열기();
    await 대사대기(win);
    판시작(win);
    await 단어넣기(win, '나무');
    const g = 상태(win);
    const 이전단어 = g.ai_last_word;
    win.fetch = async (url) => {
      if(typeof url === 'string' && url.startsWith('data/')){
        return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(WCHAIN, url), 'utf8')) };
      }
      throw new Error('네트워크 실패(스텁)');
    };
    await win.버튼_이의();
    for(let i = 0; i < 60 && 값(win, '게임_비동기처리중'); i++) await 잠깐(5);
    확인('확인 실패 시 게임 상태는 그대로', g.ai_last_word === 이전단어);
    확인('확인 실패는 시도 횟수를 소모하지 않는다', g.dispute_attempts === 0, `dispute_attempts=${g.dispute_attempts}`);
    확인('실패 안내 로그가 남는다', 로그텍스트(win).includes('확인에 실패'));
  }
  {
    // (d) 5회 다 쓰면 조회 자체를 하지 않고 소진 안내만 띄운다
    const { win } = 페이지열기();
    await 대사대기(win);
    판시작(win);
    await 단어넣기(win, '나무');
    const g = 상태(win);
    g.dispute_attempts = 5;
    let 호출됨 = false;
    win.fetch = async (url, opt) => {
      if(typeof url === 'string' && url.startsWith('data/')){
        return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(WCHAIN, url), 'utf8')) };
      }
      호출됨 = true;
      return { ok: true, json: async () => ({ 존재: true, 뜻풀이그룹: [] }) };
    };
    await win.버튼_이의();
    확인('소진되면 조회 자체를 하지 않는다', 호출됨 === false);
    확인('소진 안내 로그가 남는다',
         로그텍스트(win).includes('다 써버렸다') || 로그텍스트(win).includes('모두 사용'));
  }
  {
    // (e) '그 단어 없어!'는 '이의 있음'과 동일한 실조회를 탄다(더 이상 no-op이 아니다)
    const { win } = 페이지열기();
    확인('버튼_허세가 버튼_이의와 동일한 함수(더 이상 no-op이 아님)', 값(win, '버튼_허세 === 버튼_이의'));
  }

  /* ── 22. '뜻 보기' · '적절성 검증' 버튼 배선 (2026-08-22 신설) ─────────── */
  console.log('\n[22] 뜻 보기 · 적절성 검증 버튼 배선');
  {
    // (a) 뜻 보기 — 동음이의어 2그룹을 ①②로 나눠 로그에 찍고, 판정·소모가 전혀 없다
    const { win } = 페이지열기();
    await 대사대기(win);
    판시작(win);
    await 단어넣기(win, '나무');
    const g = 상태(win);
    const 대상단어 = g.ai_last_word;
    win.fetch = async (url, opt) => {
      if(typeof url === 'string' && url.startsWith('data/')){
        return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(WCHAIN, url), 'utf8')) };
      }
      const p = JSON.parse(opt.body);
      if(p.단어 !== undefined){
        return { ok: true, json: async () => ({ 존재: true, 뜻풀이그룹: [
          { 번호: 1, 뜻풀이: ['뜻 하나'] },
          { 번호: 2, 뜻풀이: ['뜻 둘', '뜻 둘의 다른 풀이'] },
        ] }) };
      }
      return { ok: true, json: async () => ({ 후보: [] }) };
    };
    await win.버튼_뜻보기();
    for(let i = 0; i < 60 && 값(win, '게임_비동기처리중'); i++) await 잠깐(5);
    const 로그 = 로그텍스트(win);
    확인('뜻 보기: ①②로 그룹이 나뉘어 표시된다', 로그.includes('① 뜻 하나') && 로그.includes('② 뜻 둘'));
    확인('뜻 보기: AI 단어는 그대로 유지(취소 아님)', g.ai_last_word === 대상단어);
    확인('뜻 보기: 이의 시도 횟수를 전혀 소모하지 않는다', g.dispute_attempts === 0,
         `dispute_attempts=${g.dispute_attempts}`);
  }
  {
    // (b) 뜻 보기 — 조회 실패(네트워크) 시 경고만 뜨고 상태는 그대로
    const { win } = 페이지열기();
    await 대사대기(win);
    판시작(win);
    await 단어넣기(win, '나무');
    const g = 상태(win);
    const 대상단어 = g.ai_last_word;
    win.fetch = async (url) => {
      if(typeof url === 'string' && url.startsWith('data/')){
        return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(WCHAIN, url), 'utf8')) };
      }
      throw new Error('네트워크 실패(스텁)');
    };
    await win.버튼_뜻보기();
    for(let i = 0; i < 60 && 값(win, '게임_비동기처리중'); i++) await 잠깐(5);
    확인('뜻 보기: 네트워크 실패는 네트워크 원인으로 안내한다',
         로그텍스트(win).includes('불러오지 못했습니다') && 로그텍스트(win).includes('네트워크'));
    확인('뜻 보기: 실패해도 AI 단어는 그대로', g.ai_last_word === 대상단어);
  }
  {
    // (c) 적절성 검증 — 게이트가 꺼져 있는 실제 상태에서는 네트워크를 아예 안 타고
    //     '준비 중' 안내만 뜨며, 시도 횟수를 소모하지 않는다.
    const { win, 요청기록 } = 페이지열기();
    await 대사대기(win);
    판시작(win);
    await 단어넣기(win, '나무');
    const g = 상태(win);
    const 요청수_이전 = 요청기록.length;
    확인('적절성검증_활성화 플래그가 false다(승인 전 기본값)', 값(win, '적절성검증_활성화') === false);
    await win.버튼_적절성검증();
    확인('적절성 검증: 게이트 꺼진 상태에서 네트워크를 타지 않는다', 요청기록.length === 요청수_이전);
    확인('적절성 검증: 준비 중 안내가 뜬다', 로그텍스트(win).includes('그록 연동 후 사용 가능'));
    확인('적절성 검증: 이의 시도 횟수를 소모하지 않는다', g.dispute_attempts === 0,
         `dispute_attempts=${g.dispute_attempts}`);
  }
  {
    // (d) 두 버튼 모두 AI 단어가 나오기 전엔 숨겨져 있다가, 나온 뒤 노출된다
    const { win } = 페이지열기();
    await 대사대기(win);
    판시작(win);
    확인('첫 턴(AI 단어 없음)엔 뜻보기 버튼이 숨겨져 있다',
         win.document.getElementById('btn-뜻보기').style.display === 'none');
    확인('첫 턴(AI 단어 없음)엔 적절성검증 버튼이 숨겨져 있다',
         win.document.getElementById('btn-적절성검증').style.display === 'none');
    await 단어넣기(win, '나무');
    확인('AI가 단어를 낸 뒤엔 뜻보기 버튼이 보인다',
         win.document.getElementById('btn-뜻보기').style.display === '');
    const 적절성btn = win.document.getElementById('btn-적절성검증');
    확인('AI가 단어를 낸 뒤엔 적절성검증 버튼이 보인다', 적절성btn.style.display === '');
    확인('적절성검증 버튼은 게이트가 꺼져 있는 동안 잠금 표시(🔒)를 보여준다',
         적절성btn.textContent.includes('🔒') && 적절성btn.classList.contains('locked'));
  }

  {
    // (b-2) 뜻 보기 — 사전에 없는 단어면 네트워크 탓으로 뭉뚱그리지 않고, 이의 있음을 안내한다
    const { win } = 페이지열기();
    await 대사대기(win);
    판시작(win);
    await 단어넣기(win, '나무');
    const g = 상태(win);
    win.localStorage.clear();
    win.fetch = async (url, opt) => {
      if(typeof url === 'string' && url.startsWith('data/')){
        return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(WCHAIN, url), 'utf8')) };
      }
      const p = JSON.parse(opt.body);
      if(p.단어 !== undefined) return { ok: true, json: async () => ({ 존재: false, 뜻풀이그룹: [] }) };
      return { ok: true, json: async () => ({ 후보: [] }) };
    };
    await win.버튼_뜻보기();
    for(let i = 0; i < 60 && 값(win, '게임_비동기처리중'); i++) await 잠깐(5);
    const 로그b = 로그텍스트(win);
    확인('뜻 보기: 사전에 없으면 그 사실을 알린다', 로그b.includes('없는 단어입니다'));
    확인('뜻 보기: 없는 단어일 때 이의 있음을 안내한다', 로그b.includes('이의 있음'));
    확인('뜻 보기: 없는 단어여도 시도 횟수를 소모하지 않는다', g.dispute_attempts === 0);
  }
  {
    // (b-3) 뜻 보기 — 존재하나 뜻풀이가 비어 있으면 네트워크 탓으로 안내하지 않는다
    const { win } = 페이지열기();
    await 대사대기(win);
    판시작(win);
    await 단어넣기(win, '나무');
    win.localStorage.clear();
    win.fetch = async (url, opt) => {
      if(typeof url === 'string' && url.startsWith('data/')){
        return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(WCHAIN, url), 'utf8')) };
      }
      const p = JSON.parse(opt.body);
      if(p.단어 !== undefined) return { ok: true, json: async () => ({ 존재: true, 뜻풀이그룹: [] }) };
      return { ok: true, json: async () => ({ 후보: [] }) };
    };
    await win.버튼_뜻보기();
    for(let i = 0; i < 60 && 값(win, '게임_비동기처리중'); i++) await 잠깐(5);
    const 로그c = 로그텍스트(win);
    확인('뜻 보기: 뜻풀이 없음을 네트워크 탓으로 돌리지 않는다',
         로그c.includes('뜻풀이가 제공되지 않습니다') && !로그c.includes('네트워크'));
  }

  /* ── 23. localStorage 캐시 상한 (2026-08-22 신설) ────────────────────── */
  console.log('\n[23] 캐시 상한(무기한 증가 방지)');
  {
    const { win } = 페이지열기();
    const 큰캐시 = () => { const o = {}; for(let i = 0; i < 1010; i++) o['x' + i] = true; return o; };

    win.eval(`window.__c1 = ${JSON.stringify(큰캐시())}; window.__r1 = 캐시_상한적용(window.__c1, 국어원_캐시_최대개수);`);
    확인('국어원_캐시(존재 여부): 상한 1000으로 잘린다',
         값(win, 'Object.keys(window.__r1).length') === 1000);
    확인('국어원_캐시: 가장 오래된 항목(x0)이 지워짐', 값(win, "!('x0' in window.__r1)"));
    확인('국어원_캐시: 가장 최근 항목(x1009)은 남음', 값(win, "'x1009' in window.__r1"));

    win.eval(`window.__c2 = ${JSON.stringify(큰캐시())}; window.__r2 = 캐시_상한적용(window.__c2, 국어원_상세캐시_최대개수);`);
    확인('국어원_상세캐시: 상한 500으로 잘린다', 값(win, 'Object.keys(window.__r2).length') === 500);

    win.eval(`window.__c3 = ${JSON.stringify(큰캐시())}; window.__r3 = 캐시_상한적용(window.__c3, 국어원_후보캐시_최대개수);`);
    확인('국어원_후보캐시: 상한 300으로 잘린다', 값(win, 'Object.keys(window.__r3).length') === 300);

    // 실제 저장 함수가 localStorage에 쓸 때도 상한을 거치는지(캐시_상한적용 호출만 확인하고
    // 끝내지 않는다 — 저장 함수 내부에서 안 부르면 위 단위 테스트는 통과해도 실효가 없다)
    win.eval(`
      window.__c4 = ${JSON.stringify(큰캐시())};
      국어원_후보캐시_저장(window.__c4);
    `);
    const 저장된 = 값(win, `Object.keys(JSON.parse(localStorage.getItem(국어원_후보캐시_KEY))).length`);
    확인('국어원_후보캐시_저장()이 저장 전 상한을 실제로 적용한다', 저장된 === 300, `개수=${저장된}`);
  }

  console.log(`\n━━━ 결과: ${통과} 통과 / ${실패} 실패 ━━━\n`);
  process.exit(실패 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

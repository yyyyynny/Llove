// wchain '잇는' — 한방 판정 회귀 테스트 (2026-07-27)
//
// 관리자님 실플레이 제보("바로 패배를 해버림" / "2번째 턴에 실수·목숨 없이 강제 패배")의
// 근본 원인을 그대로 재현하고, 수정 후 재발하지 않음을 증명한다.
//
// 원인이었던 것: is_hanbang이 find_words에 사전을 안 넘겨 **항상 로컬 DICTIONARY(280개)**만
// 뒤졌다. 국어원 API를 켠 뒤 실제 플레이 공간은 우리말샘 전체가 됐는데 판정만 280단어 기준이라
// 정상 단어의 상당수가 "이을 단어가 없는 한방 단어"로 오판됐고, 그 오판이 즉시 패배로 직결됐다.
//
// wchain의 js/*.js는 클래식 스크립트(전역 공유)라 require()로는 서로를 못 본다 —
// 브라우저처럼 하나의 vm 컨텍스트에 순서대로 넣어 실행한다.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '..', 'wchain', 'js');

let 통과 = 0, 실패 = 0;
function 확인(이름, 조건, 비고 = ''){
  if(조건){ 통과++; console.log(`  ✓ ${이름}`); }
  else { 실패++; console.log(`  ✗ ${이름}${비고 ? ' — ' + 비고 : ''}`); }
}

// ── 게임 세계 하나를 만든다 ──────────────────────────────────────────────
// 국어원.js는 fetch·localStorage에 의존하므로 로드하지 않고 그 자리에 스텁을 넣는다
// (게이트 상수와 후보목록조회 함수만 있으면 게임규칙.js가 그대로 돌아간다).
function 세계만들기({ 게이트 = true, 온라인 = '정상', 모드 = 'SURVIVAL' } = {}){
  const 조회기록 = [];
  const ctx = {
    console,
    국어원_활성화: 게이트,
    // 온라인 사전 스텁.
    //   '정상' → 요청한 글자로 이을 수 있는 단어를 만들어 돌려준다
    //   '실패' → null (확인 자체를 못 함)
    //   '없음' → 빈 배열 (정말로 이을 단어가 없음)
    async 국어원_후보목록조회(글자, 방향){
      조회기록.push({ 글자, 방향 });
      if(온라인 === '실패') return null;
      if(온라인 === '없음') return [];
      // 13층 3글자 족쇄까지 통과하도록 3글자로 만든다.
      return 방향 === 'end' ? ['우리' + 글자] : [글자 + '우리'];
    },
    로그_추가(){},          // UI 레이어 스텁
    표시무한: n => (n === Infinity ? '∞' : String(n)),
    localStorage: { getItem: () => null, setItem(){} },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for(const f of ['사전.js', '엔진.js', '게임상태.js', '게임규칙.js']){
    vm.runInContext(fs.readFileSync(path.join(JS_DIR, f), 'utf8'), ctx, { filename: f });
  }
  const gs = ctx.새게임상태();
  gs.game_mode = 모드;
  gs.persona = 'Polite';
  gs.game_state = 'PLAYING';
  // 클래식 스크립트의 const 선언(DICTIONARY 등)은 스크립트 렉시컬 스코프에 있어 컨텍스트 객체의
  // 속성이 되지 않는다(함수 선언은 됨). 값이 필요하면 컨텍스트 안에서 평가해 꺼낸다.
  const 값 = 이름 => vm.runInContext(이름, ctx);
  return { ctx, gs, 조회기록, 값 };
}

const 흔한말 = ['국어','이름','사람','나무','학교','바다','시간','친구','음악','영화','사랑',
               '여행','공부','컴퓨터','자유','행복','세상','마음','하루','계절','도시','강물',
               '노래','그림','편지'];

async function main(){
  console.log('\n━━━ wchain 한방 판정 회귀 테스트 ━━━\n');

  /* ── 1. 제보 재현: 흔한 단어가 한방으로 오판되지 않는다 ────────────── */
  console.log('[1] 흔한 단어 오판 (제보 ①② 재현)');
  {
    const { ctx, gs } = 세계만들기();
    // 버그의 전제(로컬 사전이 좁다)가 실제로 성립하는지 먼저 확인 — 이게 깨지면 테스트가 무의미
    const 로컬오판 = 흔한말.filter(w => ctx.is_hanbang(w, [], false, 'Flexible', 0));
    확인(`로컬 판정만으로는 ${로컬오판.length}개가 한방으로 보인다(버그 전제 성립)`,
         로컬오판.length > 0, '로컬 사전이 좁다는 전제가 깨졌다');

    const 확정 = [];
    for(const w of 흔한말) if(await ctx.한방_확정인가(w, gs)) 확정.push(w);
    확인(`흔한 단어 ${흔한말.length}개 중 한방 확정 0개`, 확정.length === 0,
         `아직 ${확정.join('·')}이(가) 한방으로 남음`);
  }

  /* ── 2. 로컬 사전 단어 전수 ──────────────────────────────────────── */
  console.log('\n[2] 로컬 사전 단어 전수 (DICTIONARY + HARD_DICT)');
  {
    const { ctx, gs, 값 } = 세계만들기();
    const 전체 = [...new Set([...값('DICTIONARY'), ...값('HARD_DICT')])];
    const 로컬오판 = 전체.filter(w => ctx.is_hanbang(w, [], false, 'Flexible', 0));
    확인(`로컬 판정으로는 ${전체.length}개 중 ${로컬오판.length}개가 한방(전제 성립)`,
         로컬오판.length > 0);

    const 확정 = [];
    for(const w of 전체) if(await ctx.한방_확정인가(w, gs)) 확정.push(w);
    확인(`온라인 재확인 후 한방 확정 0개`, 확정.length === 0,
         `${확정.length}개 남음: ${확정.slice(0, 10).join('·')}`);
  }

  /* ── 3. 온라인 조회 실패는 한방으로 단정하지 않는다 ─────────────────── */
  console.log('\n[3] 국어원 실패 공정성');
  {
    const { ctx, gs } = 세계만들기({ 온라인: '실패' });
    확인('조회 실패(null) 시 한방으로 단정하지 않음', (await ctx.한방_확정인가('사랑', gs)) === false);
  }

  /* ── 4. 정말 이을 단어가 없으면 한방으로 확정한다 ──────────────────── */
  console.log('\n[4] 진짜 한방 단어는 그대로 한방');
  {
    const { ctx, gs } = 세계만들기({ 온라인: '없음' });
    확인('온라인으로도 후보 0개면 한방 확정', (await ctx.한방_확정인가('사랑', gs)) === true);
    확인('로컬에서 이을 수 있으면 애초에 한방 아님', (await ctx.한방_확정인가('나무', gs)) === false);
  }

  /* ── 5. 게이트 off면 기존(로컬 전용) 동작을 그대로 유지 ─────────────── */
  console.log('\n[5] 게이트 off 하위 호환');
  {
    const { ctx, gs, 조회기록 } = 세계만들기({ 게이트: false });
    확인('게이트 off면 로컬 판정 그대로', (await ctx.한방_확정인가('사랑', gs)) === true);
    확인('게이트 off면 네트워크 호출 0건', 조회기록.length === 0);
  }

  /* ── 6. 로컬로 충분하면 네트워크를 타지 않는다(성능 회귀 방지) ──────── */
  console.log('\n[6] 불필요한 네트워크 호출 없음');
  {
    const { ctx, gs, 조회기록 } = 세계만들기();
    await ctx.한방_확정인가('나무', gs);   // '무'로 시작하는 단어가 로컬에 있음
    확인('로컬에서 답이 나면 조회 0건', 조회기록.length === 0, `${조회기록.length}건 호출됨`);
  }

  /* ── 7. 두음법칙 변환형까지 조회한다 ────────────────────────────────── */
  console.log('\n[7] 두음법칙 변환형 조회');
  {
    const { ctx, gs, 조회기록 } = 세계만들기({ 온라인: '없음' });
    gs.dueum = 'Flexible';
    await ctx.한방_확정인가('폭력', gs);   // 다음 글자 '력' → 두음 변환형 '역'
    const 글자들 = 조회기록.map(r => r.글자);
    확인("'력'과 두음 변환형 '역'을 모두 조회", 글자들.includes('력') && 글자들.includes('역'),
         `실제 조회: ${글자들.join(',')}`);
    확인('끝말잇기는 start 방향으로 조회', 조회기록.every(r => r.방향 === 'start'));
  }

  /* ── 8. 앞말잇기(rev)는 end 방향으로 조회 ──────────────────────────── */
  console.log('\n[8] 앞말잇기 방향');
  {
    const { ctx, gs, 조회기록 } = 세계만들기();
    gs.rev = true; gs.dueum = 'OFF';
    // '뿌리'의 앞 글자 '뿌'로 끝나는 단어는 로컬에 없다 → 로컬 판정은 한방, 온라인이 뒤집어야 한다.
    확인('rev 모드에서 온라인 후보로 한방이 풀림', (await ctx.한방_확정인가('뿌리', gs)) === false);
    확인('rev는 end 방향으로 조회', 조회기록.length > 0 && 조회기록.every(r => r.방향 === 'end'));
  }

  /* ── 9. AI 후보 풀 — 온라인 희귀어가 safe_filter에서 전멸하지 않는다 ── */
  console.log('\n[9] AI 후보 풀 정합성 (결함 ③)');
  {
    const { ctx, gs } = 세계만들기();
    gs.diff = '심연'; gs.hanbang = false; gs.dueum = 'OFF';   // 안전 필터가 켜지는 조건
    gs.ai_last_char = '스';
    // 온라인 후보끼리 서로 이어지는 상황('스나락' → '락바위'). 로컬 사전에는 '락'으로 시작하는
    // 단어가 없어서, 로컬 기준 판정은 '스나락'을 한방으로 오판한다.
    const 온라인후보 = ['스나락', '락바위'];
    확인('로컬 기준으로는 온라인 후보가 한방으로 오판됨(전제 성립)',
         ctx.is_hanbang('스나락', [], false, gs.dueum, 0) === true);

    const 사전 = ctx.ai_후보사전(gs, 온라인후보);
    확인('같은 풀로 판정하면 오판이 풀린다',
         ctx.is_hanbang('스나락', [], false, gs.dueum, 0, 사전) === false,
         '온라인 후보를 풀에 넣고도 판정만 로컬로 하고 있음');

    // safe_filter를 통과해 실제로 AI가 온라인 단어를 낼 수 있어야 한다
    const 뽑힌것 = new Set();
    for(let i = 0; i < 200; i++) 뽑힌것.add(ctx.ai_generate_word(gs, 온라인후보));
    확인('AI가 온라인 후보를 실제로 사용한다', 뽑힌것.has('스나락'),
         `뽑힌 단어: ${[...뽑힌것].join('·')}`);
  }

  /* ── 10. hanbang 기본값 변경의 아케이드 부작용 방지 ────────────────── */
  console.log('\n[10] 기본값 변경 부작용 (아케이드)');
  {
    const { ctx } = 세계만들기();
    const 기본 = ctx.새게임상태();
    확인('hanbang 기본값이 true(켜기)', 기본.hanbang === true);

    const 서바이벌 = ctx.새게임상태(); 서바이벌.game_mode = 'SURVIVAL';
    확인('서바이벌 기본값에서는 AI 한방 허용', ctx.ai_한방금지인가(서바이벌) === false);

    const 아케이드 = ctx.새게임상태(); 아케이드.game_mode = 'ARCADE';
    확인('아케이드는 hanbang 값과 무관하게 AI 한방 금지',
         ctx.ai_한방금지인가(아케이드) === true,
         '사용자만 한방 금지고 AI는 허용되는 불공정 상태');
  }

  /* ── 11. is_hanbang 하위 호환 (파이썬 대조 무회귀) ──────────────────── */
  console.log('\n[11] is_hanbang 하위 호환');
  {
    const { ctx, 값 } = 세계만들기();
    const 전체 = [...new Set([...값('DICTIONARY'), ...값('HARD_DICT')])];
    let 불일치 = 0;
    for(const w of 전체){
      for(const [rev, du] of [[false,'OFF'],[false,'Flexible'],[true,'OFF']]){
        const 인자없이 = ctx.is_hanbang(w, [], rev, du, 0);
        const null명시 = ctx.is_hanbang(w, [], rev, du, 0, null);
        const DICT명시 = ctx.is_hanbang(w, [], rev, du, 0, 값('DICTIONARY'));
        if(인자없이 !== null명시 || 인자없이 !== DICT명시) 불일치++;
      }
    }
    확인(`6번째 인자 생략 = null = DICTIONARY (${전체.length}단어 × 3조합)`, 불일치 === 0,
         `${불일치}건 불일치 — 파이썬 대조 벡터가 깨진다`);
  }

  console.log(`\n━━━ 결과: ${통과} 통과 / ${실패} 실패 ━━━\n`);
  process.exit(실패 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

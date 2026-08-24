// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GitHub Pages 배포 전 기본 점검 스크립트
// - 배포 산출물(index.html)이 존재하고 깨지지 않았는지 가벼운 정합성만 확인한다.
// - 외부 의존성 없이 동작하며, 문제 발견 시 비정상 종료(코드 1)한다.
// - 실행: node scripts/check-deploy.mjs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const 검사목록 = [];
let 실패 = 0;

function 확인(설명, 조건) {
  if (조건) {
    검사목록.push(`✅ ${설명}`);
  } else {
    검사목록.push(`❌ ${설명}`);
    실패++;
  }
}

// 1) 배포 진입점 존재
// 저장소 재편(2026-07-19): 앱 본체 = Llove/, 루트 index.html = 관문 리다이렉트
const 진입점있음 = existsSync('Llove/index.html');
확인('Llove/index.html 앱 진입점이 존재한다', 진입점있음);
확인('루트 관문 index.html(리다이렉트)이 존재한다', existsSync('index.html'));
확인('wchain/index.html 이세계 진입점이 존재한다', existsSync('wchain/index.html'));

// wchain 보조 사전 — 2026-07-29부터 게임의 사전 기준은 우리말샘이고, data/사전.json은
// "우리말샘에 없는 유행어·줄임말"을 담는 보조 칸이다(비어 있는 것이 정상).
// 파일이 없거나 깨지면 보조 단어가 조용히 무시되므로 배포 전에 확인한다.
{
  const 사전경로 = 'wchain/data/사전.json';
  const 있음 = existsSync(사전경로);
  확인('wchain/data/사전.json(보조 사전)이 존재한다', 있음);
  if (있음) {
    let 표 = null;
    try { 표 = JSON.parse(readFileSync(사전경로, 'utf8')); } catch (e) { /* 아래에서 실패 처리 */ }
    확인('사전.json이 올바른 JSON이다', !!표 && typeof 표 === 'object');
    if (표) {
      확인('추가단어가 배열이다', Array.isArray(표.추가단어));
      if (Array.isArray(표.추가단어)) {
        const 이상 = 표.추가단어.filter(w => typeof w !== 'string' || !w.trim());
        확인(`추가단어 ${표.추가단어.length}건이 전부 비지 않은 문자열이다`, 이상.length === 0,
             JSON.stringify(이상.slice(0, 3)));
        const 공백초과 = 표.추가단어.filter(w => typeof w === 'string' && (w.match(/ /g) || []).length > 1);
        확인('공백이 1개를 넘는 항목이 없다(구 허용 규칙)', 공백초과.length === 0,
             공백초과.slice(0, 3).join(', '));
      }
    }
  }
  // 런타임 코드에 옛 하드코딩 사전이 남아 있지 않은지 — 되살아나면 판정 기준이 다시 갈린다
  const 사전js = existsSync('wchain/js/사전.js') ? readFileSync('wchain/js/사전.js', 'utf8') : '';
  확인('wchain/js/사전.js에 하드코딩 단어 배열이 남아 있지 않다',
       !/const\s+(DICTIONARY|HARD_DICT)\s*=/.test(사전js));
}

// wchain 페르소나 대사 — 2026-07-29부터 코드가 아니라 data/대사.json이 원본이다.
// 이 파일이 없거나 깨지면 게임 대사가 전부 "[대사 없음: 키]"로 뜨므로 배포 전에 막는다.
{
  const 대사경로 = 'wchain/data/대사.json';
  const 있음 = existsSync(대사경로);
  확인('wchain/data/대사.json(페르소나 대사)이 존재한다', 있음);
  if (있음) {
    let 표 = null;
    try { 표 = JSON.parse(readFileSync(대사경로, 'utf8')); } catch (e) { /* 아래에서 실패 처리 */ }
    확인('대사.json이 올바른 JSON이다', !!표 && typeof 표 === 'object');
    if (표) {
      const 키 = Object.keys(표);
      확인(`대사 항목이 비어 있지 않다 (${키.length}건)`, 키.length > 0);
      // 코드가 참조하는 키가 전부 있는지 (키 오타 = 화면에 "[대사 없음]" 노출)
      const 참조 = new Set(), 무작위접두 = new Set();
      for (const f of ['게임상태.js', '게임규칙.js', '서바이벌.js']) {
        const p = `wchain/js/${f}`;
        if (!existsSync(p)) continue;
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/대사\(gs,\s*'([^']+)'(\s*\+)?/g)) {
          if (!m[2]) 참조.add(m[1]);   // 조립 키(접두사 + 변수)는 정적 검사 대상에서 제외
        }
        // 대사_무작위(gs, '접두') — 접두_1, 접두_2 … 중 하나를 무작위로 고르는 묶음
        for (const m of src.matchAll(/대사_무작위\(gs,\s*'([^']+)'/g)) 무작위접두.add(m[1]);
      }
      // 무작위 묶음은 페르소나별 문구 수가 달라도 되고(모자란 칸은 ""), 묶음 단위로 검사한다.
      const 무작위키 = k => [...무작위접두].some(p2 => new RegExp(`^${p2}_\\d+$`).test(k));
      const 불완전 = 키.filter(k => !무작위키(k)).filter(k => !표[k] || !표[k].폭군 || !표[k].비서);
      확인('1:1 대사가 폭군·비서 두 문구를 갖춘다', 불완전.length === 0,
           불완전.slice(0, 5).join(', '));
      const 빈묶음 = [...무작위접두].filter(p2 => {
        const 묶음 = 키.filter(k => new RegExp(`^${p2}_\\d+$`).test(k));
        return !(묶음.some(k => 표[k].폭군) && 묶음.some(k => 표[k].비서));
      });
      확인(`무작위 대사 묶음 ${무작위접두.size}종이 양쪽 페르소나에 최소 1줄씩 있다`,
           빈묶음.length === 0, 빈묶음.join(', '));
      const 누락 = [...참조].filter(k => !표[k]);
      확인(`코드가 참조하는 대사 키 ${참조.size}개가 전부 존재한다`, 누락.length === 0,
           누락.slice(0, 5).join(', '));
    }
  }
}

if (진입점있음) {
  const html = readFileSync('Llove/index.html', 'utf8');

  // 2) 병합 충돌 마커 잔존 여부 (배포 사고 방지)
  const 충돌마커 = /^(<<<<<<<|=======|>>>>>>>)/m.test(html);
  확인('병합 충돌 마커(<<<<<<< 등)가 남아 있지 않다', !충돌마커);

  // 3) 필수 골격 태그
  확인('<!DOCTYPE html> 선언이 있다', /<!doctype html>/i.test(html));
  확인('</html> 닫는 태그가 있다', /<\/html>\s*$/i.test(html.trimEnd() + '\n') || /<\/html>/i.test(html));
  확인('<title> 태그가 있다', /<title>[\s\S]*?<\/title>/i.test(html));

  // 4) 재구조화 정합성 — index.html이 참조하는 분할 파일(style.css·js/*.js)이 전부 존재하는지
  확인('style.css 가 존재한다', existsSync('Llove/style.css'));
  확인('index.html 이 style.css 를 참조한다', /<link rel="stylesheet" href="style.css">/.test(html));
  const 참조JS = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
  확인('index.html 이 js/ 분할 스크립트를 참조한다 (1개 이상)', 참조JS.length > 0);
  const 누락JS = 참조JS.filter((p) => !existsSync('Llove/' + p));
  확인(`참조된 js 파일 ${참조JS.length}개가 전부 존재한다`, 누락JS.length === 0);
  if (누락JS.length > 0) 검사목록.push(`   ↳ 누락: ${누락JS.join(', ')}`);
  // 역방향: js/ 폴더에 있는데 index.html이 로드하지 않는 고아 파일 (배포 사고 예방)
  let 고아JS = [];
  try { 고아JS = readdirSync('Llove/js').filter((f) => f.endsWith('.js') && !참조JS.includes('js/' + f)); } catch { /* js 폴더 없음은 위 항목에서 잡힘 */ }
  확인('js/ 폴더에 index.html 미참조 고아 .js 파일이 없다', 고아JS.length === 0);
  if (고아JS.length > 0) 검사목록.push(`   ↳ 고아: ${고아JS.join(', ')}`);

  // 5) Grok 게이트 안전장치 — 봉인 플래그가 코드에 존재하는지 (CLAUDE.md 절대 고정 항목)
  //    (재구조화로 플래그가 js/ 분할 파일로 이동 → 전체 JS를 합쳐 검사)
  const 전체JS = 참조JS.filter((p) => existsSync('Llove/' + p)).map((p) => readFileSync('Llove/' + p, 'utf8')).join('\n');
  확인('GROK_활성화 플래그가 코드에 존재한다', /GROK_활성화\s*=/.test(html + 전체JS));
  확인('음성생성_활성화 플래그가 코드에 존재한다', /음성생성_활성화\s*=/.test(html + 전체JS));
  확인('국어원_활성화 플래그가 코드에 존재한다', /국어원_활성화\s*=/.test(html + 전체JS));

  // 참고: <script>/<style> 등 태그 짝 균형 검증은 htmlhint 의 tag-pair 룰이 담당한다.
  //   (여기서 정규식으로 세면 JS 문자열·주석 속 "<style>" 문구까지 오탐하므로 의도적으로 제외)
}

// 6) data/ 모드 DB 6종 — 코드(js/퀴즈엔진.js·js/플래시카드.js·js/아재개그.js)가 실제로
//    기대하는 필드가 채워졌는지 스키마 검증. 여기서 잡히면 "채웠는데 앱에 반영 안 됨" 유형의
//    DB 불일치를 커밋 전에 미리 발견할 수 있다.
const 데이터스키마 = [
  { 파일: 'Llove/data/상식어원.json', 종류: 'quiz', 중복키: 'q' },
  { 파일: 'Llove/data/세계사신화.json', 종류: 'quiz', 중복키: 'q' },
  { 파일: 'Llove/data/맞춤법.json', 종류: 'quiz', 중복키: 'q', hint필수: true },
  { 파일: 'Llove/data/고사성어속담.json', 종류: 'flashcard', 중복키: 'word' },
  { 파일: 'Llove/data/한자우리말.json', 종류: 'flashcard', 중복키: 'word' },
  { 파일: 'Llove/data/아재개그.json', 종류: 'dadjoke', 중복키: 'q' },
];

for (const { 파일, 종류, 중복키, hint필수 } of 데이터스키마) {
  if (!existsSync(파일)) { 확인(`${파일} 이 존재한다`, false); continue; }
  let d;
  try {
    d = JSON.parse(readFileSync(파일, 'utf8'));
  } catch (e) {
    확인(`${파일} 이 유효한 JSON이다`, false);
    검사목록.push(`   ↳ 파싱 오류: ${e.message}`);
    continue;
  }
  const items = Array.isArray(d.items) ? d.items : null;
  확인(`${파일} 이 { items: [...] } 형태다`, items !== null);
  if (!items) continue;

  let 필드오류 = 0;
  items.forEach((it, i) => {
    if (종류 === 'quiz') {
      if (typeof it.q !== 'string' || !it.q) 필드오류++;
      if (!Array.isArray(it.opts) || it.opts.length < 2) 필드오류++;
      else if (it.opts.filter((o) => o && o.c === true).length !== 1) 필드오류++;
      if (hint필수 && typeof it.hint !== 'string') 필드오류++;
    } else if (종류 === 'flashcard') {
      if (typeof it.word !== 'string' || !it.word) 필드오류++;
      if (typeof it.meaning !== 'string' || !it.meaning) 필드오류++;
      if (!Array.isArray(it.hanja)) 필드오류++;  // 순우리말·속담도 빈 배열([])은 필수 — 렌더 크래시 방지
      if (typeof it.reading !== 'string' || typeof it.direct !== 'string' || typeof it.example !== 'string' || typeof it.mnemonic !== 'string') 필드오류++;
    } else if (종류 === 'dadjoke') {
      if (typeof it.q !== 'string' || !it.q) 필드오류++;
      if (typeof it.a !== 'string' || !it.a) 필드오류++;
      if (typeof it.e !== 'string' || !it.e) 필드오류++;
    }
  });
  확인(`${파일} 항목 ${items.length}개가 전부 필수 필드를 갖춘다`, 필드오류 === 0);
  if (필드오류 > 0) 검사목록.push(`   ↳ 필드 누락/형식 오류 ${필드오류}건`);

  const 키목록 = items.map((it) => it[중복키]).filter(Boolean);
  const 중복 = 키목록.filter((k, i) => 키목록.indexOf(k) !== i);
  확인(`${파일} 에 '${중복키}' 중복 항목이 없다`, 중복.length === 0);
  if (중복.length > 0) 검사목록.push(`   ↳ 중복: ${[...new Set(중복)].slice(0, 5).join(' / ')}${중복.length > 5 ? ' 외' : ''}`);
}

// ── 문서가 주장하는 파일 개수가 실제와 맞는가 (2026-08-22 신설) ─────────────
// CLAUDE.md는 "구조 변경 시 이 섹션을 즉시 갱신할 것"이라고 스스로 정해 뒀는데도 실제로는
// 여러 번 어긋났다(js 23↔25개가 CLAUDE.md·KNOWLEDGE·SYSTEM 세 문서에 서로 다르게 남아 있었음).
// 사람 눈에만 맡기지 말고, 파일을 추가·삭제하면 검사에서 바로 걸리게 한다.
// ⚠️ 날짜가 찍힌 과거 작업 기록(작업인계_노트.md의 [세션 N] 절, wchain/시스템.md의 검증 절)은
//    그 시점의 사실이므로 검사 대상이 아니다 — 아래 세 문서의 "현재 구조" 서술만 본다.
{
  const 실제_Llove = readdirSync('Llove/js').filter((f) => f.endsWith('.js')).length;
  const 실제_wchain = readdirSync('wchain/js').filter((f) => f.endsWith('.js')).length;
  // 표기 흔들림을 전부 잡는다: `js/ 25개` · `` `js/` 25개 `` · `js/           ← 로직 25개 파일`
  const 개수표기 = /js\/`?[^\n]{0,20}?(\d+)\s*개/g;
  for (const 파일 of ['CLAUDE.md', '언어_KNOWLEDGE_v5.md', '언어_SYSTEM_v5.md']) {
    const 본문 = existsSync(파일) ? readFileSync(파일, 'utf8') : '';
    const 어긋남 = [];
    let m;
    개수표기.lastIndex = 0;
    while ((m = 개수표기.exec(본문)) !== null) {
      if (Number(m[1]) !== 실제_Llove) 어긋남.push(m[0].replace(/\s+/g, ' ').trim());
    }
    확인(`${파일} 의 js/ 파일 개수 서술이 실제(${실제_Llove}개)와 일치한다`, 어긋남.length === 0);
    if (어긋남.length) 검사목록.push(`   ↳ 실제와 다른 서술: ${[...new Set(어긋남)].join(' / ')} — 문서를 갱신하세요`);
  }
  const claude = existsSync('CLAUDE.md') ? readFileSync('CLAUDE.md', 'utf8') : '';
  확인(`CLAUDE.md 의 wchain/js 파일 개수 서술이 실제(${실제_wchain}개)와 일치한다`,
    claude.includes(`잇는 로직 ${실제_wchain}개`));
}

console.log(검사목록.join('\n'));
if (실패 > 0) {
  console.error(`\n배포 전 점검 실패: ${실패}개 항목에서 문제가 발견되었습니다.`);
  process.exit(1);
}
console.log('\n배포 전 기본 점검 통과.');

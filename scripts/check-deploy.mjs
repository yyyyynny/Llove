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

console.log(검사목록.join('\n'));
if (실패 > 0) {
  console.error(`\n배포 전 점검 실패: ${실패}개 항목에서 문제가 발견되었습니다.`);
  process.exit(1);
}
console.log('\n배포 전 기본 점검 통과.');

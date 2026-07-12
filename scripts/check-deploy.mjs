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
const 진입점있음 = existsSync('index.html');
확인('index.html 배포 진입점이 존재한다', 진입점있음);

if (진입점있음) {
  const html = readFileSync('index.html', 'utf8');

  // 2) 병합 충돌 마커 잔존 여부 (배포 사고 방지)
  const 충돌마커 = /^(<<<<<<<|=======|>>>>>>>)/m.test(html);
  확인('병합 충돌 마커(<<<<<<< 등)가 남아 있지 않다', !충돌마커);

  // 3) 필수 골격 태그
  확인('<!DOCTYPE html> 선언이 있다', /<!doctype html>/i.test(html));
  확인('</html> 닫는 태그가 있다', /<\/html>\s*$/i.test(html.trimEnd() + '\n') || /<\/html>/i.test(html));
  확인('<title> 태그가 있다', /<title>[\s\S]*?<\/title>/i.test(html));

  // 4) 재구조화 정합성 — index.html이 참조하는 분할 파일(style.css·js/*.js)이 전부 존재하는지
  확인('style.css 가 존재한다', existsSync('style.css'));
  확인('index.html 이 style.css 를 참조한다', /<link rel="stylesheet" href="style.css">/.test(html));
  const 참조JS = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
  확인('index.html 이 js/ 분할 스크립트를 참조한다 (1개 이상)', 참조JS.length > 0);
  const 누락JS = 참조JS.filter((p) => !existsSync(p));
  확인(`참조된 js 파일 ${참조JS.length}개가 전부 존재한다`, 누락JS.length === 0);
  if (누락JS.length > 0) 검사목록.push(`   ↳ 누락: ${누락JS.join(', ')}`);
  // 역방향: js/ 폴더에 있는데 index.html이 로드하지 않는 고아 파일 (배포 사고 예방)
  let 고아JS = [];
  try { 고아JS = readdirSync('js').filter((f) => f.endsWith('.js') && !참조JS.includes('js/' + f)); } catch { /* js 폴더 없음은 위 항목에서 잡힘 */ }
  확인('js/ 폴더에 index.html 미참조 고아 .js 파일이 없다', 고아JS.length === 0);
  if (고아JS.length > 0) 검사목록.push(`   ↳ 고아: ${고아JS.join(', ')}`);

  // 5) Grok 게이트 안전장치 — 봉인 플래그가 코드에 존재하는지 (CLAUDE.md 절대 고정 항목)
  //    (재구조화로 플래그가 js/ 분할 파일로 이동 → 전체 JS를 합쳐 검사)
  const 전체JS = 참조JS.filter((p) => existsSync(p)).map((p) => readFileSync(p, 'utf8')).join('\n');
  확인('GROK_활성화 플래그가 코드에 존재한다', /GROK_활성화\s*=/.test(html + 전체JS));
  확인('음성생성_활성화 플래그가 코드에 존재한다', /음성생성_활성화\s*=/.test(html + 전체JS));

  // 참고: <script>/<style> 등 태그 짝 균형 검증은 htmlhint 의 tag-pair 룰이 담당한다.
  //   (여기서 정규식으로 세면 JS 문자열·주석 속 "<style>" 문구까지 오탐하므로 의도적으로 제외)
}

console.log(검사목록.join('\n'));
if (실패 > 0) {
  console.error(`\n배포 전 점검 실패: ${실패}개 항목에서 문제가 발견되었습니다.`);
  process.exit(1);
}
console.log('\n배포 전 기본 점검 통과.');

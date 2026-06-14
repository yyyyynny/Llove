// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GitHub Pages 배포 전 기본 점검 스크립트
// - 배포 산출물(index.html)이 존재하고 깨지지 않았는지 가벼운 정합성만 확인한다.
// - 외부 의존성 없이 동작하며, 문제 발견 시 비정상 종료(코드 1)한다.
// - 실행: node scripts/check-deploy.mjs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { readFileSync, existsSync } from 'node:fs';

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

  // 4) Grok 게이트 안전장치 — 봉인 플래그가 코드에 존재하는지 (CLAUDE.md 절대 고정 항목)
  확인('GROK_활성화 플래그가 코드에 존재한다', /GROK_활성화\s*=/.test(html));

  // 참고: <script>/<style> 등 태그 짝 균형 검증은 htmlhint 의 tag-pair 룰이 담당한다.
  //   (여기서 정규식으로 세면 JS 문자열·주석 속 "<style>" 문구까지 오탐하므로 의도적으로 제외)
}

console.log(검사목록.join('\n'));
if (실패 > 0) {
  console.error(`\n배포 전 점검 실패: ${실패}개 항목에서 문제가 발견되었습니다.`);
  process.exit(1);
}
console.log('\n배포 전 기본 점검 통과.');

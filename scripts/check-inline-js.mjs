// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// index.html 인라인 JavaScript 문법 검증 스크립트
// - index.html은 단일 HTML 파일이라 <script> 블록이 내부에 인라인으로 들어 있다.
// - 외부 src 스크립트(Firebase SDK 등)는 제외하고, 인라인 블록만 추출하여
//   node --check 로 문법 오류를 검사한다. (CLAUDE.md: node --check 의무화)
// - 실행: node scripts/check-inline-js.mjs
// - 문법 오류가 있으면 비정상 종료(코드 1)하여 CI가 실패로 인식한다.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HTML_PATH = 'index.html';

// 인라인 <script> 블록만 추출 (src 속성이 있는 외부 스크립트는 제외)
function 인라인스크립트_추출(html) {
  const 블록들 = [];
  // <script ...>...</script> 전체를 비탐욕 매칭
  const 정규식 = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = 정규식.exec(html)) !== null) {
    const 속성 = m[1] || '';
    const 본문 = m[2] || '';
    // src= 가 있으면 외부 스크립트이므로 건너뛴다
    if (/\bsrc\s*=/.test(속성)) continue;
    // type 이 module/javascript 가 아닌 경우(예: application/json)는 건너뛴다
    const type매치 = 속성.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    if (type매치) {
      const t = type매치[1].toLowerCase();
      if (t !== 'text/javascript' && t !== 'module' && t !== 'application/javascript') continue;
    }
    // 추출 위치의 줄 번호 계산(오류 보고용)
    const 시작줄 = html.slice(0, m.index).split('\n').length;
    블록들.push({ 시작줄, 본문 });
  }
  return 블록들;
}

function main() {
  let html;
  try {
    html = readFileSync(HTML_PATH, 'utf8');
  } catch (e) {
    console.error(`❌ ${HTML_PATH} 를 읽을 수 없습니다: ${e.message}`);
    process.exit(1);
  }

  const 블록들 = 인라인스크립트_추출(html);
  if (블록들.length === 0) {
    console.error('❌ 인라인 <script> 블록을 찾지 못했습니다. index.html 구조를 확인하세요.');
    process.exit(1);
  }

  const 임시폴더 = mkdtempSync(join(tmpdir(), 'llove-js-'));
  let 실패 = 0;

  블록들.forEach((blk, i) => {
    const 파일 = join(임시폴더, `block_${i}.js`);
    writeFileSync(파일, blk.본문, 'utf8');
    try {
      execFileSync(process.execPath, ['--check', 파일], { stdio: 'pipe' });
      console.log(`✅ 인라인 스크립트 #${i + 1} (index.html:${blk.시작줄} 시작) — 문법 정상`);
    } catch (e) {
      실패++;
      const stderr = (e.stderr ? e.stderr.toString() : e.message);
      console.error(`❌ 인라인 스크립트 #${i + 1} (index.html:${blk.시작줄} 부근) — 문법 오류:`);
      console.error(stderr);
    }
  });

  if (실패 > 0) {
    console.error(`\n검증 실패: ${실패}개 블록에서 문법 오류가 발견되었습니다.`);
    process.exit(1);
  }
  console.log(`\n전체 ${블록들.length}개 인라인 스크립트 블록 문법 검증 통과.`);
}

main();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JavaScript 문법 검증 스크립트 (CLAUDE.md: node --check 의무화)
// - 재구조화 대응: JS 본체는 js/*.js 분할 파일에 있다 → 전부 node --check.
// - index.html에 인라인 <script> 블록이 남아 있으면(테스트 스텁 등 추후 추가 대비)
//   그것도 추출해 함께 검사한다. 외부 src 스크립트(Firebase SDK 등)는 제외.
// - 실행: node scripts/check-inline-js.mjs
// - 문법 오류가 있으면 비정상 종료(코드 1)하여 CI가 실패로 인식한다.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 저장소 재편(2026-07-19): 앱 본체가 Llove/ 하위로 이동 (루트 index.html은 관문 리다이렉트)
const HTML_PATH = 'Llove/index.html';
const JS_DIR = 'Llove/js';
// '잇는'(wchain)도 같은 규율로 검사한다 — 종전엔 이 스크립트가 Llove만 보고 있었다.
const WCHAIN_JS_DIR = 'wchain/js';
// ⚠️ 2026-08-22에 발견: wchain/worker/*.mjs(Cloudflare Worker 소스, .js가 아니라 .mjs라
// 위 두 폴더 검사에 안 걸림)는 이 스크립트가 생긴 이래 한 번도 자동 검사된 적이 없었다.
// 이 세션에 Worker 파일을 9번 고치는 동안 매번 사람이 손으로 node --check를 돌려서
// 넘어간 것 — CI는 문법 오류가 있어도 초록불이 뜨는 사각지대였다. 여기에 편입한다.
const WORKER_DIR = 'wchain/worker';

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
    // 내용 없는 빈 블록은 건너뛴다
    if (!본문.trim()) continue;
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

function 문법검사(파일경로, 라벨) {
  try {
    execFileSync(process.execPath, ['--check', 파일경로], { stdio: 'pipe' });
    console.log(`✅ ${라벨} — 문법 정상`);
    return true;
  } catch (e) {
    const stderr = (e.stderr ? e.stderr.toString() : e.message);
    console.error(`❌ ${라벨} — 문법 오류:`);
    console.error(stderr);
    return false;
  }
}

function main() {
  let 실패 = 0;
  let 검사수 = 0;

  // 1) js/*.js 분할 파일 전수 검사
  let js파일들 = [];
  try {
    js파일들 = readdirSync(JS_DIR).filter((f) => f.endsWith('.js')).sort();
  } catch {
    console.error(`❌ ${JS_DIR}/ 폴더를 읽을 수 없습니다. 재구조화 구조(js/*.js)를 확인하세요.`);
    process.exit(1);
  }
  if (js파일들.length === 0) {
    console.error(`❌ ${JS_DIR}/ 폴더에 .js 파일이 없습니다.`);
    process.exit(1);
  }
  for (const f of js파일들) {
    검사수++;
    if (!문법검사(join(JS_DIR, f), `js/${f}`)) 실패++;
  }

  // 1-b) wchain('잇는') 분할 파일 전수 검사
  // ⚠️ 2026-07-29에 발견: 이 스크립트가 Llove/js만 훑고 wchain/js는 아예 검사하지 않고 있었다.
  //    wchain 파일이 8개까지 늘어난 동안 문법 검증 그물 밖에 있었던 것 — CLAUDE.md의
  //    "node --check 의무화"가 절반만 지켜지고 있었다.
  let wchain파일들 = [];
  try {
    wchain파일들 = readdirSync(WCHAIN_JS_DIR).filter((f) => f.endsWith('.js')).sort();
  } catch {
    console.error(`❌ ${WCHAIN_JS_DIR}/ 폴더를 읽을 수 없습니다.`);
    process.exit(1);
  }
  if (wchain파일들.length === 0) {
    console.error(`❌ ${WCHAIN_JS_DIR}/ 폴더에 .js 파일이 없습니다.`);
    process.exit(1);
  }
  for (const f of wchain파일들) {
    검사수++;
    if (!문법검사(join(WCHAIN_JS_DIR, f), `wchain/js/${f}`)) 실패++;
  }

  // 1-c) wchain/worker/*.mjs (Cloudflare Worker 소스) 전수 검사 — 위 사각지대 메움.
  let worker파일들 = [];
  try {
    worker파일들 = readdirSync(WORKER_DIR).filter((f) => f.endsWith('.mjs')).sort();
  } catch {
    console.error(`❌ ${WORKER_DIR}/ 폴더를 읽을 수 없습니다.`);
    process.exit(1);
  }
  if (worker파일들.length === 0) {
    console.error(`❌ ${WORKER_DIR}/ 폴더에 .mjs 파일이 없습니다.`);
    process.exit(1);
  }
  for (const f of worker파일들) {
    검사수++;
    if (!문법검사(join(WORKER_DIR, f), `wchain/worker/${f}`)) 실패++;
  }

  // 2) index.html에 남은 인라인 <script> 블록 검사 (있을 때만)
  let html;
  try {
    html = readFileSync(HTML_PATH, 'utf8');
  } catch (e) {
    console.error(`❌ ${HTML_PATH} 를 읽을 수 없습니다: ${e.message}`);
    process.exit(1);
  }
  const 블록들 = 인라인스크립트_추출(html);
  if (블록들.length > 0) {
    const 임시폴더 = mkdtempSync(join(tmpdir(), 'llove-js-'));
    블록들.forEach((blk, i) => {
      검사수++;
      const 파일 = join(임시폴더, `block_${i}.js`);
      writeFileSync(파일, blk.본문, 'utf8');
      if (!문법검사(파일, `인라인 스크립트 #${i + 1} (index.html:${blk.시작줄} 시작)`)) 실패++;
    });
  }

  if (실패 > 0) {
    console.error(`\n검증 실패: ${실패}개 파일/블록에서 문법 오류가 발견되었습니다.`);
    process.exit(1);
  }
  console.log(`\n전체 ${검사수}개 JS 파일/블록 문법 검증 통과. `
    + `(Llove/js ${js파일들.length}개 + wchain/js ${wchain파일들.length}개 `
    + `+ wchain/worker ${worker파일들.length}개 + 인라인 ${블록들.length}개)`);
}

main();

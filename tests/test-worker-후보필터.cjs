// 우리말샘 Worker(wchain/worker/우리말샘-worker.mjs)의 후보 품질 필터 회귀 테스트.
// ─────────────────────────────────────────────────────────────────────────
// 2026-08-20 관리자님 제보: "난이도가 낮은데도 어려운 한자어·북한어·옛말을 쓰고, 초등학교
// 이름 같은 고유명사도 나온다." 실제 배포된 Worker를 curl로 조회해(README.md에 원본 데이터
// 기록) 확인한 실측 케이스를 그대로 고정 데이터로 써서, 후보_부적절한가()의 판정이 회귀하지
// 않는지 검증한다.
const fs = require('fs');
const path = require('path');
const { makeHarness } = require('./load.cjs');

const { assert, finish } = makeHarness('Worker 후보 품질 필터');

const WORKER_PATH = path.join(__dirname, '..', 'wchain', 'worker', '우리말샘-worker.mjs');
const src = fs.readFileSync(WORKER_PATH, 'utf8');
// export default { ... } 진입점(Cloudflare 전용 fetch 핸들러) 앞까지만 잘라 순수 함수만 로드.
const 함수부 = src.split('// ── 진입점')[0];
const { 후보_부적절한가 } = new Function(`
  ${함수부}
  return { 후보_부적절한가 };
`)();

// 2026-08-20 curl 실측 그대로(README.md 기록) — sense는 실제 item.sense 배열 형태를 그대로 재현.
const 실측 = {
  '초가청전신': [{ type: '일반어', cat: '정보·통신' }],       // 전문 통신 용어
  '초가치마케팅': [{ type: '일반어', cat: '경영' }],            // 마케팅 신조어
  '초가슭': [{ type: '방언' }],                                 // "초가을"의 방언
  '초가속': [{ type: '일반어', cat: '책명' }],                  // 실제 책 제목
  '초가팔리': [{ type: '일반어', cat: '지명' }],                // 경기도 포천의 지명
  '직승기': [{ type: '북한어' }],                               // '헬리콥터'의 북한어
  '인차': [{ type: '북한어' }, { type: '일반어', cat: '광업' }, { type: '일반어' }, { type: '일반어', cat: '지명' }],
  '동무': [{ type: '일반어' }, { type: '일반어' }, { type: '일반어', cat: '광업' }, { type: '북한어' }, { type: '북한어' }],
  '즈믄': [{ type: '옛말' }],                                   // '천(千)'의 옛말
  '가시버시': [{ type: '일반어' }],                             // '부부'를 낮잡는 말(그냥 일반어)
  '나무': [{ type: '일반어' }],
};

for(const [단어, sense] of Object.entries(실측)){
  const 결과 = 후보_부적절한가({ word: 단어, sense });
  const 기대_제외 = !['동무', '가시버시', '나무'].includes(단어);
  assert(`${단어}: ${기대_제외 ? '제외돼야 함' : '포함돼야 함'}`, 결과 === 기대_제외, `실제=${결과 ? '제외' : '포함'}`);
}

// 첫 sense만 본다는 원칙 자체를 별도로 확인 — "동무"는 뒤쪽 sense에 북한어가 섞여도
// 첫 sense가 일반어라 포함되어야 한다(흔한 단어가 억울하게 빠지지 않게 하는 핵심 설계).
assert('동무: 뒤쪽 sense에 북한어가 있어도 첫 sense 기준으로 포함',
  !후보_부적절한가({ word: '동무', sense: [{ type: '일반어' }, { type: '북한어' }] }));
assert('가짜단어: 첫 sense가 북한어면 뒤에 일반어가 있어도 제외',
  후보_부적절한가({ word: '가짜단어', sense: [{ type: '북한어' }, { type: '일반어' }] }));

// sense가 단일 객체(배열 아님)로 오는 경우도 방어적으로 처리되는지
assert('sense가 배열이 아니라 단일 객체여도 동작', 후보_부적절한가({ word: 'x', sense: { type: '옛말' } }));

// item.sense 자체가 없거나 빈 배열이면 판단할 근거가 없으니 안전하게 포함(제외하지 않음)
assert('sense가 없으면 포함(판단 보류)', !후보_부적절한가({ word: 'x' }));
assert('sense가 빈 배열이면 포함(판단 보류)', !후보_부적절한가({ word: 'x', sense: [] }));

process.exit(finish() > 0 ? 1 : 0);

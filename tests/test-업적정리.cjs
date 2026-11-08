// 2026-11-08 업적 문구·판정 정리 — 바뀐 판정이 깨지면 실패하는 최소 검사
const fs = require('fs');
const path = require('path');
const { load, makeHarness } = require('./load.cjs');

load(async (window) => {
  const { assert, finish } = makeHarness('업적 문구·판정 정리');
  const ev = (code) => window.eval(code);
  const 목록 = () => { ev('renderAchievements()'); return window.document.getElementById('achBody').textContent; };
  const 분 = 60000, T = 1e12;
  ev('사용자.업적진행도 = {}; 개발자오버레이 = null;');

  // 시간 가는 줄 몰라: 5분 넘게 쉬면 처음부터 다시 잰다
  ev(`집중시작 = 0; 집중마지막 = 0; [0,4,8,12,18,22,26,30,34].forEach(m => 탐닉_체크(${T} + m*${분}));`);
  assert('시간 가는 줄 몰라: 중간에 6분 쉬면 달성 안 됨', !ev("사용자.업적진행도['지식의탐닉자']"));
  assert('숨은 업적: 달성 전엔 이름 대신 ??? 와 힌트', /\?\?\?/.test(목록()) && !목록().includes('시간 가는 줄 몰라') && 목록().includes('한자리에서 오래 공부해 보세요'));
  ev(`[40,44,48,52,56,60,64,68,70].forEach(m => 탐닉_체크(${T} + m*${분}));`);
  assert('시간 가는 줄 몰라: 5분 안 간격으로 30분 이어 공부하면 달성', ev("사용자.업적진행도['지식의탐닉자']") === 1);
  assert('숨은 업적: 달성하면 이름 공개', 목록().includes('시간 가는 줄 몰라'));

  // AI 의존 업적은 봉인 중 목록·개수에서 숨김
  const 요약합 = () => ['achSumDone', 'achSumProg', 'achSumNone'].reduce((n, id) => n + Number(window.document.getElementById(id).textContent), 0);
  ev("사용자.업적진행도 = {반박의화신: 1, 경계를넘어서: 1};");   // 달성했어도(공개 상태여도) 봉인 중엔 숨긴다
  const 글 = 목록();
  assert('AI 봉인 중: 이의 있음!·선을 넘은 질문 숨김', ev('GROK_활성화') === false && !글.includes('이의 있음!') && !글.includes('선을 넘은 질문'));
  assert('AI 봉인 중: 요약 개수 18개(전체 20 − 2)', 요약합() === 18, String(요약합()));

  // 말의 품격: 마지막 임계가 구어 예문 수 이하
  const 예문수 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Llove', 'data', '정령왕_통합_v2.json'), 'utf8')).구어_교정.length;
  assert('말의 품격: 완료 임계 ≤ 구어 예문 수', ev('업적_정의.speech.임계[6]') <= 예문수, `${ev('업적_정의.speech.임계[6]')} / ${예문수}`);

  // 문구: 대괄호(창조주 제외)·글리치 문자·옛 단계명 없음
  const 항목 = ev("JSON.stringify(ACH_DATA.map(s => s.items.map(a => [a.key, a.name, a.desc, a.hint || ''])))");
  assert('문구: 창조주 말고 대괄호 이름 없음', ev("ACH_DATA.flatMap(s => s.items).filter(a => a.key !== 'creator' && /\\[/.test(a.name)).length") === 0);
  assert('문구: 깨진 글자(결합 부호) 없음', !/[̀-ͯ]/.test(항목));
  assert('단계명: 1단계…완료', ev("[stageLabel(0), stageLabel(5), stageLabel(6), stageLabel(-1)].join()") === '1단계,6단계,완료,미달성');

  process.exit(finish() > 0 ? 1 : 0);
});

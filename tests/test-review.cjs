// 항목10: 복습 '하기' 전용 화면 분리 검증
const { load } = require('./load.cjs');
load((window) => {
  const results = [];
  const assert = (n, c, d) => results.push({ n, c: !!c, d: d || '' });
  const doc = window.document;
  const ev = (code) => window.eval(code);

  // 복습 대기열에 표본 2건 주입
  ev(`복습데이터.대기열 = [
    {단어:'가렴주구', 뜻:'가혹하게 거두고 빼앗음', 모드:'고사성어', 모드클래스:'ta', id:'t1', 연속정답수:0},
    {단어:'필연', 뜻:'반드시 그렇게 됨', 모드:'한자어', 모드클래스:'ta', id:'t2', 연속정답수:0}
  ];`);

  // 시작 전 화면은 sr로 가정
  ev("goNav('sr', null);");
  // 복습 시작 → 전용 화면 srp로 이동 + 카드 렌더
  ev("복습시작();");
  assert('복습 시작 시 전용 화면(srp)으로 이동', ev('curScreen') === 'srp', `curScreen=${ev('curScreen')}`);
  assert('전용 화면 본문에 첫 단어 렌더', /가렴주구/.test(doc.getElementById('srpBody').innerHTML));
  assert('전용 화면이라 바텀 네비 숨김', doc.getElementById('g-bnav').classList.contains('hidden'));
  // 플레이 전용 요소(뜻 보기 버튼)는 복습칸(rvQueue) 인라인이 아니라 전용 화면(srpBody)에만 있어야 함
  assert('플레이 카드는 복습칸 인라인이 아님', !/rvRevealBtn/.test(doc.getElementById('rvQueue').innerHTML) && /rvRevealBtn/.test(doc.getElementById('srpBody').innerHTML));

  // 뜻 공개
  ev("복습_뜻공개();");
  assert('뜻 보기 → 정답 영역 표시', doc.getElementById('rvAnswer').style.display === 'block');

  // 1번 판정(기억남) → 두 번째 카드
  ev("복습_판정(true);");
  assert('판정 후 다음 카드(필연) 렌더', /필연/.test(doc.getElementById('srpBody').innerHTML));
  assert('진행 중 화면은 여전히 srp', ev('curScreen') === 'srp');

  // 2번 판정 → 복습 완료 → 복습 관리 화면(sr)으로 복귀
  ev("복습_판정(true);");
  assert('복습 완료 후 복습 관리(sr)로 복귀', ev('curScreen') === 'sr', `curScreen=${ev('curScreen')}`);
  assert('복귀 후 바텀 네비 다시 표시', !doc.getElementById('g-bnav').classList.contains('hidden'));

  // 중단 경로 검증
  ev(`복습데이터.대기열 = [{단어:'테스트', 뜻:'뜻', 모드:'x', 모드클래스:'ta', id:'t3', 연속정답수:0}];`);
  ev("복습시작();");
  assert('재시작 시 다시 srp', ev('curScreen') === 'srp');
  ev("복습_중단();");
  assert('중단 시 sr로 복귀', ev('curScreen') === 'sr');

  let fail = 0;
  console.log('\n=== 항목10 복습 전용 화면 테스트 ===');
  for (const r of results) { console.log(`${r.c ? '✅' : '❌'} ${r.n}${r.d ? '  ('+r.d+')' : ''}`); if (!r.c) fail++; }
  console.log(`\n총 ${results.length}건 중 ${results.length - fail}건 통과, ${fail}건 실패.`);
  process.exit(fail > 0 ? 1 : 0);
});

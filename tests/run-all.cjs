// 전체 기능 테스트 러너 — 각 테스트를 개별 프로세스로 실행하고 결과를 집계한다.
// (jsdom 환경을 테스트마다 새로 띄워 상태 오염을 방지)
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const 테스트들 = [
  ['항목7 학습 모드', 'test-learn.cjs'],
  ['항목4 커서 깜빡임', 'test-cursor.cjs'],
  ['항목8 음성 입력', 'test-speech.cjs'],
  ['항목9 글자 크기', 'test-fontscale.cjs'],
  ['항목10 복습 전용 화면', 'test-review.cjs'],
  ['항목3 커스텀 테마', 'test-customtheme.cjs'],
  ['추가기능 음성 생성', 'test-voice.cjs'],
  ['세션5 실사용 검토 수정', 'test-fixes-세션5.cjs'],
  ['세션6 실기기 2차 수정', 'test-fixes-세션6.cjs'],
  ['세션7 실기기 3차 수정', 'test-fixes-세션7.cjs'],
  ['세션8 여백·백도어 터치', 'test-fixes-세션8.cjs'],
  ['세션9 온보딩·아이콘·콘텐츠', 'test-fixes-세션9.cjs'],
  ['세션10-d 6차 피드백', 'test-fixes-세션10d.cjs'],
  ['세션10-e 7차 피드백', 'test-fixes-세션10e.cjs'],
  ['세션10-f 모바일 피드백', 'test-fixes-세션10f.cjs'],
  ['세션10-h 모바일 Enter 처리', 'test-fixes-세션10h.cjs'],
  ['세션10-i 배너 히트박스·프로필 크롭 재활용', 'test-fixes-세션10i.cjs'],
  ['세션10-j 창조주 시도 채팅 미저장', 'test-fixes-세션10j.cjs']
];

let 실패 = 0;
for (const [이름, 파일] of 테스트들) {
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, 파일)], { stdio: 'pipe' }).toString();
    process.stdout.write(out);
  } catch (e) {
    실패++;
    if (e.stdout) process.stdout.write(e.stdout.toString());
    if (e.stderr) process.stderr.write(e.stderr.toString());
    console.error(`❌ ${이름} 실패`);
  }
}

if (실패 > 0) { console.error(`\n전체 테스트 실패: ${실패}개 묶음에서 실패.`); process.exit(1); }
console.log('\n🎉 전체 기능 테스트 묶음 통과.');

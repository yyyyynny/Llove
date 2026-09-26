// 2026-09-26 포니테일 감사 — 조사 중 발견해 고친 Llove 버그(배치 B) 회귀 검증
// (wchain 쪽 B1·B4는 test-wchain-플레이.cjs에서 검증)
const fs = require('fs');
const path = require('path');
const { load, makeHarness } = require('./load.cjs');

load((window) => {
  const { assert, finish } = makeHarness('포니테일 감사 — 발견 버그 수정');
  const doc = window.document;
  const ev = (code) => window.eval(code);

  // B2: CDN이 정의한 이름은 띄어 쓴 'Nanum Gothic'/'Nanum Myeongjo' — 붙여 쓰면 기본 글꼴로 대체된다
  const 나눔 = ev("FONTS.filter(f=>f.key.startsWith('nanum_')).map(f=>f.css).join('|')");
  assert('B2: 나눔고딕 이름이 CDN 정의와 같다', 나눔.includes("'Nanum Gothic'"), 나눔);
  assert('B2: 나눔명조 이름이 CDN 정의와 같다', 나눔.includes("'Nanum Myeongjo'"), 나눔);

  // B3: 넓은 안내 모달을 본 뒤 확인 모달을 열면 넓은 상태가 남으면 안 된다
  ev("showInfoModal('ℹ️','넓은 모달','내용',true);");
  const bx = doc.querySelector('#infoBg .modal-bx');
  assert('B3: 전제 — 안내 모달이 넓게 열렸다', bx.classList.contains('wide'));
  ev("showConfirmModal('⚠️','확인','정말요?','확인',null);");
  assert('B3: 확인 모달은 기본 너비로 열린다', !bx.classList.contains('wide'));
  assert('B3: 확인 모달에 [취소]+[확인] 두 버튼', doc.querySelectorAll('#infoBtns button').length === 2);

  // B5: 편향 셔플(sort(()=>Math.random()-0.5)) 금지 — 공용 Fisher–Yates 셔플()만 쓴다
  const js폴더 = path.join(__dirname, '..', 'Llove', 'js');
  const 편향 = fs.readdirSync(js폴더).filter(f => f.endsWith('.js'))
    .filter(f => /\.sort\(\s*\(\)\s*=>\s*Math\.random\(\)\s*-\s*0?\.5\s*\)/.test(fs.readFileSync(path.join(js폴더, f), 'utf8')));
  assert('B5: 편향 셔플이 남아 있지 않다', 편향.length === 0, 편향.join(','));
  const 결과 = ev('셔플([1,2,3,4,5]).slice().sort((a,b)=>a-b).join()');
  assert('B5: 셔플은 원소를 잃거나 더하지 않는다', 결과 === '1,2,3,4,5', 결과);

  // B7: '위험 구역'의 마지막 행은 항상 보이는 행이어야 한다(.set-row:last-child 밑줄 제거가 먹도록)
  const 실험실행 = [...doc.querySelectorAll('.set-row')].find(r => (r.getAttribute('onclick') || '').includes('실험실_열기'));
  assert('B7: 실험실 행이 섹션의 마지막 자식', 실험실행 && 실험실행.parentElement.lastElementChild === 실험실행);

  // B11: 글꼴을 고르면 모달이 닫히기 전에도 새 선택에 ✓가 켜져 있어야 한다
  ev('openFontSelect();');
  ev("applyFont('nanum_gothic', true);");
  const 켜진 = [...doc.querySelectorAll('#fontList .fo.on')].map(e => e.dataset.key);
  assert('B11: 새로 고른 글꼴 하나만 선택 표시', 켜진.length === 1 && 켜진[0] === 'nanum_gothic', 켜진.join(','));

  /* ── 배치 C-1: 통합된 학습 렌더 경로 회귀 ──
     renderQuiz4·renderQuiz3 → renderQuiz(screenId), goLearn의 출제 → 현재모드_다음출제 공유,
     직접입력 잠금 → 직접입력_꺼내기, 채점 후처리 → 채점_기록. 두 화면의 차이가 그대로인지 본다. */
  ev(`DB문제['상식·어원']=[{cat:'상식',q:'상식 문제',ai:true,opts:[{t:'가',c:true},{t:'나',c:false},{t:'다',c:false},{t:'라',c:false}]}];
      DB문제['맞춤법']=[{cat:'맞춤법',q:'맞춤법 문제',hint:'띄어쓰기 주의',opts:[{t:'되요',c:false},{t:'돼요',c:true},{t:'됬어요',c:false}]}];
      학습설정.sq1='4지선다'; 학습설정.sq3='3지선다';`);
  ev("goLearn('상식·어원','sq1',null);");
  const sq1 = doc.getElementById('sq1Body');
  assert('C1: sq1 진입 시 보기 4개', sq1.querySelectorAll('.aopt').length === 4);
  assert('C1: sq1은 파란 태그 + AI 출제 표시, 힌트 줄 없음',
    !!sq1.querySelector('.tag.tb') && !!sq1.querySelector('.tag-ai') && !sq1.querySelector('.q-hint'));
  assert('C4: sq1 배지가 카테고리 아이콘으로', doc.getElementById('sq1Mode').textContent === '🌍 4지선다');

  ev("goLearn('맞춤법','sq3',null);");
  const sq3 = doc.getElementById('sq3Body');
  assert('C1: sq3 진입 시 보기 3개', sq3.querySelectorAll('.aopt').length === 3);
  assert('C1: sq3는 초록 태그 + 힌트 줄, AI 표시 없음',
    !!sq3.querySelector('.tag.tg') && sq3.querySelector('.q-hint')?.textContent === '띄어쓰기 주의' && !sq3.querySelector('.tag-ai'));

  // 직접입력 — 제출 1회 잠금 + 채점 후처리(누적 어휘 +1)
  ev("학습설정.sq3='직접입력'; renderQuiz('sq3', DB문제['맞춤법']);");
  const 누적전 = ev('사용자.총누적어휘수 || 0');
  doc.getElementById('sq3DirectInp').value = '돼요';
  ev("직접입력_제출('sq3');");
  assert('C17: 직접입력 제출 후 입력칸 잠금', doc.getElementById('sq3DirectInp').disabled === true);
  assert('C7: 정답 판정 결과 표시', (doc.getElementById('sq3DirectResult').textContent || '').includes('정답입니다'));
  assert('C7: 채점 후처리로 누적 어휘 +1', ev('사용자.총누적어휘수 || 0') === 누적전 + 1, `${누적전} → ${ev('사용자.총누적어휘수')}`);
  ev("직접입력_제출('sq3');");
  assert('C17: 두 번 제출해도 한 번만 집계', ev('사용자.총누적어휘수 || 0') === 누적전 + 1);

  // 「넘어가기」는 goLearn과 같은 출제 경로를 탄다
  ev("학습설정.sq3='3지선다'; 랜덤_넘어가기();");
  assert('C4: 넘어가기로 같은 화면에 새 문제', doc.getElementById('sq3Body').querySelectorAll('.aopt').length === 3);

  // 아재개그 — initDad 삭제 후에도 '정답 보기' 버튼은 CSS로 block
  ev("학습설정.sq4_input='플래시카드'; goLearn('아재개그','sq4',null);");
  const 버튼 = doc.getElementById('dadBtn');
  assert('C5: 아재개그 정답 보기 버튼이 그려진다', !!버튼);
  assert('C5: 버튼 표시 방식은 CSS(block)가 담당', window.getComputedStyle(버튼).display === 'block');

  /* ── 배치 C-2: Llove UI 중복 통합 회귀 ── */
  // C3 복습 탭 공통 틀 — 빈 안내 / 항목 카드 / 탭별 메타·액션·꼬리 버튼
  ev(`복습데이터.대기열=[{id:'q1',단어:'가렴주구',뜻:'뜻1',모드:'고사성어·속담',모드클래스:'tp',연속정답수:0,즐겨찾기:true}];
      복습데이터.즐겨찾기=[]; 복습데이터.휴지통=[{id:'b1',단어:'어불성설',뜻:'뜻2',모드:'고사성어·속담',모드클래스:'tp',잔여일:7}];
      renderReview();`);
  const 대기열 = doc.getElementById('rvQueue'), 즐찾 = doc.getElementById('rvFav'), 휴지통 = doc.getElementById('rvBin');
  assert('C3: 대기열 카드 + 즐겨찾기 표시 + 복습 시작 버튼',
    대기열.querySelectorAll('.rv-item').length === 1 && 대기열.querySelector('.act-btn.fav.on') && /복습시작\(\)/.test(대기열.innerHTML));
  assert('C3: 빈 즐겨찾기는 안내 문구만', 즐찾.querySelectorAll('.rv-item').length === 0 && 즐찾.textContent.includes('즐겨찾기가 비어있습니다'));
  assert('C3: 휴지통 카드에 잔여일·복구 버튼·비우기 버튼',
    휴지통.textContent.includes('7일 후 삭제') && /휴지통_복구\('b1'\)/.test(휴지통.innerHTML) && /휴지통_전체비우기/.test(휴지통.innerHTML));

  // C14 휴지통 이동 공용 — 대기열 → 휴지통(잔여일 20)
  ev("대기열_휴지통이동('q1');");
  assert('C14: 수동 삭제가 휴지통으로 옮긴다(잔여일 20)',
    ev('복습데이터.대기열.length') === 0 && ev("복습데이터.휴지통.some(x=>x.단어==='가렴주구' && x.잔여일===20)"));

  // C6 선택 모달 공용 — 현재 항목 수보다 작은 상한은 흐리게(비활성)
  ev('사용자.복습대기열수=45; 사용자.복습대기열상한=50; openCapacity();');
  const 옵션 = [...doc.querySelectorAll('#selList .select-opt')];
  assert('C6: 상한 옵션 5개, 현재값 50에 선택 표시', 옵션.length === 5 && 옵션[2].classList.contains('on'));
  assert('C6: 45개보다 작은 30·40은 흐리게, 50은 정상', 옵션[0].style.opacity === '0.4' && 옵션[1].style.opacity === '0.4' && 옵션[2].style.opacity === '');
  ev('closeSelect(); openHistoryFilter();');
  assert('C6: 최근 출제 제외 옵션 문구', [...doc.querySelectorAll('#selList .select-opt')].map(e=>e.textContent.replace('✓','').trim()).join(',')
    === '사용 안함,최근 30개,최근 50개,최근 80개,최근 100개,최근 120개');
  ev('closeSelect();');

  // C10 채팅 기록 보관 공용 — 30개 초과 시 가장 오래된 것부터 정리
  ev(`현재UID=null; 채팅기록=[]; for(let i=0;i<31;i++) 채팅기록_보관({카테고리:'일반', 시작시각:i, 메시지:[{역할:'나',내용:'q'+i}]});`);
  assert('C10: 기록은 30개만 유지(가장 오래된 것 삭제)', ev('채팅기록.length') === 30 && ev('채팅기록[0].시작시각') === 1);
  assert('C10: 게스트는 정리된 30개를 로컬에 저장', JSON.parse(window.localStorage.getItem('plx_채팅기록')).length === 30);

  // C10 창조주 중도 포기 — 상태 해제 + 입력창 복구 + 채팅창 초기화
  ev(`창조주진행중=true; 창조주단계=3; document.getElementById('askInputArea').style.display='none';
      document.getElementById('askBody').innerHTML='<div>시나리오</div>'; closeAsk();`);
  assert('C10: 중도 포기 시 시나리오 상태 해제', ev('창조주진행중') === false && ev('창조주단계') === 0);
  assert('C10: 입력창 복구 + 인사말로 초기화', doc.getElementById('askInputArea').style.display === '' && doc.querySelector('#askBody .ask-msg.ai'));

  // C20 사전 결과 — 동음이의어 그룹 번호는 ①② (U+2460~)
  const 사전 = ev(`사전결과_HTML({뜻풀이그룹:[{뜻풀이:['뜻 가']},{뜻풀이:['뜻 나','뜻 다']}]})`);
  assert('C20: 그룹 번호 ①②, 그룹 안은 1. 2.', 사전.includes('<b>①</b> 1. 뜻 가') && 사전.includes('<b>②</b> 1. 뜻 나<br>2. 뜻 다'));
  assert('C20: 키 정규화 — CRLF·CR·빈 줄·양끝 공백 정리', ev(`키정규화(' 가 \\r\\n\\r나\\n\\n 다')`) === '가\n나\n다');

  // C18 구어 교정 탭 전환
  ev("switchSpkMode('voice');");
  assert('C18: 음성 탭 — 버튼·영역 전환', doc.getElementById('spkMVoice').classList.contains('on') && !doc.getElementById('spkMText').classList.contains('on')
    && doc.getElementById('spkVoiceArea').style.display === 'block' && doc.getElementById('spkTextArea').style.display === 'none');
  ev("switchSpkMode('text');");
  assert('C18: 텍스트 탭으로 복귀', doc.getElementById('spkMText').classList.contains('on') && doc.getElementById('spkTextArea').style.display === 'block');

  process.exit(finish() > 0 ? 1 : 0);
});

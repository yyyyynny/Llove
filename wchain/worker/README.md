# 우리말샘 Worker — 배포 안내

`wchain/Worker_수정요청.md`에 정리된 결함(① 붙임표 오판 ② 후보 부족)을 반영한 Cloudflare
Worker 전체 코드입니다. 이 폴더는 참고·배포용이며, `wchain/js/*.js`(게임 클라이언트)와는
별도로 **Cloudflare 쪽에 직접 배포**해야 적용됩니다.

**✅ 2026-08-15 실배포로 검증 완료** — 가마솥·뽕나무 존재 확인 정상, '사' 후보 107건·
'기' 후보 89건(종전 2~4건에서 대폭 개선).

**⚠️ 2026-08-19 계약 추가** — 단어 존재 조회 응답에 `뜻풀이그룹` 필드가 새로 추가됐습니다
(동음이의어별로 뜻풀이를 묶은 배열). `Llove/js/사전.js`의 사전 뜻풀이 기능과
`wchain/js/서바이벌.js`의 "이의 있음" 재설계가 이 필드에 의존합니다.

**🔧 2026-08-19 2차 수정(실측 완료, 재배포 필요)** — 1차 배포분(target_code 우선)도 여전히
1그룹으로 뭉쳐 나와서, `디버그:true`로 원본 opendict 응답을 직접 받아봤습니다. 확인된 실제
구조:
```json
{ "word": "필연", "sense": [{ "definition": "...", "origin": "必然", "target_code": "549241", "sense_no": "001", "pos": "명사" }] }
```
`target_code`·`sense_no`는 **표제어가 아니라 sense(뜻풀이) 하나하나의 고유값**이라 필연=必然의
명사·부사 두 뜻조차 서로 다른 값을 가짐 — 그룹 키로 쓸 수 없었던 것. 실제로 동음이의어를
구분하는 필드는 `sense.origin`(한자 등 어원)이었습니다. 그룹화 로직을 `origin` 기준으로
바꿨고, 로컬에서 위 실측 데이터로 재현 테스트해 필연 → 必然(2뜻)/筆硯(1뜻) 2그룹으로 정확히
갈리는 것까지 확인했습니다. **✅ 재배포 후 실측 완료** — "필연" 실제 배포 응답에서 2그룹으로
정확히 갈리는 것 확인.

**🆕 2026-08-19 3차(관리자님 승인) — 순우리말 동음이의어(눈=眼/雪 등)까지 분리.** `origin`은
한자어에만 있어서 순우리말 동음이의어는 여전히 한 그룹으로 뭉쳐 나왔습니다(같은 방법으로
"눈" 실측 확인). opendict의 `view` API(`target_type=view&method=target_code`)가 돌려주는
`group_code`(다의어 번호 — 동음이의어를 구분하는 진짜 고유 키, search API엔 없음)로 이 경우만
추가 조회합니다. 비용을 줄이기 위해: ① 어원 없는 뜻이 2개 이상일 때만 ② 서로 다른
`target_code`가 6개 이하일 때만(넘으면 조회를 포기하고 기존처럼 1그룹으로 안전 폴백)
③ 병렬로 조회합니다. 조회에 실패한 뜻은 다른 것과 잘못 합치지 않고 고립시킵니다. 로컬
회귀 테스트(`tests/test-worker-뜻풀이그룹화.cjs`, 10건)로 정상 케이스·상한 초과·조회 실패
3가지를 전부 검증했습니다 — **재배포 필요**(view API 실측은 배포 후 아래 ④번으로).

**🆕 2026-08-20 4차(관리자님 제보 기반, 재배포 필요) — 후보 품질 필터.** 제보: "난이도가
낮은데도 어려운 한자어·북한어·옛말을 쓰고, 초등학교 이름 같은 고유명사도 나온다." `단어`
조회의 `디버그:true`(이미 배포돼 있어 재배포 없이 바로 조회 가능)로 실제 후보 여러 개를
직접 열어본 결과:

| 단어 | `type` | `cat` | 정체 |
|---|---|---|---|
| 직승기 | 북한어 | – | '헬리콥터'의 북한어 |
| 즈믄 | 옛말 | – | '천(千)'의 옛말 |
| 초가슭 | 방언 | – | '초가을'의 방언 |
| 초가팔리 | 일반어 | 지명 | 경기도 포천시의 지명 |
| 초가속 | 일반어 | 책명 | 2020년 간행된 책 제목 |
| 초가청전신 | 일반어 | 정보·통신 | 전문 통신 용어 |
| 초가치마케팅 | 일반어 | 경영 | 마케팅 신조어 |
| 동무(대조군) | 일반어 | – | 흔한 단어(포함되어야 함) |

`type`만으로는 안 걸러진다는 게 핵심 발견입니다 — 지명·책명·전문용어 상당수가 `type:"일반어"`
로 나오고, 대신 **`cat`(분야) 필드가 채워져 있으면** 십중팔구 전문 분야·고유명사입니다.
`후보목록조회()`에 `후보_부적절한가()` 필터 추가: 표제어의 **첫 sense**가
`type ∈ {북한어,옛말,방언}` 이거나 `cat`이 있으면 제외. 다의어(동무처럼 흔한 뜻과 특수 분야
뜻이 섞인 단어)는 첫 sense만 보므로 흔한 뜻이 먼저면 그대로 포함됩니다. 요청에
`디버그:true`를 같이 보내면 걸러진 표본(`_걸러진표본`, 최대 20개)을 받아볼 수 있어 필터
기준이 또 안 맞을 때 재배포 없이 원인을 볼 수 있습니다. 로컬 회귀 테스트
(`tests/test-worker-후보필터.cjs`, 16건, 위 표 그대로 고정 데이터로 검증)로 확인했습니다 —
**재배포 필요**(재배포 후 실측은 아래 ⑤번으로).

## 이 Worker가 고치는 것

| 문제 | 대응 |
|---|---|
| ① 붙임표(`가마-솥`)가 있는 정상 단어가 "없는 단어" 오답 | 정확 검색이 실패하면 가능한 위치에 붙임표를 끼운 변형을 **Worker가 병렬로** 재시도 |
| ② 후보가 글자당 2~10개뿐이라 5수 만에 게임이 막힘 | 진짜 원인은 `num` 값이 아니라 필터 — 붙임표 든 항목을 버리지 않고 **정규화해서 포함**. 최대 3페이지(300개)까지 병렬 조회 |
| ③ 표제어 순 정렬로 희귀어가 앞쪽에 몰림 | (급하지 않음 — 손대지 않음, 아래 "남은 일" 참조) |
| ④ 난이도 낮은데도 북한어·옛말·방언·전문용어·고유명사가 섞여 나옴 | `type`/`cat` 필드로 후보 단계에서 걸러냄(4차 수정, 위 표 참조) |

## 배포 방법 (Cloudflare 대시보드)

1. Cloudflare 대시보드 → Workers & Pages → 기존 `urimalsaem-llove` Worker 선택.
2. **Edit code** → 이 폴더의 `우리말샘-worker.mjs` 내용 전체를 복사해 붙여넣기.
   - 파일 상단이 `export default { async fetch(request, env) {...} }` 형태(ES Module)인지
     확인하세요(Service Worker 문법이 아닙니다).
3. **Settings → Variables and Secrets** — `URIMALSAEM_KEY`(인증키)·`URIMALSAEM_CERTKEY_NO`
   (발급번호) 두 개가 이미 Secret으로 등록돼 있으면 새로 등록할 것 없이 그대로 씁니다.
   둘 다 있어야 동작합니다(하나만으로는 API가 "Unregistered key"로 거부합니다).
4. **Deploy**.

CLI(`wrangler`)로 배포하려면 `wrangler.toml.example`을 참고해 `wrangler.toml`을 만들고
`npx wrangler deploy` 후 두 시크릿을 등록하세요(이미 등록돼 있다면 건너뛰어도 됩니다):
```
npx wrangler secret put URIMALSAEM_KEY
npx wrangler secret put URIMALSAEM_CERTKEY_NO
```

## 배포 후 확인

```bash
# ① 붙임표 — true 가 나와야 함
curl -s -X POST https://urimalsaem-llove.hypoqwer.workers.dev/ \
  -H 'Content-Type: application/json' -H 'Origin: https://yyyyynny.github.io' \
  -d '{"단어":"가마솥"}'

# ② 후보 개수 — 수십~수백 개가 나와야 함
curl -s -X POST https://urimalsaem-llove.hypoqwer.workers.dev/ \
  -H 'Content-Type: application/json' -H 'Origin: https://yyyyynny.github.io' \
  -d '{"글자":"사","방향":"start"}'

# ③ 동음이의어 그룹 — "필연" 조회 시 뜻풀이그룹이 2개 이상(必然/筆硯)이어야 함.
curl -s -X POST https://urimalsaem-llove.hypoqwer.workers.dev/ \
  -H 'Content-Type: application/json' -H 'Origin: https://yyyyynny.github.io' \
  -d '{"단어":"필연"}'

# ③-b 그래도 1개짜리 그룹만 나오면(또는 뜻풀이그룹이 빈 배열이면) 디버그:true로 원본을 본다.
#     _원본진단[].target_code / sup_no / sense 가 실제로 어떤 이름·모양인지 확인해서
#     우리말샘-worker.mjs의 뜻풀이_그룹화_비동기() 그룹 키 로직을 그 이름으로 고치면 됨.
curl -s -X POST https://urimalsaem-llove.hypoqwer.workers.dev/ \
  -H 'Content-Type: application/json' -H 'Origin: https://yyyyynny.github.io' \
  -d '{"단어":"필연","디버그":true}'

# ④ 순우리말 동음이의어 — "눈" 조회 시 뜻풀이그룹이 2개 이상(眼/雪 등)이어야 함(view API
#    실측, 왕복이 하나 더 늘어 ③보다 응답이 조금 더 걸릴 수 있음 — 정상).
curl -s -X POST https://urimalsaem-llove.hypoqwer.workers.dev/ \
  -H 'Content-Type: application/json' -H 'Origin: https://yyyyynny.github.io' \
  -d '{"단어":"눈"}'

# ⑤ 후보 품질 필터 — "초"로 시작하는 후보에 '초가청전신'·'초가팔리' 같은 전문용어/지명이
#    더 이상 없어야 함. 개수도 필터 전(46개)보다 줄어든 게 정상.
curl -s -X POST https://urimalsaem-llove.hypoqwer.workers.dev/ \
  -H 'Content-Type: application/json' -H 'Origin: https://yyyyynny.github.io' \
  -d '{"글자":"초","방향":"start"}'

# ⑤-b 필터가 이상하게 동작하면(흔한 단어가 사라지는 등) 디버그:true로 걸러진 표본을 본다.
curl -s -X POST https://urimalsaem-llove.hypoqwer.workers.dev/ \
  -H 'Content-Type: application/json' -H 'Origin: https://yyyyynny.github.io' \
  -d '{"글자":"초","방향":"start","디버그":true}'
```

`-H 'Origin: ...'`을 빼고 호출하면(예: Cloudflare 대시보드의 자체 테스트 도구) CORS 허용
목록에 없는 origin으로 보고 403을 돌려줍니다(공용 프록시 남용 방지 — `우리말샘-worker.mjs`의
`허용_ORIGIN` 참조). 게임 도메인이 `https://yyyyynny.github.io`가 아니라면(커스텀 도메인 등)
그 값을 이 집합에 추가해야 실제 플레이 화면에서 정상 동작합니다.

## 클라이언트 쪽 후속 정리 (선택)

- `wchain/js/국어원.js`의 `붙임표_변형()` 클라이언트 재시도 폴백은 이 Worker가 같은 일을
  이미 대신하므로 이중 안전망일 뿐입니다. 걷어내도 되고, 안전망으로 남겨 둬도 무방합니다.
- 후보 캐시 키를 `plx_잇는_국어원후보캐시_v3`로 올렸습니다(2026-08-20, 후보 필터 추가로
  v2에 남아 있던 필터 전 결과를 무시시키기 위함). Worker 응답 형태를 또 바꾸면 그때 버전을
  한 번 더 올리세요.

## 남은 일 (급하지 않음)

- ③ 희귀어 편중: 오픈API에 인기순 정렬 옵션이 있는지 확인이 필요합니다(공식 문서에 명확히
  없어 이번 구현엔 반영하지 않았습니다). 없다면 Worker가 받은 후보를 셔플해서 보내는 정도가
  차선책이고, 클라이언트의 `난이도_슬라이스`(표제어 순 앞쪽 = 흔한 말이라는 전제)가 그 경우
  무의미해지니 같이 재검토가 필요합니다. (4차 후보 필터로 전문용어·고유명사는 걸러지지만,
  "흔하지만 빈도가 낮은 표준어"까지 앞쪽에 몰리는 문제는 여전히 남아 있음.)
- 순우리말 동음이의어(눈·배·밤 등, 3차)와 마찬가지로, 후보 필터(4차)도 `cat`이 있는 표제어를
  통째로 빼는 방식이라 "흔한 뜻 + cat 있는 뜻"이 섞인 다의어 중 **흔한 뜻이 두 번째 이후에
  오는 경우**는 억울하게 빠질 수 있습니다(실측 범위에선 못 봤지만 이론상 가능 — 순위가 뒤집힌
  사례를 보시면 알려주세요, 첫 sense 대신 "sense 중 하나라도 일반이면 포함"으로 완화 가능).

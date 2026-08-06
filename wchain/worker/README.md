# 우리말샘 Worker — 배포 안내

`wchain/Worker_수정요청.md`에 정리된 3가지 결함(① 붙임표 오판 ② 후보 부족 ③ 희귀어 편중)을
반영해 새로 작성한 Cloudflare Worker 전체 코드입니다. 이 폴더는 참고·배포용이며,
`wchain/js/*.js`(게임 클라이언트)와는 별도로 **Cloudflare 쪽에 직접 배포**해야 적용됩니다.

## 이 Worker가 고치는 것

| 문제 | 이 코드의 대응 |
|---|---|
| ① 붙임표(`가마-솥`)가 있는 정상 단어가 "없는 단어" 오답 | 정확 검색이 실패하면 가능한 위치에 붙임표를 끼운 변형을 **Worker가 병렬로** 재시도(클라이언트는 1홉만 왕복) |
| ② 후보가 글자당 2~10개뿐이라 5수 만에 게임이 막힘 | **진짜 원인은 num이 아니라 필터** — 예전 코드는 `num=100`을 이미 쓰고 있었지만 붙임표 든 항목을 그대로 버려서(합성어가 대부분이라) 실제로는 2~10개만 남았다. 버리지 않고 **정규화해서 포함**시키는 걸로 해결. 여기에 최대 3페이지(300개)까지 병렬 조회도 추가 |
| ③ 표제어 순 정렬로 희귀어가 앞쪽에 몰림 | (급하지 않음 — 이 코드에서는 손대지 않음, 아래 "남은 일" 참조) |

> ⚠️ **정정 이력**: 이 코드의 첫 버전은 `URIMALSAEM_CERTKEY_NO`를 빠뜨려 배포 후 "서버 설정
> 오류"만 반환했습니다. 이 API는 `key`(인증키) 하나만으로는 안 되고 발급 시 같이 받은
> `certkey_no`를 함께 보내야 정상 응답합니다 — 지금 버전은 압축 이전 대화에서 실제로 검증까지
> 마쳤던 예전 구현을 근거로 두 값을 모두 사용하도록 고쳤습니다.

## 배포 방법 (Cloudflare 대시보드 — 가장 간단)

1. Cloudflare 대시보드 → Workers & Pages → 기존 `urimalsaem-llove` Worker 선택 (또는 신규 생성).
2. **Edit code** → 이 폴더의 `우리말샘-worker.mjs` 내용 전체를 복사해 붙여넣기.
   - 파일 상단에 `export default { async fetch(request, env) {...} }` 형태(ES Module)입니다.
     대시보드 에디터가 "Module Worker"로 인식하는지 확인하세요(Service Worker 문법이 아닙니다).
3. **Settings → Variables and Secrets** — 이미 `URIMALSAEM_KEY`·`URIMALSAEM_CERTKEY_NO`
   두 개가 Secret으로 등록돼 있다면 **그대로 재사용됩니다**(코드가 `env.URIMALSAEM_KEY`와
   `env.URIMALSAEM_CERTKEY_NO`를 둘 다 읽습니다 — 이 API는 인증키 하나만으로는 안 되고 발급
   시 같이 받은 번호를 함께 보내야 정상 응답합니다). 새로 등록할 것 없습니다.
   변수 이름이 다르다면 코드에서 이 두 이름이 나오는 부분을 실제 이름에 맞게 바꾸세요.
4. **Deploy**.

CLI(`wrangler`)로 배포하려면 `wrangler.toml.example`을 참고해 `wrangler.toml`을 만들고
`npx wrangler deploy` 후 아래 두 시크릿을 등록하세요(이미 등록돼 있다면 건너뛰어도 됩니다):
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

# ② 후보 개수 — 수십~수백 개가 나와야 함(종전 '사' 2개 → 확인)
curl -s -X POST https://urimalsaem-llove.hypoqwer.workers.dev/ \
  -H 'Content-Type: application/json' -H 'Origin: https://yyyyynny.github.io' \
  -d '{"글자":"사","방향":"start"}'
```

`-H 'Origin: ...'`을 빼고 호출하면 이 Worker는 CORS 허용 목록에 없는 origin으로 보고
403을 돌려줍니다(공용 프록시가 다른 사이트에 무단으로 쓰이는 것을 막기 위한 의도된 동작 —
`우리말샘-worker.mjs`의 `허용_ORIGIN` 참조). 게임이 실제로 서비스되는 도메인이
`https://yyyyynny.github.io` 가 아니라면(예: 커스텀 도메인을 쓰는 경우) 그 값을 이 집합에
추가해야 실제 플레이 화면에서 정상 동작합니다.

## 클라이언트 쪽 후속 정리 (배포·검증 후에만)

- `wchain/js/국어원.js`의 `붙임표_변형()` 클라이언트 재시도 폴백은 이 Worker가 같은 일을
  대신하므로 더 이상 필요 없습니다. 실배포로 ①이 확인되면 걷어내도 됩니다(지금은 이중 안전망으로
  그대로 둡니다 — Worker 배포 전까지는 이게 유일한 방어선입니다).
- 후보 캐시 키(`plx_잇는_국어원후보캐시_v2`)는 Worker 응답이 바뀌면 버전을 한 번 더 올리세요
  (`_v3` 등) — 안 그러면 사용자 기기에 남은 옛(빈약한) 캐시가 계속 쓰입니다.

## 남은 일 (급하지 않음)

- ③ 희귀어 편중: 오픈API에 인기순 정렬 옵션이 있는지 확인이 필요합니다(문서에 명확히 없어
  이번 구현엔 반영하지 않았습니다). 없다면 Worker가 받은 후보를 셔플해서 보내는 정도가 차선책이고,
  클라이언트의 `난이도_슬라이스`(표제어 순 앞쪽 = 흔한 말이라는 전제)가 그 경우 무의미해지니
  같이 재검토가 필요합니다.

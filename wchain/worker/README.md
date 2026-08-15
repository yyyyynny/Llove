# 우리말샘 Worker — 배포 안내

`wchain/Worker_수정요청.md`에 정리된 결함(① 붙임표 오판 ② 후보 부족)을 반영한 Cloudflare
Worker 전체 코드입니다. 이 폴더는 참고·배포용이며, `wchain/js/*.js`(게임 클라이언트)와는
별도로 **Cloudflare 쪽에 직접 배포**해야 적용됩니다.

**✅ 2026-08-15 실배포로 검증 완료** — 가마솥·뽕나무 존재 확인 정상, '사' 후보 107건·
'기' 후보 89건(종전 2~4건에서 대폭 개선).

## 이 Worker가 고치는 것

| 문제 | 대응 |
|---|---|
| ① 붙임표(`가마-솥`)가 있는 정상 단어가 "없는 단어" 오답 | 정확 검색이 실패하면 가능한 위치에 붙임표를 끼운 변형을 **Worker가 병렬로** 재시도 |
| ② 후보가 글자당 2~10개뿐이라 5수 만에 게임이 막힘 | 진짜 원인은 `num` 값이 아니라 필터 — 붙임표 든 항목을 버리지 않고 **정규화해서 포함**. 최대 3페이지(300개)까지 병렬 조회 |
| ③ 표제어 순 정렬로 희귀어가 앞쪽에 몰림 | (급하지 않음 — 손대지 않음, 아래 "남은 일" 참조) |

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
```

`-H 'Origin: ...'`을 빼고 호출하면(예: Cloudflare 대시보드의 자체 테스트 도구) CORS 허용
목록에 없는 origin으로 보고 403을 돌려줍니다(공용 프록시 남용 방지 — `우리말샘-worker.mjs`의
`허용_ORIGIN` 참조). 게임 도메인이 `https://yyyyynny.github.io`가 아니라면(커스텀 도메인 등)
그 값을 이 집합에 추가해야 실제 플레이 화면에서 정상 동작합니다.

## 클라이언트 쪽 후속 정리 (선택)

- `wchain/js/국어원.js`의 `붙임표_변형()` 클라이언트 재시도 폴백은 이 Worker가 같은 일을
  이미 대신하므로 이중 안전망일 뿐입니다. 걷어내도 되고, 안전망으로 남겨 둬도 무방합니다.
- 후보 캐시 키(`plx_잇는_국어원후보캐시_v2`)는 배포 확인이 끝난 지금부터는 새 결과가 쌓이니
  그대로 두면 됩니다. Worker 응답 형태를 또 바꾸면 그때 버전을 한 번 더 올리세요.

## 남은 일 (급하지 않음)

- ③ 희귀어 편중: 오픈API에 인기순 정렬 옵션이 있는지 확인이 필요합니다(공식 문서에 명확히
  없어 이번 구현엔 반영하지 않았습니다). 없다면 Worker가 받은 후보를 셔플해서 보내는 정도가
  차선책이고, 클라이언트의 `난이도_슬라이스`(표제어 순 앞쪽 = 흔한 말이라는 전제)가 그 경우
  무의미해지니 같이 재검토가 필요합니다.

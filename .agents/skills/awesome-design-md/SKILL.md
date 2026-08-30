---
name: awesome-design-md
description: Curated collection of real product design-system references (DESIGN.md) for 74 well-known brands — Apple, Stripe, Linear, Notion, Claude, Vercel, Tesla, Ferrari, etc. Use when the user asks for a specific brand's look/feel ("스트라이프처럼", "애플 감성으로"), wants concrete inspiration for typography/color/spacing decisions, or wants to compare how different real products approach the same UI pattern. Not a style to force by default — only read a file when the user names or implies a brand, or explicitly wants inspiration browsing.
metadata:
  source: https://github.com/VoltAgent/awesome-design-md (MIT License, see ./LICENSE)
  version: "1.0.0"
---

# Awesome Design MD — 실제 브랜드 디자인 시스템 참고 자료

74개 유명 브랜드의 실제(또는 그와 아주 흡사하게 역설계된) 디자인 시스템 문서 모음이다.
각 폴더에 `DESIGN.md`(색상·타이포·간격·컴포넌트 규칙)와 `README.md`(출처 메모)가 있다.

**이건 "이렇게 만들어라"는 강제 지침이 아니라 참고 자료다.** 필요할 때만 해당 브랜드
폴더의 `DESIGN.md`를 읽어서 구체적인 수치·어휘를 가져다 쓴다.

## 언제 쓰나

- 사용자가 특정 브랜드 감성을 명시적으로 요청할 때 ("노션처럼", "스트라이프 느낌으로")
- 특정 UI 패턴(예: 결제 폼, 대시보드 카드)을 여러 실제 서비스가 어떻게 푸는지 비교하고 싶을 때
- 막연히 "더 고급스럽게"가 아니라 구체적인 방향이 필요할 때 후보를 제시하는 용도로

## 사용법

```
Read .agents/skills/awesome-design-md/design-md/<브랜드>/DESIGN.md
```

## 목록 (74개, 폴더명 = 브랜드)

**AI/LLM**: claude, cohere, elevenlabs, minimax, mistral.ai, ollama, opencode.ai, replicate,
runwayml, together.ai, voltagent, x.ai

**개발자 도구**: cursor, expo, lovable, raycast, superhuman, vercel, warp

**백엔드/DB/DevOps**: clickhouse, composio, hashicorp, mongodb, posthog, sanity, sentry, supabase

**생산성/SaaS**: cal, intercom, linear.app, mintlify, notion, resend, zapier

**디자인 도구**: airtable, clay, figma, framer, miro, webflow

**핀테크/크립토**: binance, coinbase, kraken, mastercard, revolut, wise

**커머스/리테일**: airbnb, meta, nike, shopify, starbucks

**미디어/컨슈머 테크**: apple, hp, ibm, nvidia, pinterest, playstation, spacex, spotify,
theverge, uber, vodafone, wired

**자동차**: bmw, bmw-m, bugatti, ferrari, lamborghini, renault, tesla

**레트로**: dell-1996, nintendo-2001

**기타**: slack, stripe

## ⚠️ 이 저장소(Llove/wchain)에 적용할 때 주의

CLAUDE.md 원칙이 항상 우선한다 — **새 CSS 변수·클래스명·임의 색상값 도입 금지, 기존
디자인 토큰(`--bg`, `--acc` 등)과 기존 컴포넌트 클래스만 사용.** 여기 브랜드 문서에서
색상 코드나 폰트를 그대로 가져오면 안 된다. 참고할 건 **레이아웃 사고방식·간격 감각·
타이포 위계 같은 원칙**이지, 실제 값이 아니다.

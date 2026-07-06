// 세션7 항목3: 앱 전체 기본 글씨 +10% — <style> 블록의 font-size(px)를 일괄 ×1.1(반올림)
// - 원형/고정 배지·바텀 네비 등은 레이아웃 파손 위험이 있어 제외(화이트리스트)
// - calc(Npx*var(--글자배율)) 기준값도 함께 상향 → 글자 크기 옵션 100% = 새 기본
// - 1회성 스크립트: 실행 후 결과는 index.html에 반영되며, 기록용으로 scripts/에 보관
import { readFileSync, writeFileSync } from 'node:fs';

const 경로 = new URL('../index.html', import.meta.url);
const 원본 = readFileSync(경로, 'utf8');

const 시작 = 원본.indexOf('<style>');
const 끝 = 원본.indexOf('</style>');
if (시작 < 0 || 끝 < 0) { console.error('style 블록을 찾지 못함'); process.exit(1); }

const 제외셀렉터 = ['.nv-btn', '#g-bnav', '.onum', '.rv-idx', '.act-btn', '.toast', '.ob-dot'];
let 변경수 = 0, 제외수 = 0;

const 스타일 = 원본.slice(시작, 끝).split('\n').map(줄 => {
  if (!줄.includes('font-size')) return 줄;
  if (제외셀렉터.some(s => 줄.includes(s))) { 제외수++; return 줄; }
  return 줄
    .replace(/font-size:(\d+(?:\.\d+)?)px/g, (_, n) => { 변경수++; return `font-size:${Math.round(parseFloat(n) * 1.1)}px`; })
    .replace(/font-size:calc\((\d+(?:\.\d+)?)px\*/g, (_, n) => { 변경수++; return `font-size:calc(${Math.round(parseFloat(n) * 1.1)}px*`; });
}).join('\n');

writeFileSync(경로, 원본.slice(0, 시작) + 스타일 + 원본.slice(끝), 'utf8');
console.log(`완료 — font-size ${변경수}건 ×1.1 상향, 제외 ${제외수}줄 (${제외셀렉터.join(' ')})`);

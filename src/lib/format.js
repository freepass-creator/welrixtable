// 포맷터 SSOT — quote.js / build-quote-html.js / customer-view.js 공유
// 이전엔 각 파일이 같은 함수를 복사·재정의 → 변형 누적 → 일관성 파괴

export const fmt = (n) => new Intl.NumberFormat('ko-KR').format(Math.round(n || 0));
export const krw = (n) => `${fmt(n)}원`;

export function fmtTel(tel) {
  if (!tel) return '';
  const d = String(tel).replace(/\D/g, '');
  if (!d) return '';
  if (/^01[016789]/.test(d)) {
    if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  }
  if (d.startsWith('02')) {
    if (d.length === 10) return `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6)}`;
    if (d.length === 9)  return `${d.slice(0,2)}-${d.slice(2,5)}-${d.slice(5)}`;
  }
  if (/^0[3-6]/.test(d)) {
    if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
  }
  if (d.length === 8 && /^1[5-9]/.test(d)) return `${d.slice(0,4)}-${d.slice(4)}`;
  return tel;
}

export function guessColor(name) {
  if (!name) return '#e5e5e5';
  const n = name.toLowerCase();
  if (n.includes('블랙') || n.includes('어비스') || n.includes('잉크')) return '#1a1a1a';
  if (n.includes('화이트') || n.includes('아틀라스') || n.includes('스노우')) return '#f5f5f5';
  if (n.includes('펄')) {
    if (n.includes('블루') || n.includes('네이비')) return '#3a5d8f';
    if (n.includes('레드') || n.includes('적')) return '#a83232';
    return '#e8e6e1';
  }
  if (n.includes('그레이') || n.includes('그래핀') || n.includes('실버')) return '#9aa0a6';
  if (n.includes('블루') || n.includes('네이비') || n.includes('스카이')) return '#3a5d8f';
  if (n.includes('레드') || n.includes('적') || n.includes('루비')) return '#a83232';
  if (n.includes('그린') || n.includes('미라지') || n.includes('세이지')) return '#4a6d4e';
  if (n.includes('베이지') || n.includes('샌드')) return '#c9b896';
  if (n.includes('브라운') || n.includes('초콜릿')) return '#5c3d28';
  if (n.includes('매트')) return '#444';
  if (n.includes('투톤')) return 'linear-gradient(90deg, #1a1a1a 50%, #e8e6e1 50%)';
  if (n.includes('아마존')) return '#5a6b58';
  if (n.includes('사이버')) return '#4a4f5a';
  if (n.includes('에코트로닉')) return '#7d8a93';
  return '#9aa0a6';
}

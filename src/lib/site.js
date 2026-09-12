// 손님용 공개 경로 SSOT — 문자 광고로 나가는 짧은 링크들.
// 브랜드/사업자 정보는 여기 두지 않음 — company-config/welrix.json (company_info) 이 SSOT.
// 손님에게 노출되는 모든 화면(광고 페이지·견적서·상담 폼)은 항상 웰릭스 모빌리티 브랜드로 나간다.

export const PATH = {
  ad: '/s',        // 문자 광고 랜딩 (home.html)
  vehicles: '/v',   // 차량 가이드 인덱스 (vehicles.html)
  privacy: '/p',    // 개인정보처리방침 (privacy.html)
  guide: (slug) => `/g/${encodeURIComponent(slug)}`,  // 차종 상세 (guide.html?slug=)
};

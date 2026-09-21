const clamp=(n)=>Math.max(0,Math.min(255,Math.round(n)));
const rgb=(hex)=>{
  const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex||'').trim());
  return m?[parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)]:null;
};
const hex=(a)=>'#'+a.map(v=>clamp(v).toString(16).padStart(2,'0')).join('');
const shade=(c,p)=>{const a=rgb(c);return a?hex(a.map(v=>v*(1+p))):c};
const mixWhite=(c,p)=>{const a=rgb(c);return a?hex(a.map(v=>v+(255-v)*p)):c};

export function applyProductTheme(cfg={}){
  const root=document.documentElement;
  const theme=cfg.ui_theme||{};
  const brand=theme.primary_color||cfg.brand_color_logo||cfg.brand_color||'#1B2A4A';
  root.dataset.brandTheme=theme.id||cfg.company_id||'freepass';
  root.style.setProperty('--brand',brand);
  root.style.setProperty('--brand-700',theme.strong_color||shade(brand,-0.18));
  root.style.setProperty('--brand-800',theme.strongest_color||shade(brand,-0.30));
  root.style.setProperty('--brand-100',theme.soft_border_color||mixWhite(brand,0.82));
  root.style.setProperty('--brand-50',theme.soft_color||mixWhite(brand,0.94));
  root.style.setProperty('--accent',brand);
  root.style.setProperty('--accent-soft',theme.soft_color||mixWhite(brand,0.94));
  root.style.setProperty('--partner-accent',theme.partner_accent||brand);
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content',brand);
}

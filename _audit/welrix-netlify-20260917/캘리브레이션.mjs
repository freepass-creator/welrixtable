import fs from 'fs';
import { calcQuote, setCompanyConfig } from 'file:///C:/dev/welrixtable/src/lib/calc.js';
const base=JSON.parse(fs.readFileSync('C:/dev/welrixtable/public/data/company-config/welrix.json','utf8'));
const D=JSON.parse(fs.readFileSync('C:/dev/welrixtable/src/data/vehicles.json','utf8'));
const O=Array.isArray(D)?D:(D.vehicles||[]);
// ★공백·밑줄을 «먼저» 없앤 다음 세대 머리표를 뗀다 (더_뉴_투싼 때문에 순서가 중요)
const 정규=s=>String(s||'').replace(/[ \u00b7,()_\-]/g,'').toUpperCase()
  .replace(/디올뉴|더뉴|올뉴|신형|THENEW|ALLNEW|NEW/g,'');
const 찾=m=>{const k=정규(m); return O.find(v=>정규(`${v.name} ${v.trim}`)===k)||O.find(v=>정규(v.trim)===k);};
const 표본=[
  ['캐스퍼 1.0 가솔린 스마트',               15460000, [398000,427000,487000]],
  ['쏘나타 디 엣지 1.6 터보 가솔린 Premium',  29330000, [648000,697000,796000]],
  ['더 뉴 투싼 1.6 가솔린 터보 2WD Modern',  28440000, [623000,667000,759000]],
  ['G70 2.5 가솔린 터보 2WD 기본 모델',      45000000, [1076000,1193000,1422000]],
];
const 입력=(v,price,term)=>({
  vehicle:{...v,price},
  options:{optPrice:0,discount:0,deliveryFee:120000,itemsFee:285000,etc:0},
  contract:{term,km:'2만km',dep:10,pre:0},
  customer:{creditGrade:'중신용'},
  insurance:{property:'1억',extraDriver:'없음',exec:'미가입',injury:'무한',self:'1억',uninsured:'2억',deductible:'30만원~',emergency:'가입'},
  fees:{feeRatePct:5.0,svc:'웰스 Basic'},
});
표본.forEach(([m])=>{const v=찾(m); console.log((v?'✔':'✘'), m, '→', v? v.name+' '+v.trim : '못 찾음');});
const 재보=(mut)=>{const c=JSON.parse(JSON.stringify(base)); if(mut)mut(c.financial); setCompanyConfig(c);
  let s=0,최대=0,맞=0,총=0;
  for(const [m,price,웰] of 표본){const v=찾(m); if(!v) continue;
    [60,48,36].forEach((t,i)=>{const d=calcQuote(입력(v,price,t)).monthly-웰[i];
      s+=d*d;최대=Math.max(최대,Math.abs(d));if(d===0)맞++;총++;});}
  return {rms:Math.sqrt(s/총),최대,맞,총};};
const 후보=[];
for(let p=0;p<=0.02;p+=0.0001) 후보.push([`금리 ${((0.064+p)*100).toFixed(2)}%`, f=>f.credit_lookup['중신용'].interest+=p]);
for(let p=0;p<=0.02;p+=0.0001) 후보.push([`중신용 IRR ${((0.043+p)*100).toFixed(2)}%`, f=>f.credit_lookup['중신용'].profit+=p]);
for(let p=0;p<=0.01;p+=0.0001) 후보.push([`수리적립 ${((0.02+p)*100).toFixed(2)}%`, f=>f.costs.repair_rate_annual+=p]);
for(let p=0;p<=0.02;p+=0.0001) 후보.push([`신용가산 ${((0.025+p)*100).toFixed(2)}%`, f=>f.residuals.credit_premium['중신용']+=p]);
console.log('\n기준(무보정):', JSON.stringify(재보(null)));
const r=후보.map(([n,m])=>({n,...재보(m)})).sort((a,b)=>a.rms-b.rms||b.맞-a.맞);
console.log('\n── 9개 값을 맞추는 단일 보정 상위 10 ──');
r.slice(0,10).forEach(x=>console.log('  ',x.n.padEnd(22),'RMS',x.rms.toFixed(0).padStart(6),'· 최대오차',String(x.최대).padStart(6),'· 일치',x.맞+'/'+x.총));

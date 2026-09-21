import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import { normalizeExteriorPaint, restorePaintSelection } from '../src/lib/exterior-paint.js';
function db(){const c={window:{}};vm.runInNewContext(fs.readFileSync('public/welrix-db.js','utf8'),c);return c.window.VEHICLE_DB;}
test('all fifteen paint duplicates removed, source charges retained only in colors',()=>{
 const data=db();const moved=normalizeExteriorPaint(data);assert.equal(moved.length,15);
 for(const b of data.manufacturers)for(const m of b.models)for(const v of m.variants){
  if(!v._paint_options)continue;
  for(const [id,index] of Object.entries(v._paint_options)){
   assert.equal(v.options_master[id],undefined);assert.ok(v.trims.every(t=>!t.available_options.includes(id)));
   const source=moved.find(x=>x.model===m.model_id&&x.variant===v.variant_id&&x.id===id);
   assert.ok(v.trims.every(t=>t._exterior_colors[index].price===source.price));
  }
 }
 assert.equal(normalizeExteriorPaint(data).length,0);
});
test('legacy option becomes exterior selection without double charge',()=>{
 const data=db();normalizeExteriorPaint(data);const s={manufacturer:'kia',model:'k8',variant:'pt_가솔린_2_5',color:null,options:new Set(['o_e5f61a16521f'])};
 restorePaintSelection(data,s);assert.equal(s.options.size,0);assert.notEqual(s.color,null);
 const m=data.manufacturers.find(b=>b.manufacturer_id==='kia').models.find(m=>m.model_id==='k8');assert.equal(m.exterior_colors[s.color].name,'스노우 화이트 펄');
});
test('unselected color remains unselected',()=>{
 const data=db();normalizeExteriorPaint(data);const s={manufacturer:'kia',model:'k8',variant:'pt_가솔린_2_5',color:null,options:new Set()};restorePaintSelection(data,s);assert.equal(s.color,null);
});
test('explicit exterior wins over legacy paint option and other equipment remains',()=>{
 const data=db();normalizeExteriorPaint(data);const s={manufacturer:'kia',model:'k8',variant:'pt_가솔린_2_5',color:1,options:new Set(['o_e5f61a16521f','other-equipment'])};
 restorePaintSelection(data,s);assert.equal(s.color,1);assert.deepEqual([...s.options],['other-equipment']);
});
test('conflicting source price fails instead of silently replacing it',()=>{
 const data=db();const model=data.manufacturers.find(b=>b.manufacturer_id==='kia').models.find(m=>m.model_id==='k8');
 model.exterior_colors.find(c=>c.name==='스노우 화이트 펄').price=9;
 assert.throws(()=>normalizeExteriorPaint(data),/추가금 충돌/);
});
test('matte paint remains unavailable on trims without that option',()=>{
 const data=db();normalizeExteriorPaint(data);
 const model=data.manufacturers.find(b=>b.manufacturer_id==='kia').models.find(m=>m.model_name==='K8');
 const trims=model.variants[0].trims;
 assert.ok(trims.find(t=>t.name==='시그니처 블랙')._exterior_colors.find(c=>c.name==='문스케이프 매트 그레이')._paintUnavailable);
 assert.equal(trims.find(t=>t.name==='노블레스 라이트')._exterior_colors.find(c=>c.name==='문스케이프 매트 그레이').price,40);
});
test('multiple legacy paint selections require re-selection without crashing',()=>{
 const data=db();normalizeExteriorPaint(data);const model=data.manufacturers.find(b=>b.manufacturer_id==='kia').models.find(m=>m.model_name==='K8');const v=model.variants[0];
 const s={manufacturer:'kia',model:model.model_id,variant:v.variant_id,trim:v.trims[0].trim_id,color:null,options:new Set(Object.keys(v._paint_options))};
 restorePaintSelection(data,s);assert.equal(s.color,null);assert.equal(s.options.size,0);assert.match(s.colorNotice,/다시 선택/);
});
test('real request and provider payload charge selected paint once',async()=>{
 const data=db();normalizeExteriorPaint(data);globalThis.window={VEHICLE_DB:data};
 const {vehicleState,quoteState}=await import('../src/store.js');
 const {요청만들기}=await import('../src/lib/quote/build-request.js');
 const {요청을웰릭스몸통으로}=await import('../src/lib/quote/engines/welrix.js');
 const model=data.manufacturers.find(b=>b.manufacturer_id==='kia').models.find(m=>m.model_name==='K8'),v=model.variants[0],t=v.trims[0];
 Object.assign(vehicleState,{manufacturer:'kia',model:model.model_id,variant:v.variant_id,trim:t.trim_id});
 quoteState.vehicle={options_price_manwon:0};quoteState.cond.colorIntPrice=0;
 for(const [name,won] of [['스노우 화이트 펄',80000],['문스케이프 매트 그레이',400000],['아이보리 실버',0]]){
  vehicleState.color=t._exterior_colors.findIndex(c=>c.name===name);
  const request=요청만들기();assert.equal(request.차.옵션가,0);assert.equal(request.차.색추가금,won);
  assert.ok(요청을웰릭스몸통으로(request).inputs.every(x=>x.optionPrice===won));
 }
});

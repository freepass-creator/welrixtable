import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import { normalizeExteriorPaint, restorePaintSelection } from '../src/lib/exterior-paint.js';
function db(){const c={window:{}};vm.runInNewContext(fs.readFileSync('public/welrix-db.js','utf8'),c);return c.window.VEHICLE_DB;}
test('all nine paint duplicates removed, original eight-manwon charge retained only in color',()=>{
 const data=db();const moved=normalizeExteriorPaint(data);assert.equal(moved.length,9);
 for(const b of data.manufacturers)for(const m of b.models)for(const v of m.variants){
  if(!v._paint_options)continue;
  const id='o_e5f61a16521f';assert.equal(v.options_master[id],undefined);assert.ok(v.trims.every(t=>!t.available_options.includes(id)));
  assert.equal(m.exterior_colors[v._paint_options[id]].price*10000,80000);
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

// Display projection only: preserve supplier files; classify exact color-name options.
const key = name => String(name || '').replace(/\s+/g, '').toLowerCase();
export function normalizeExteriorPaint(db) {
  const moved = [];
  for (const brand of db?.manufacturers || []) for (const model of brand.models || []) {
    for (const [index, color] of (model.exterior_colors || []).entries()) {
      if (key(color.name) !== '스노우화이트펄') continue;
      const matches = (model.variants || []).flatMap(variant =>
        Object.entries(variant.options_master || {}).filter(([, opt]) => key(opt.name) === key(color.name))
          .map(([id, opt]) => ({variant, id, opt})));
      if (!matches.length) continue;
      const prices = new Set(matches.map(({opt}) => opt.price));
      if (prices.size !== 1 || !Number.isFinite([...prices][0])) throw new Error('외장색 추가금 불일치: ' + model.model_name + ' ' + color.name);
      const price = [...prices][0];
      if (color.price && color.price !== price) throw new Error('외장색 추가금 충돌: ' + model.model_name + ' ' + color.name);
      color.price = price;
      for (const {variant, id} of matches) {
        (variant._paint_options ||= {})[id] = index;
        for (const trim of variant.trims || []) trim.available_options = (trim.available_options || []).filter(opt => opt !== id);
        delete variant.options_master[id];
        moved.push({model:model.model_id, variant:variant.variant_id, id, color:color.name, price});
      }
    }
  }
  return moved;
}
export function restorePaintSelection(db, state) {
  const model = db?.manufacturers?.find(b => b.manufacturer_id === state.manufacturer)?.models?.find(m => m.model_id === state.model);
  const variant = model?.variants?.find(v => v.variant_id === state.variant);
  const paint = variant?._paint_options || {};
  const selectedPaint = [...(state.options || [])].filter(id => Object.hasOwn(paint,id));
  if (state.color == null && selectedPaint.length === 1) state.color = paint[selectedPaint[0]];
  if (state.color == null && selectedPaint.length > 1) throw new Error('공유 링크 외장색 중복 선택');
  for (const id of selectedPaint) state.options.delete(id);
}

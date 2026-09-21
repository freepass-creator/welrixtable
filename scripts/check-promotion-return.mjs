import assert from 'node:assert/strict';
import { promotionReturnUrl } from '../src/lib/promotion-return.js';
const origin = 'https://welrix-rent.web.app/';
assert.equal(promotionReturnUrl(), origin);
assert.equal(new URL(promotionReturnUrl('?returnCar=G80')).searchParams.get('차'), 'G80');
assert.equal(new URL(promotionReturnUrl('', origin + '?차=베뉴')).searchParams.get('차'), '베뉴');
for (const value of ['https://evil.example', '//evil.example', '../G80', 'G80<script>', 'UNKNOWN']) {
  assert.equal(promotionReturnUrl('?returnCar=' + encodeURIComponent(value)), origin);
}
assert.equal(promotionReturnUrl('', 'https://welrix-rent.web.app.evil.example/?차=G80'), origin);
assert.equal(promotionReturnUrl('', origin + 'other?차=G80'), origin);
assert.equal(promotionReturnUrl('?returnCar=G70', origin + '?차=G80'), origin + '?%EC%B0%A8=G70');
console.log('PASS promotion return: fixed origin, allowlist, direct/referrer fallback');

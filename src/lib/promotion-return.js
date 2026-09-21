const promotionOrigin = 'https://welrix-rent.web.app';
const models = new Set(['캐스퍼','아반떼','쏘나타','그랜저','코나','투싼','베뉴','싼타페','팰리세이드','포터2','모닝','레이','K5','K8','K9','셀토스','니로','스포티지','쏘렌토','카니발','G70','G80','G90','GV70','GV80']);

// Return destinations are constructed locally; never navigate to an arbitrary supplied URL.
export function promotionReturnUrl(search = '', referrer = '') {
  const target = new URL('/', promotionOrigin);
  let car = new URLSearchParams(search).get('returnCar');
  if (!models.has(car)) {
    try {
      const previous = new URL(referrer);
      if (previous.origin === promotionOrigin && previous.pathname === '/') car = previous.searchParams.get('차');
    } catch { /* Direct entry returns to the promotion list. */ }
  }
  if (models.has(car)) target.searchParams.set('차', car);
  return target.href;
}

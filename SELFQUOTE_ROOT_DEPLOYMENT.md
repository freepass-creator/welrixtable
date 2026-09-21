# Self quote root deployment — 2026-09-21

User-selected source: c92ea9236697365e746309ed607068bd3ee343dc (preview dpl_FwTuW4DrjBYB1ESY6MeYDA2khkWF).
Root index now serves the selected mobile estimator on all viewport sizes. Original desktop entry preserved as desktop.html and included in Vite build. Direct mobile.html desktop redirect points to desktop.html.

Verified preview: dpl_79KXnNVJaoW8R8c1YxxZ3giUQfPm.
Production promotion: dpl_EbCqZGJ1L5XdzHRUGYG8xcSe1zWE.
Prior production rollback target: dpl_HUzmUZ9BNX551MRTtzWstK7p9eHc.

Validation: Vercel build passed; root mobile manufacturer selection and Hyundai model navigation passed in preview. Production https://welrixtable.vercel.app/ confirmed in browser: mobile manufacturer selection (Hyundai/Kia/Genesis), URL remains root. API source unchanged from user-selected preview; full quote calculation not regression-tested.
Cursor review identified static index taking precedence over rewrite; reproduced then resolved by mobile index and preserved desktop entry. Claude weekly limit and Gemini auth 403 remained unavailable, not PASS.
Dependency installation reported six existing audit findings; dependencies were not upgraded in this routing change.
Original C:/dev/welrixtable dirty main worktree preserved. This isolated worktree must be integrated before future main deployments to avoid reverting the root entry.

## Follow-up: customer UI always mobile on PC
- User explicitly requested mobile-only customer UI on every device.
- index.html and mobile.html are byte-identical; unconditional force-mobile class, no desktop auto redirect.
- Build PASS. Deployment dpl_5j9ffaeNE4YNZGgJBUmF8JUBsBLo BLOCKED: TEAM_ACCESS_REQUIRED, commit author lacks project deployment permission. No permission bypass attempted.
- Production remains prior verified root-mobile release; direct mobile.html desktop redirect removal is NOT deployed.

## Color swatch follow-up
- Current data has 177 exterior colors with empty hex; mobile directly rendered empty hex.
- Recovered display-only palette from legacy file by exact model ID + color name (118/177 matches). Legacy prices and availability are not consumed. Unmatched names use existing PC guessColor approximation, labeled reference-only.
- Local build passed; Grandeur color step renders swatches in browser. Final computed-color readback timed out after latest palette update; full model visual coverage unverified.
- These changes remain local because Vercel TEAM_ACCESS_REQUIRED is unresolved; do not claim deployed.

## Touch feedback follow-up
- Pointer press tracks original control; movement >10px, scroll, cancellation, blur clear pressed feedback.
- Haptic fires on completed trusted activation; cancelled gestures and disabled controls do not vibrate.
- Re-press clears previous release timer; keyboard focus movement safely releases original control.
- Seven regression tests and Vite build PASS. Browser manufacturer-to-model flow PASS. Physical device haptic strength/support unverified.
- Cursor identified cancel-then-click haptic risk; fixed and included regression. No unresolved reviewer disagreement.
- All follow-up changes remain local; Vercel commit-author TEAM_ACCESS_REQUIRED blocks deployment.

## Persistent selected-vehicle summary
- Footer above actions now shows cumulative manufacturer/model/trim, exterior/interior and option count on every wizard step; native details lists all option names.
- Summary derives from current selection, clears dependent fields on model changes, and honors confirmed shared snapshot.
- Footer measured with ResizeObserver; price bar and main padding follow actual height.
- Eleven unit tests including four summary tests passed; Vite build passed. Browser flow verified Grandeur/Premium, exterior black, interior black, sunroof -> conditions, expanded list. 390x844 screenshot verified readable summary and non-overlapping action buttons.
- Cursor advisory recommended separate collapsed lines, capped expansion, proper list structure and offset checks; implemented/verified those. Physical phone and production verification pending.
- Still local only: existing Vercel TEAM_ACCESS_REQUIRED has not been resolved.

## Explicit unselected state and visible option names
- Collapsed footer shows option names (two lines, full details available) rather than count alone. Vehicle breadcrumb area also shows full current colors/options.
- Result card always shows exterior/interior with 미선택 fallback; empty options say 옵션 미선택. No implicit default selection or source-data mutation.
- Browser verified unselected colors + selected sunroof remain identical through options, conditions and result. Build and four summary tests PASS. Local API calculation unavailable, so result verification is display-only.
- Cursor flagged density; footer names remain bounded with full disclosure. Selection/send gates kept unchanged because this request concerns display, not making optional selections mandatory.
- Production still blocked by Vercel author permission; all follow-ups remain local.

## Option supporting descriptions
- Mobile option cards retain web source sub text and now also show declared included specs and prerequisite names without hiding them until disabled.
- Supporting text is 13px, readable contrast, line-height 1.55, wrapping with no truncation. No descriptions invented for missing source data.
- Build PASS; browser Grandeur option step confirms supporting copy below names.
- Deploy author identity confirmation remains pending; no production release claimed.

## Follow-ups released
- User renewed deploy instruction; release commit 602eac5 records verified Vercel account dudguq@gmail.com with per-command Git identity (global config/history unchanged).
- Preview dpl_AGbY9yFXkev5pw6RjRHzGeoyuBrb -> production dpl_2JWzvJ4qmz1bf1moTNGutH8SntJC. Prior rollback dpl_EbCqZGJ1L5XdzHRUGYG8xcSe1zWE.
- Canonical root/mobile HTML and production bundle readback confirm forced mobile, haptics, cumulative summary, option supporting text.
- Live browser root -> Hyundai -> Grandeur -> Premium -> colors verified; unselected states and summary present. Burgundy swatch computed rgb(92,42,46).
- Eleven regression tests pass. Physical device vibration unverified; browser/hardware API support required. Color approximations remain reference-only (118 exact legacy display-palette matches, 59 name-based fallback).
- Earlier pending/block statements above describe history; these follow-ups are now deployed. Main-worktree integration remains necessary before another main deployment.

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

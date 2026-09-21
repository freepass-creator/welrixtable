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

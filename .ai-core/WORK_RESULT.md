# AI Work Result

- 목적: 최신 AI Core 규격과 GitHub 동기화 부트스트랩 적용
- 대상 revision: 47e89d936bf1264387ee5e62888f40f0470d583f
- 변경:
- 검증:
- 남음:
- next_start_here:


## 2026-09-30 — Short self-quote share candidate (HOLD)
- 목적: share the same vehicle/amount using https://welrixtable.vercel.app/s/<8-character-id> (41 characters).
- 대상 revision: main f86d2f14e98f386045677ab0a63b42f6f378c4db, work/feature/short-self-quote.
- 변경: selected propagation from Estimate candidate, Firestore-only self-quote adapter using the existing Sales share collection; async share/read, /s route, visible missing/invalid/network errors. RTDB code was not restored or changed.
- 검증: build and check:quote-contract PASS; browser at 390px saved/read/re-shared a synthetic quote via local Firestore emulator, same 500000 amount and 41-character URL; 1280px result visible. Sales rules suite PASS. No operational data write.
- 남음: HOLD pending existing store exception decision, successful mandatory review and explicit production approval. Estimate authority guard rejects browser-direct collection access; do not silently whitelist. Bundled kit validation FAIL so current Core constitution and academy READY receipt were used instead. No deploy/merge.
- next_start_here: Estimate docs/AUDIT_HANDOFF.md short-share entry and src/firebase/self-quote-share.js. Preserve other dirty worktrees. Legacy collection expiry is 30 days, immutable documents; cleanup is not part of this change.


## 2026-09-30 — User approved short-share release
- 최신 직접 승인: 반영해줘 배포해주고. Existing Sales self-quote share-store exception and welrixtable.vercel.app production deployment approved; I-01 canonical persistence cutover remains disabled.
- 변경: operational viewer accepts canonical v2 plus historical v1 snapshots; frozen shares retain original trim/options without live axis remapping; only included periods are shared. Each owning app issues its own stable production origin (Estimate freepass-estimator.vercel.app; operational welrixtable.vercel.app), including shares made in preview. Link expiry uses server HTTP Date and authoritative rules time, not the device clock.
- 검증: Estimate full verify PASS after matching original LF checkout bytes; no engine/source content or manifest changes. Operational check:quote-contract, check and build PASS. Cross-runtime v2 restore/re-share and selected-period regression PASS. Final Claude read-only review PASS (exit 0, ANSWERED receipt). Browser regression PASS at 390/320/1440px: 41-character links, selected periods, unchanged amounts, re-share snapshot preservation and no console errors. CI uses a deterministic transport fixture; actual SDK/rules were separately emulator-tested.
- 정리: obsolete promotion PR #1 closed with branch/history retained; its /s route contested this current user-approved self-quote route. Canon gate now PASS. Canonical owner PR #56 merged at 00d8bac7845e08ef8d13eaa227e77a69c5f06594.
- 남음: operational PR #12 main publication, production deploy and live short-link write/readback.
- next_start_here: release work/feature/short-self-quote; previous HOLD entry is historical and superseded by the direct approval.

## 2026-09-30 — Desktop short-link follow-up
- 목적: correct bare /s links at desktop width.
- 대상 revision: main efd46631cb445949fc06261f1a0a7bbfc577a8df; initial production dpl_HfVhRsngKP2RFC3XeF4wbcCjBciD.
- 변경: bypass legacy desktop redirect on validated /s/8id paths; preserve ordinary desktop entry.
- 검증: operational UI created https://welrixtable.vercel.app/s/v3o3jog7; Firestore REST readback 200 with original 870000/1064000 amounts and 30-day expiry. Live desktop exposed self-redirect loop missed by the prior force=mobile desktop test. New 1280px bare-link browser regression PASS, full existing mobile UX regression PASS, contract/build PASS.
- 남음: independent review, follow-up CI/merge/deploy and fresh mobile/desktop live readback.
- next_start_here: mobile.html entry guard and scripts/e2e-mobile-ux.mjs desktopShare regression.

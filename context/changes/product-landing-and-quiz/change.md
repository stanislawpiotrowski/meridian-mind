---
change_id: product-landing-and-quiz
title: Product landing page + logged-out 10-capital teaser quiz
status: implemented
created: 2026-06-03
updated: 2026-06-03
archived_at: null
---

## Notes

Roadmap slice S-08. Rewrite `/` from the generic "10x Astro Starter" template into a MeridianMind landing (spaced repetition / click-to-verify on the map / bring-your-own CSV) plus a mini-quiz: 10 random European capitals, click the map, distance feedback in km, end screen with a sign-up CTA. No account, no persistence (client-side only).

- PRD refs: — (post-MVP; note PRD scopes public browsing out of MVP)
- Prerequisites: F-02 (map component; reuse `/map-demo`, `/study/[setId]`)
- Open question: quiz as a section on `/` vs a dedicated `/try` route. Owner: user. Block: no.
- Risk: Medium — slimming the session component into a logged-out mode.

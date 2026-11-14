# DESIGN.md — Attest UI & interaction

Design for a tired engineering student between labs: clear, fast, trustworthy. Steal patterns, not skins.

## Brand & layout
- Product name **Attest** is visible in shell (sidebar + navbar). Landing makes Attest the hero, then equal Ideas / Problems columns.
- Palette: Ideas indigo `#4f46e5`, Problems amber `#b45309`, ink `#141b2b`, muted `#777587`, wash `#f9f9ff` / `#f1f3ff` / Problems wash `#fffbf5`. Stay here — no purple-glow AI aesthetic, no newspaper theme.
- Serif for page titles (`font-serif`), sans for UI. Material Symbols for nav icons.
- App shell: left workspace nav + top search chrome. Ideas board max-width ~5xl (wider Medium-style cards); other boards ~3xl–4xl.

## Principles (user POV)
1. **One job per screen.** Ideas = discover builds. Problems = name pains. People = find classmates. Offer = decide. Workspace = ship.
2. **Show why.** Idea cards show reason lines (“Needs your Arduino”, “Popular in your circle”). People cards show match reasons. Never dump a silent score alone.
3. **Proof over polish.** Signed skills, GitHub stats, shipped count beat long bios.
4. **Borrow, don’t clone.**
   - Reddit → engagement row (like / comment / share / save), “not interested”, threaded comments
   - Medium → pitch-first reading, topics, related ideas; teaser → apply → unlock
   - GitHub → fork as remix of the public slice; work history as a log
   - LinkedIn → profile cover/avatar/follow/sections; never DMs or endless recruiter chrome
5. **Empty states teach.** Dual CTAs: Post idea | Report a problem. Never a blank white void.
6. **Don’t fake chrome.** If search or notifications are not wired, hide or disable them. Dead bells destroy trust.
7. **Mobile later, but don’t break it.** Touch targets on like/comment must work when the sidebar collapses. Problems nav uses amber when active.

## Idea card anatomy (canonical)
```
[reason line]
[avatar] Author · Branch Sem · age     [Not interested]
IDEA · OPEN  (or IDEA · TEAM FULL / SHIPPED)
Title
Teaser / pitch (2 lines) — gated cards show blurb only
[1 hero image if set]
[topics]
Needs …
[N likes · N comments · N shares]
[Ask to join] [Read more]
[Like] [Comment] [Share] [Save] [Start my version = remix public slice with credit]
```

## Problem card anatomy
```
PROBLEM · NEEDS IDEA  (or HAS IDEA)
Title
What happens (2–3 lines)
[Propose an idea →]   amber accent
```

## Media limits
- Idea images: 1 hero + max 2 figures, ≤5 MB, client resize; PNG/JPG/WebP only
- Idea brief / resume uploads: PDF/PNG/JPG, bytes deleted after parse

## Profile anatomy
Cover + avatar → name/headline/university verified → follow counts + activity streak → Currently working on → About → Signed contributions → Experience / Projects / Certs → GitHub tile → posts. Invite-to-idea stays; **no DMs**.

## Motion
Keep it quiet: hover washes, pressed states on like, soft list transitions. No confetti.

## Accessibility
- Buttons have names (like/comment already aria-friendly in PostActions)
- Don’t rely on colour alone for liked vs not — seat badges also use text
- Comment timestamps must be correct local relative time (UTC from API)

## Anti-patterns to reject
- Hardcoded demo names or fake counts in UI
- Cards that look interactive but route nowhere
- Confusing Ideas and Problems with the same accent or CTA verbs

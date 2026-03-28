---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-09-functional
  - step-10-nonfunctional
inputDocuments:
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/project-context.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/01-brainstorming.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/02-market-research.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/03-domain-research.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/04-technical-research.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/05-product-brief.md
workflowType: 'prd'
---

# Product Requirements Document - fantasy-golf

**Author:** Gary
**Date:** 2026-03-28

## Executive Summary

Fantasy Golf Pool is a commissioner-first web app for private golf groups. It solves the core job of launching a pool quickly, inviting players with one link, locking picks at tee time, and showing live standings that the group can trust. The product is built for the organizer who currently lives in spreadsheets and absorbs blame when scoring or access fails.

The MVP is intentionally narrow: pool creation, tournament selection, invite sharing, mobile pick submission, lock enforcement, periodic score refresh, and a leaderboard with explicit freshness and lock-state indicators. The product wins only if commissioners feel safe recommending it to their group and players can join without friction.

### What Makes This Special

The wedge is trust, not breadth. Existing options are either legacy and clunky or modern but too heavy; this product sits between them with golf-native simplicity, clearer rules, a playful social tone, and a lower-friction commissioner workflow. Reliability is part of the product: scoring tests, fallback data handling, alerts, logging, and stale-data visibility are trust features, not ops extras.

## Project Classification

- Project Type: web app
- Domain: sports / fantasy golf pools
- Complexity: medium
- Project Context: brownfield

## Success Criteria

### User Success
- A commissioner can create a pool, choose a format, and share an invite link in under 10 minutes.
- A player can join from mobile and submit picks in under 2 minutes.
- Picks lock cleanly at tee time with no ambiguity about editability.
- Live standings feel trustworthy because freshness and lock state are always visible.
- Users can understand score changes without asking the commissioner to explain them.

### Business Success
- A commissioner can run at least one full tournament pool without support.
- The product gets reused across multiple events, not treated as a one-off experiment.
- Commissioners prefer it over spreadsheets because setup and upkeep are materially lower.
- The group trusts it enough that the commissioner is willing to recommend it again.
- Support burden stays low during live play.

### Technical Success
- Best-ball scoring, ties, birdies, withdrawals, and lock-time behavior are correct under test.
- Score refresh runs on a predictable cadence, with visible stale-data warnings if freshness slips.
- Fallback data handling prevents silent failure when the primary source stalls.
- Every scoring update is auditable and reproducible from stored inputs.
- The app stays stable through tournament-window traffic spikes.

### Measurable Outcomes
- Pool setup: <10 minutes
- Mobile pick submission: <2 minutes
- Score freshness: updated on a fixed cadence, with stale warning if delayed
- Support burden: no live-tournament escalation required for the first run
- Repeat use: commissioner runs another pool after the first event

## User Journeys

### Commissioner: launch a pool fast
Matt runs the office golf pool every major. He’s done it in spreadsheets before, and every year it turns into admin drag: names, deadlines, reminders, score checks, and the occasional “wait, are picks locked?” message. He opens the app because he needs to get a pool live before the tournament window closes.

He creates a pool, selects the format, copies a join link, and sends it to the group. He wants to know two things immediately: did the pool create correctly, and will players understand what to do next? As entries come in, he checks the commissioner view, confirms lock time, and watches for stale-data warnings. When scores start updating, the emotional shift is the point: he stops being the human scoring engine.

Climax: the first live leaderboard refresh lands without confusion or manual intervention. The group trusts it, nobody asks him to reconcile spreadsheet math, and he looks organized instead of exposed.

Requirements revealed: pool creation, tournament selection, invite links, commissioner controls, clear lock state, freshness indicators, live leaderboard, support for repeated use.

### Player: join and submit picks on mobile
Sara gets a text invite from Matt while she’s on her phone. She doesn’t care about the platform; she cares about whether joining takes 30 seconds or 10 minutes. She taps the link, reads the basics, and wants the picks flow to feel obvious without needing the commissioner to explain the rules.

She signs in, selects four golfers, and sees a slot tracker so she knows she’s done. If she makes a mistake, she needs to correct it before lock time. After submission, she wants confirmation, not ambiguity. During the tournament, she checks the leaderboard on mobile and wants to know whether the standings are current.

Climax: she submits picks cleanly, sees immediate confirmation, and later checks standings that feel fresh and trustworthy.

Requirements revealed: mobile join flow, simple auth, pick submission UI, slot tracking, edit-before-lock behavior, confirmation state, mobile leaderboard.

### Edge case: commissioner during scoring failure
Matt is happy until he sees scoring stop updating. This is the trust-breaking moment. If the app silently lies, the product is dead. He needs visible stale-data messaging, an audit trail, and a recovery path that tells him whether the issue is upstream, internal, or resolved.

He checks the freshness indicator, sees the alerting status, and can explain the issue to the group without guessing. If fallback data exists, the app uses it. If not, the app says so clearly. He is not looking for perfection; he is looking for honesty and control.

Climax: the system degrades visibly instead of failing silently, preserving trust.

Requirements revealed: fallback scoring, stale-data warnings, alerting, structured logging, auditability, error states, commissioner-facing status.

### Support/ops: investigate and recover
When something goes wrong, support needs to reconstruct what happened fast. They need to know who changed what, when a pick locked, what data source was used, and whether the leaderboard was recalculated from valid inputs. This is not a public-facing journey, but it is critical for trust.

They inspect logs, scoring events, refresh runs, and manual overrides if any exist. The goal is not just resolution; it’s preventing a repeat failure during the next tournament window.

Requirements revealed: audit logs, stored scoring inputs, refresh history, manual correction flow, observability, admin diagnostics.

### Journey Requirements Summary
- Commissioner setup must be fast, obvious, and repeatable.
- Player onboarding must be mobile-first and low-friction.
- Locking and score freshness must be explicit everywhere.
- Scoring failures must be visible, not hidden.
- Auditability and recovery tools are required for trust and support.

## Fantasy Golf Pool Specific Requirements

### Project-Type Overview
This is a web app optimized for invite-led private pool workflows, not search-driven discovery. Day-one usage is primarily commissioner setup on desktop and player participation on mobile. The UI can behave like an SPA, but it should preserve clear server-backed state for picks, locks, standings, and auditability.

### Technical Architecture Considerations
- Support modern Chrome and Safari on desktop and mobile.
- No SEO-first architecture is needed; this is effectively private/invite-only.
- Leaderboard updates should be polling-based with explicit freshness indicators, not realtime-only.
- Keep scoring and lock logic out of UI state; use shared pure TypeScript domain logic.
- Accessibility should meet WCAG-minded basics: readable contrast, keyboard access, and clear status messaging.

### Implementation Considerations
- Prioritize fast commissioner setup and simple invite sharing.
- Optimize mobile pick submission over broad marketing pages or public browsing.
- Make lock state, stale data, and scoring freshness visible in the main gameplay flow.
- Keep the experience lightweight enough for tournament-window usage without adding native-app complexity.
- Keep navigation pool-centric rather than dashboard-centric.
- Preserve a playful, social product tone without weakening trust cues.

## Functional Requirements

### Pool Setup & Administration
- FR1: A commissioner can create a private pool.
- FR2: A commissioner can select a tournament for the pool.
- FR3: A commissioner can configure the pool format.
- FR4: A commissioner can generate and share an invite link.
- FR5: A commissioner can view the pool status and current tournament state.
- FR6: A commissioner can manage commissioner-only administrative actions.
- FR7: A commissioner can view pool participation and entry status.
- FR8: A commissioner can reuse the pool workflow for future tournaments.

### Player Access & Entry
- FR9: A player can join a pool through an invite link.
- FR10: A player can access the pool on mobile web.
- FR11: A player can submit a golf entry with the required number of golfer picks.
- FR12: A player can see how many golfer picks remain to complete an entry.
- FR13: A player can edit their entry before the lock deadline.
- FR14: A player can receive confirmation after submitting an entry.
- FR15: A player can view their current picks within the pool.
- FR16: A player can see whether their entry is locked or editable.

### Scoring & Leaderboards
- FR17: The system can lock entries at the tournament deadline.
- FR18: The system can refresh scores on a recurring cadence.
- FR19: The system can calculate standings from the stored scoring rules.
- FR20: The system can display a live leaderboard for the pool.
- FR21: The system can show whether leaderboard data is current or stale.
- FR22: The system can show score changes as tournament results update.
- FR23: The system can handle tie-breaking rules for standings.
- FR24: The system can handle golfer withdrawal scenarios in scoring.

### Golfer Detail & Pick Visibility
- FR25: A player can view golfer detail information for selected or available golfers.
- FR26: A player can see how each golfer contributes to their current standing.
- FR27: A commissioner can view golfer-related pool details for support and oversight.

### Trust, Audit, & Support
- FR28: The system can record scoring changes for later review.
- FR29: The system can preserve an audit trail for refresh and scoring events.
- FR30: A commissioner can investigate scoring issues through admin-only tools.
- FR31: The system can expose fallback or failure states when score data is unavailable.
- FR32: The system can surface lock-state and freshness messaging consistently across the product.

### Delivery & Experience
- FR33: The product can be used as an online-only PWA experience.
- FR34: The experience can support commissioner setup on desktop and player participation on mobile.
- FR35: The product can present a responsive web experience across modern browsers.
- FR36: The product can support basic accessibility needs for navigation and status clarity.

## Non-Functional Requirements

### Performance
- The commissioner can load the pool dashboard and leaderboard without noticeable delay during live tournament windows.
- Player entry submission must feel immediate and confirm success clearly.
- Score refreshes must update often enough that the leaderboard feels current, with stale-data states shown if freshness slips.
- Golfer detail views must open quickly enough to support live decision-making on mobile.

### Security
- Only authorized users can access a private pool.
- Commissioner-only actions must be restricted from regular players.
- Authenticated users must not be able to edit locked entries or alter scoring state.
- All scoring and admin actions must be auditable.
- Sensitive data and credentials must be protected in transit and at rest.

### Scalability
- The system must handle tournament-window spikes in commissioner and player activity.
- The platform must support multiple concurrent private pools without degrading trust in scoring or freshness.
- Growth should be possible without reworking the core scoring or lock model.

### Accessibility
- The web experience must meet WCAG-minded basics.
- All primary flows must work with keyboard navigation and clear focus states.
- Status changes such as lock state, freshness, and submission confirmation must be perceivable without relying on color alone.
- Mobile usage must remain usable for casual players joining from an invite link.

### Integration
- The product must tolerate external scoring source instability without silently showing bad data.
- Fallback handling must exist when primary score feeds stall or fail.
- External data changes must not break the internal scoring contract.
- Integration failures must surface clearly to commissioners and users.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy
**MVP Approach:** problem-solving MVP focused on trust, speed, and repeatable commissioner use
**Resource Requirements:** small team with web app, backend/domain logic, and QA coverage for scoring

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- commissioner creates pool and invites players
- player joins on mobile and submits picks
- commissioner monitors lock state and live standings
- commissioner investigates scoring issues if freshness slips

**Must-Have Capabilities:**
- pool creation
- tournament selection
- invite link sharing
- mobile pick submission
- lock at tee time
- periodic score refresh
- live leaderboard
- freshness and lock-state messaging
- basic commissioner controls
- golfer detail view
- PWA shell, online only
- commissioner-only admin tools

### Post-MVP Features

**Phase 2 (Growth):**
- better pick summaries
- migration/import tools
- more contest modes
- richer admin diagnostics
- PWA offline support
- social/gamification

**Phase 3 (Expansion):**
- mobile client
- paid tiers / payout handling
- broader contest platform
- advanced personalization and engagement features

### Risk Mitigation Strategy

**Technical Risks:** scoring correctness and stale-data handling are the main risks; mitigate with pure domain logic, test coverage, alerts, logs, and audit trails.
**Market Risks:** commissioners only stick if trust is earned in real tournament use; mitigate by launching narrow and prioritizing visible freshness.
**Resource Risks:** if scope gets tight, keep the commissioner's core control loop and player submission flow; everything else waits.

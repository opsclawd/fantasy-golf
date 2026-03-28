---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
inputDocuments:
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/prd.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/architecture.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/project-context.md
workflowType: 'ux-design'
project_name: 'fantasy-golf'
user_name: 'Gary'
date: '2026-03-28'
---

# UX Design Specification fantasy-golf

**Author:** Gary
**Date:** 2026-03-28

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

### Project Vision

Fantasy Golf Pool should feel like the easiest way to run a private golf pool without turning the commissioner into a spreadsheet operator. The experience should make setup feel quick, pick submission feel obvious on mobile, and live standings feel trustworthy through clear lock-state and freshness cues.

### Target Users

**Commissioners** are the organizers running private pools for friends, coworkers, or small groups. They need to create a pool fast, share a link, monitor participation, and trust the system during live scoring.

**Players** join from an invite link, usually on mobile, and want a simple path to submit picks, correct mistakes before lock, and check standings later without confusion.

**Support/ops users** need auditability and clear history when something looks wrong, especially around scoring refreshes or failure states.

### Key Design Challenges

- Making setup feel fast without burying the commissioner in configuration.
- Helping mobile players understand entry completion, editability, and lock timing instantly.
- Keeping leaderboard freshness and fallback states unmistakable so trust is never implied accidentally.
- Supporting responsive layouts and accessibility without adding unnecessary complexity.
- Balancing playful tone with serious trust cues.

### Design Opportunities

- Use a strong status-first interface that shows lock state, freshness, and confirmation at a glance.
- Make the commissioner flow feel like a guided launch sequence instead of an admin dashboard.
- Use mobile-friendly progress and slot tracking to reduce uncertainty while submitting picks.
- Turn stale-data and fallback messaging into a trust signal, not an error-only afterthought.

## Core User Experience

### Defining Experience

The defining experience is a commissioner launching a pool and a player joining from a link, submitting picks, and immediately knowing the entry is valid and editable only until lock. If that loop feels effortless, the rest of the product earns trust.

### Platform Strategy

This is a responsive web experience first, optimized for desktop commissioner setup and mobile player participation. It should feel touch-friendly on phones, mouse-and-keyboard friendly on desktop, and fully usable without a native app.

The product should work online-only, with clear server-backed state for entries, locks, and standings. It does not need offline mode for MVP.

### Effortless Interactions

- Invite-link entry should open directly into the right pool with no manual search.
- Pick selection should show progress immediately so players always know how many golfers remain.
- Submission confirmation should be instant and unmistakable.
- Lock state should update automatically without the user wondering if the app is current.
- Freshness indicators should make live standings feel trustworthy without requiring explanation.

### Critical Success Moments

- A commissioner creates a pool, shares a link, and feels ready before the tournament window closes.
- A player on mobile submits picks in one clean pass and sees clear confirmation.
- A player returns later and instantly understands whether entries are still editable.
- A commissioner sees the first leaderboard refresh and trusts that the app is not lying.

### Experience Principles

- Make trust visible.
- Make the next action obvious.
- Keep setup fast and controlled.
- Optimize for mobile first where players are concerned.
- Never hide lock state, freshness, or failure conditions.

## Desired Emotional Response

### Primary Emotional Goals

Users should feel calm and reassured when using Fantasy Golf Pool. The experience should reduce uncertainty around setup, submission, lock timing, and score freshness so the product feels dependable instead of stressful.

Users should also feel delighted by how lightweight and natural the workflow is. The product should feel pleasantly polished, not heavy or administrative.

### Emotional Journey Mapping

**Discovery:** Users should feel hopeful that this will be easier than spreadsheets or clunky pool tools.

**Core action:** Users should feel calm while creating a pool or submitting picks because the next step is always obvious.

**Completion:** Users should feel reassured that the action worked and that the system is tracking the right state.

**When something goes wrong:** Users should feel informed, not panicked. The interface should explain what happened clearly and preserve trust.

**Returning later:** Users should feel confident that the app still knows what is editable, locked, and current.

### Micro-Emotions

- Calm instead of anxious
- Reassured instead of skeptical
- Delighted instead of bored
- Accomplished instead of uncertain
- Connected instead of isolated

### Design Implications

- Calm and reassured → show lock state, freshness, and submission status explicitly.
- Delighted → keep the tone playful, the flow light, and the visuals polished.
- Confused → avoid hiding actions, burying status, or requiring explanation from the commissioner.
- Skeptical → never present stale data without marking it clearly.

### Emotional Design Principles

- Clarity creates calm.
- Visibility builds trust.
- Small moments of confirmation create delight.
- Status should never be implied when it can be shown.
- Errors should inform, not intimidate.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

The strongest inspiration for Fantasy Golf Pool comes from sports score apps, invite-based onboarding products, and progressive forms.

**Sports score apps** do the most important job well: they make current state obvious. They use strong hierarchy, visible freshness, and status-first layouts so users can tell what is current without hunting.

**Invite flows** are a good model for the player journey. They reduce friction by taking users directly to the right context, making joining feel immediate rather than administrative.

**Progressive forms** show how to make a multi-step action feel simple. They use clear progress, lightweight confirmation, and steady momentum so users never feel lost mid-flow.

### Transferable UX Patterns

**Navigation Patterns:**

- Context-first entry - good for taking players straight from invite link into the correct pool.
- Status-led layout - good for commissioner dashboards where lock state and freshness matter most.

**Interaction Patterns:**

- Immediate progress feedback - excellent for pick selection and completion tracking.
- Clear success confirmation - addresses user uncertainty after submission.

**Visual Patterns:**

- Freshness and status chips - supports the emotional goal of reassurance.
- Compact, readable hierarchy - aligns with mobile-first and responsive requirements.

### Anti-Patterns to Avoid

- Dashboard clutter - this creates noise and pulls attention away from pool state.
- Hidden lock state - users should never have to guess whether they can still edit.
- Generic forms - the product should feel like a live pool experience, not a bland intake system.
- Stale data without warnings - this destroys trust immediately.

### Design Inspiration Strategy

**What to Adopt:**

- Status-first layouts from sports apps because they make current state obvious.
- Invite-based entry because it minimizes friction for players.
- Progressive confirmation because it helps users feel completion clearly.

**What to Adapt:**

- Sports score hierarchy - simplify it for private pool use and add playful tone.
- Onboarding flows - keep them short and context-rich rather than marketing-heavy.
- Progress indicators - adapt them to golfer-slot completion instead of generic steps.

**What to Avoid:**

- Cluttered admin dashboards - conflicts with calm and clarity.
- Hidden or implied status - conflicts with trust and reassurance.
- Generic form treatment - conflicts with the product’s social, pool-based identity.

This strategy keeps Fantasy Golf Pool focused on trust, calm, and mobile submission ease while borrowing only the patterns that make the experience more obvious and dependable.

## Design System Foundation

### 1.1 Design System Choice

Fantasy Golf Pool should use a themeable system: a strong utility-first foundation with a small, consistent set of shared components and tokens layered on top. This gives the project speed, flexibility, and enough personality to feel like a golf product instead of a generic app.

### Rationale for Selection

- It fits the existing Next.js and Tailwind-oriented architecture.
- It supports fast iteration on mobile-first flows without heavy framework overhead.
- It gives enough control to emphasize status, freshness, and lock states clearly.
- It keeps the visual language consistent while still allowing a playful, restrained tone.

### Implementation Approach

- Build on the existing utility-based styling approach.
- Define a compact set of reusable UI primitives for status, confirmation, cards, and empty states.
- Standardize layout, spacing, and color usage through shared tokens.
- Keep the design system light enough that commissioners and players see a polished app, not an enterprise dashboard.

### Customization Strategy

- Use golf-native accents sparingly to give the product personality.
- Prioritize readability and hierarchy over decorative treatment.
- Create explicit styles for lock state, freshness, success, and fallback messaging.
- Keep the mobile experience tighter and more touch-friendly than the desktop commissioner view.

## Visual Design Foundation

### Color System

Fantasy Golf Pool should use a deep green and sand palette: grounded, golf-native, and quietly premium.

- Primary: deep green for key actions and trust surfaces
- Secondary: sand/cream for warmth and breathing room
- Accent: muted gold or citrus for small confirmation moments only
- Neutral: charcoal for text, structure, and high-contrast UI chrome

Semantic color use should stay explicit:
- Success: clear green-forward confirmation
- Warning: restrained amber tones
- Error: strong but not aggressive red
- Freshness/status: visible chips and labels, not color alone

### Typography System

Use a modern, readable sans-serif stack with strong hierarchy and no ornamental type. The tone should feel sporty and restrained, not playful in the typography itself.

- Headings: bold, compact, high-contrast
- Body: highly legible, comfortable line height
- UI labels/status: slightly smaller but still clear on mobile

The typographic system should prioritize scanning speed for commissioners and quick comprehension for players.

### Spacing & Layout Foundation

Use balanced spacing with a comfortable 8px-based rhythm. The layout should feel organized and calm, not cramped, while keeping key actions close together on mobile.

- Mobile layouts should stack cleanly and keep key actions above the fold
- Desktop layouts should give commissioners enough structure without becoming dashboard-heavy
- Card spacing should create separation between pool state, entry state, and leaderboard state
- Status surfaces should breathe enough to feel trustworthy and readable

### Accessibility Considerations

- Maintain strong contrast across all status states and text sizes
- Never rely on color alone to communicate lock, freshness, or errors
- Keep touch targets large enough for mobile use
- Preserve clear focus states for keyboard users
- Ensure status chips, confirmation states, and error messaging are readable on small screens

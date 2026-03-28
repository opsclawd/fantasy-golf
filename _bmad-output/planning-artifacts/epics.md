---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/prd.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/architecture.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/project-context.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/ux-design-specification.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/01-brainstorming.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/02-market-research.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/03-domain-research.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/04-technical-research.md
  - /home/gary/.openclaw/workspace/fantasy-golf/_bmad-output/planning-artifacts/research/05-product-brief.md
---

# fantasy-golf - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for fantasy-golf, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: A commissioner can create a private pool.
FR2: A commissioner can select a tournament for the pool.
FR3: A commissioner can configure the pool format.
FR4: A commissioner can generate and share an invite link.
FR5: A commissioner can view the pool status and current tournament state.
FR6: A commissioner can manage commissioner-only administrative actions.
FR7: A commissioner can view pool participation and entry status.
FR8: A commissioner can reuse the pool workflow for future tournaments.
FR9: A player can join a pool through an invite link.
FR10: A player can access the pool on mobile web.
FR11: A player can submit a golf entry with the required number of golfer picks.
FR12: A player can see how many golfer picks remain to complete an entry.
FR13: A player can edit their entry before the lock deadline.
FR14: A player can receive confirmation after submitting an entry.
FR15: A player can view their current picks within the pool.
FR16: A player can see whether their entry is locked or editable.
FR17: The system can lock entries at the tournament deadline.
FR18: The system can refresh scores on a recurring cadence.
FR19: The system can calculate standings from the stored scoring rules.
FR20: The system can display a live leaderboard for the pool.
FR21: The system can show whether leaderboard data is current or stale.
FR22: The system can show score changes as tournament results update.
FR23: The system can handle tie-breaking rules for standings.
FR24: The system can handle golfer withdrawal scenarios in scoring.
FR25: A player can view golfer detail information for selected or available golfers.
FR26: A player can see how each golfer contributes to their current standing.
FR27: A commissioner can view golfer-related pool details for support and oversight.
FR28: The system can record scoring changes for later review.
FR29: The system can preserve an audit trail for refresh and scoring events.
FR30: A commissioner can investigate scoring issues through admin-only tools.
FR31: The system can expose fallback or failure states when score data is unavailable.
FR32: The system can surface lock-state and freshness messaging consistently across the product.
FR33: The product can be used as an online-only PWA experience.
FR34: The experience can support commissioner setup on desktop and player participation on mobile.
FR35: The product can present a responsive web experience across modern browsers.
FR36: The product can support basic accessibility needs for navigation and status clarity.

### NonFunctional Requirements

NFR1: The commissioner can load the pool dashboard and leaderboard without noticeable delay during live tournament windows.
NFR2: Player entry submission must feel immediate and confirm success clearly.
NFR3: Score refreshes must update often enough that the leaderboard feels current, with stale-data states shown if freshness slips.
NFR4: Golfer detail views must open quickly enough to support live decision-making on mobile.
NFR5: Only authorized users can access a private pool.
NFR6: Commissioner-only actions must be restricted from regular players.
NFR7: Authenticated users must not be able to edit locked entries or alter scoring state.
NFR8: All scoring and admin actions must be auditable.
NFR9: Sensitive data and credentials must be protected in transit and at rest.
NFR10: The system must handle tournament-window spikes in commissioner and player activity.
NFR11: The platform must support multiple concurrent private pools without degrading trust in scoring or freshness.
NFR12: Growth should be possible without reworking the core scoring or lock model.
NFR13: The web experience must meet WCAG-minded basics.
NFR14: All primary flows must work with keyboard navigation and clear focus states.
NFR15: Status changes such as lock state, freshness, and submission confirmation must be perceivable without relying on color alone.
NFR16: Mobile usage must remain usable for casual players joining from an invite link.
NFR17: The product must tolerate external scoring source instability without silently showing bad data.
NFR18: Fallback handling must exist when primary score feeds stall or fail.
NFR19: External data changes must not break the internal scoring contract.
NFR20: Integration failures must surface clearly to commissioners and users.

### Additional Requirements

- Use Next.js App Router patterns with server-backed mutations.
- Keep scoring and lock logic in shared pure TypeScript domain logic.
- Keep UI state from becoming the source of truth for auth, deadlines, or scoring.
- Use polling-based leaderboard refresh with explicit freshness indicators.
- Isolate Supabase wiring to dedicated helpers.
- Preserve visible lock-state, stale-data, and fallback messaging throughout the product.
- Support modern Chrome and Safari on desktop and mobile.
- Keep the experience lightweight and PWA-capable without native-app complexity.

### UX Design Requirements

UX-DR1: The commissioner and leaderboard views must present lock state, freshness, and submission status as primary visible status elements.
UX-DR2: The commissioner flow must feel like a guided launch sequence, not a cluttered admin dashboard.
UX-DR3: The player pick flow must show remaining-pick progress immediately as golfers are added or removed.
UX-DR4: Submission confirmation must be unmistakable and shown immediately after a valid entry is saved.
UX-DR5: Invite-link entry must land the user in the correct pool context with no manual search or extra navigation.
UX-DR6: Stale-data and fallback states must be visually explicit and treated as trust signals, not hidden error states.
UX-DR7: The experience must be responsive for desktop commissioner use and mobile player use, with online-only PWA behavior for MVP.
UX-DR8: Status indicators must not rely on color alone; lock, freshness, errors, and confirmation need text or icon cues.
UX-DR9: Touch targets, focus states, and small-screen readability must support mobile players and keyboard users.
UX-DR10: Status chips, empty states, and error messaging must remain clear and readable across small screens.

### FR Coverage Map

FR1: Epic 1 - Launch a private pool and configure it.
FR2: Epic 1 - Choose the tournament for the pool.
FR3: Epic 1 - Configure the pool format.
FR4: Epic 1 - Share a join link.
FR5: Epic 1 - See pool and tournament status.
FR6: Epic 1 - Perform commissioner-only admin actions.
FR7: Epic 1 - Review participation and entry status.
FR8: Epic 1 - Reuse the pool workflow for future tournaments.
FR9: Epic 2 - Join a pool from an invite link.
FR10: Epic 2 - Use the pool on mobile web.
FR11: Epic 2 - Submit the required golfer picks.
FR12: Epic 2 - Track remaining picks.
FR13: Epic 2 - Edit picks before lock.
FR14: Epic 2 - Get submission confirmation.
FR15: Epic 2 - Review current picks.
FR16: Epic 2 - See locked vs editable state.
FR17: Epic 3 - Lock entries at tee time.
FR18: Epic 3 - Refresh scores on cadence.
FR19: Epic 3 - Calculate standings from stored rules.
FR20: Epic 3 - Display the live leaderboard.
FR21: Epic 3 - Show current vs stale data.
FR22: Epic 3 - Surface score changes.
FR23: Epic 3 - Resolve ties correctly.
FR24: Epic 3 - Handle golfer withdrawals.
FR25: Epic 4 - View golfer details.
FR26: Epic 4 - Understand golfer contribution to standing.
FR27: Epic 4 - Inspect golfer-related pool details.
FR28: Epic 5 - Record scoring changes.
FR29: Epic 5 - Preserve scoring and refresh audit trails.
FR30: Epic 5 - Investigate scoring issues.
FR31: Epic 5 - Surface fallback or failure states.
FR32: Epic 5 - Show lock-state and freshness messaging consistently.
FR33: Epic 5 - Provide an online-only PWA experience.
FR34: Epic 5 - Support desktop commissioner and mobile player flows.
FR35: Epic 5 - Deliver a responsive modern browser experience.
FR36: Epic 5 - Meet basic accessibility needs.

## Epic List

### Epic 1: Launch and manage a private pool
Commissioners can create a pool, choose the tournament, configure the format, share an invite, and manage the pool setup through the full tournament lifecycle.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8

### Epic 2: Join and submit picks on mobile
Players can join from an invite link, submit their required golfer picks on mobile, edit before lock, and get clear confirmation of their entry state.
**FRs covered:** FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16

### Epic 3: Follow live standings with trustworthy scoring
Players and commissioners can see entries lock at tee time, watch scores refresh, and trust the live leaderboard because standings, ties, withdrawals, and freshness are handled explicitly.
**FRs covered:** FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24

### Epic 4: Understand golfer choices and impact
Players can inspect golfer detail and understand how selected golfers affect their current standing, while commissioners can use golfer context for oversight and support.
**FRs covered:** FR25, FR26, FR27

### Epic 5: Trust the system and use it everywhere
Commissioners can review audit data, investigate scoring issues, and rely on fallback behavior, while the product remains responsive, accessible, and usable as a PWA across desktop and mobile.
**FRs covered:** FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36

## Epic 1: Launch and manage a private pool

Commissioners can create a pool, choose the tournament, configure the format, share an invite, and manage the pool setup through the full tournament lifecycle.

### Story 1.1: Create a private pool

As a commissioner,
I want to create a private pool,
So that I can start a new tournament group with controlled access.

**Acceptance Criteria:**

**Given** I am signed in as a commissioner
**When** I create a new pool
**Then** the system creates a private pool with a unique identifier
**And** the pool is not accessible to non-invited users

**Given** required pool details are missing or invalid
**When** I submit the create pool form
**Then** the system blocks creation
**And** it shows a clear validation message

### Story 1.2: Select the tournament and configure format

As a commissioner,
I want to select the tournament and pool format,
So that the pool rules match the event I am running.

**Acceptance Criteria:**

**Given** I have created a pool
**When** I choose a tournament and format
**Then** the pool saves those settings
**And** the chosen tournament and format are visible in the commissioner view

**Given** the selected tournament or format is invalid
**When** I try to save the settings
**Then** the system rejects the change
**And** it explains what needs to be corrected

### Story 1.3: Share a join link

As a commissioner,
I want to generate and share a join link,
So that players can join the pool without manual setup.

**Acceptance Criteria:**

**Given** a pool exists
**When** I request an invite link
**Then** the system generates a unique pool invite link
**And** I can copy the link for sharing

**Given** the invite link is opened by an unauthorized user
**When** they access the link
**Then** the system directs them into the pool join flow
**And** it does not expose commissioner-only data

### Story 1.4: Review pool status and participation

As a commissioner,
I want to see pool status and participation,
So that I can tell whether the pool is ready and who has joined.

**Acceptance Criteria:**

**Given** I am viewing a pool
**When** I open the pool status view
**Then** I see the selected tournament, format, and current pool state
**And** I see who has joined and who still needs to submit entries
**And** lock state and freshness are surfaced as primary status elements

**Given** the pool has stale or incomplete setup data
**When** I view pool status
**Then** the system shows the issue clearly
**And** it does not present incomplete setup as ready

### Story 1.5: Perform commissioner-only actions

As a commissioner,
I want to perform commissioner-only actions,
So that I can manage the pool without exposing controls to players.

**Acceptance Criteria:**

**Given** I am signed in as a commissioner
**When** I access commissioner actions
**Then** I can use admin controls available to the pool owner
**And** the actions are recorded for audit purposes

**Given** I am signed in as a regular player
**When** I try to access commissioner-only actions
**Then** the system blocks access
**And** the controls are hidden or disabled

### Story 1.6: Reuse the pool for a future tournament

As a commissioner,
I want to reuse a pool setup for a future tournament,
So that I do not need to recreate the same configuration from scratch.

**Acceptance Criteria:**

**Given** I have a previous pool configuration
**When** I start a new tournament from that pool
**Then** the system copies the reusable pool settings
**And** it creates a fresh event instance for the new tournament

**Given** the old pool contains finished entries or standings
**When** I reuse the pool
**Then** historical results remain separate from the new event
**And** the new event starts cleanly

## Epic 2: Join and submit picks on mobile

Players can join from an invite link, submit their required golfer picks on mobile, edit before lock, and get clear confirmation of their entry state.

### Story 2.1: Join a pool from an invite link

As a player,
I want to join a pool from an invite link,
So that I can access the pool without manual setup.

**Acceptance Criteria:**

**Given** I have a valid invite link
**When** I open the link
**Then** the system takes me into the pool join flow
**And** it identifies the correct pool

**Given** the invite link is invalid or expired
**When** I open it
**Then** the system shows a clear error state
**And** it does not let me enter the pool

### Story 2.2: Sign in on mobile

As a player,
I want to sign in on my phone,
So that I can submit picks from mobile web.

**Acceptance Criteria:**

**Given** I am joining from a mobile device
**When** I sign in
**Then** the system authenticates me successfully
**And** it returns me to the pool flow

**Given** authentication fails
**When** I try to sign in
**Then** the system shows a clear error message
**And** it preserves my place in the flow

### Story 2.3: Submit required golfer picks

As a player,
I want to submit the required number of golfer picks,
So that my entry counts for the pool.

**Acceptance Criteria:**

**Given** I am in a pool entry form
**When** I select the required number of golfers
**Then** the system lets me submit the entry
**And** it stores my selected picks for the pool

**Given** I have not selected enough golfers
**When** I try to submit
**Then** the system blocks submission
**And** it shows how many picks remain

### Story 2.4: Track remaining picks while building an entry

As a player,
I want to see how many picks remain,
So that I know when my entry is complete.

**Acceptance Criteria:**

**Given** I am selecting golfers
**When** I add or remove a golfer
**Then** the remaining-picks counter updates immediately
**And** it reflects the current entry state
**And** the progress indicator is easy to read on mobile

**Given** my entry is complete
**When** I review the form
**Then** the system makes it obvious that I am ready to submit
**And** the completion state is visually unmistakable without relying on color alone

### Story 2.5: Edit picks before the lock deadline

As a player,
I want to edit my picks before lock time,
So that I can correct mistakes before the tournament starts.

**Acceptance Criteria:**

**Given** the pool has not locked yet
**When** I open my submitted entry
**Then** I can change my golfer selections
**And** I can save the updated entry

**Given** the pool is locked
**When** I try to edit my entry
**Then** the system blocks the change
**And** it clearly shows the entry is locked

### Story 2.6: See submission confirmation and current picks

As a player,
I want confirmation after submission and visibility into my current picks,
So that I know my entry was saved correctly.

**Acceptance Criteria:**

**Given** I submit a valid entry
**When** the save completes
**Then** the system shows a clear confirmation state
**And** it shows my current picks
**And** the confirmation is immediate and unmistakable

**Given** I return to the pool later
**When** I view my entry
**Then** I can see my saved picks and whether they are locked or editable
**And** the locked or editable state is explicit

## Epic 3: Follow live standings with trustworthy scoring

Players and commissioners can see entries lock at tee time, watch scores refresh, and trust the live leaderboard because standings, ties, withdrawals, and freshness are handled explicitly.

### Story 3.1: Lock entries at tee time

As a commissioner,
I want entries to lock at tee time,
So that no one can change picks after the tournament starts.

**Acceptance Criteria:**

**Given** the lock deadline has not passed
**When** I view entries
**Then** they remain editable

**Given** the lock deadline passes
**When** the system evaluates the pool
**Then** it locks all eligible entries
**And** it marks them as locked everywhere they appear

### Story 3.2: Refresh scores on a recurring cadence

As a commissioner,
I want scores to refresh automatically,
So that the leaderboard stays current without manual work.

**Acceptance Criteria:**

**Given** the tournament is active
**When** the refresh interval runs
**Then** the system fetches the latest scoring data
**And** it updates stored leaderboard results
**And** the refresh run completes on the configured schedule or records a failure if it does not

**Given** the refresh run fails
**When** the system cannot update scores
**Then** it records the failure
**And** it preserves the last known good state
**And** it surfaces the failure for commissioner review

### Story 3.3: Display the live leaderboard

As a player or commissioner,
I want to see a live leaderboard,
So that I can understand current standings at a glance.

**Acceptance Criteria:**

**Given** the pool has scoring data
**When** I open the leaderboard
**Then** I see ranked standings for the pool
**And** the display reflects the latest stored results

**Given** there is no scoring data yet
**When** I open the leaderboard
**Then** I see an empty or pending state
**And** the system explains why standings are not available
**And** the empty or pending state is readable on mobile

### Story 3.4: Show current versus stale data

As a player or commissioner,
I want to know whether leaderboard data is current,
So that I can trust what I am seeing.

**Acceptance Criteria:**

**Given** the leaderboard refresh is on schedule
**When** I view the leaderboard
**Then** the system marks the data as current
**And** it uses a clear label or chip, not color alone

**Given** the refresh cadence falls behind
**When** I view the leaderboard
**Then** the system marks the data as stale
**And** it makes the freshness issue obvious
**And** it keeps the stale state readable on small screens

### Story 3.5: Surface score changes, ties, and withdrawals

As a player or commissioner,
I want score changes to be reflected correctly,
So that standings remain fair and understandable.

**Acceptance Criteria:**

**Given** tournament results change
**When** the system recalculates standings
**Then** score changes are reflected in the leaderboard
**And** ties are resolved using the configured rules

**Given** a golfer withdraws
**When** scoring is recalculated
**Then** the withdrawal is handled according to the scoring rules
**And** the result is visible in standings

## Epic 4: Understand golfer choices and impact

Players can inspect golfer detail and understand how selected golfers affect their current standing, while commissioners can use golfer context for oversight and support.

### Story 4.1: View golfer detail information

As a player,
I want to view golfer details,
So that I can make informed pick decisions.

**Acceptance Criteria:**

**Given** golfers are available in the pool
**When** I open a golfer detail view
**Then** I see the golfer's name, current score, and pool-relevant status
**And** the view loads quickly on mobile

### Story 4.2: See how a golfer affects my standing

As a player,
I want to see how each golfer contributes to my standing,
So that I understand the impact of my picks.

**Acceptance Criteria:**

**Given** I have selected golfers in my entry
**When** I view my picks
**Then** I can see how those golfers contribute to my current standing
**And** the contribution is shown in a clear, understandable way

### Story 4.3: Inspect golfer-related pool details as a commissioner

As a commissioner,
I want to inspect golfer-related pool details,
So that I can support players and troubleshoot scoring questions.

**Acceptance Criteria:**

**Given** I am signed in as a commissioner
**When** I view golfer-related pool details
**Then** I can see the golfer's pool context, current standing impact, and related entry details
**And** the information supports troubleshooting and oversight workflows

## Epic 5: Trust the system and use it everywhere

Commissioners can review audit data, investigate scoring issues, and rely on fallback behavior, while the product remains responsive, accessible, and usable as a PWA across desktop and mobile.

### Story 5.1: Record scoring changes and audit trails

As a commissioner,
I want scoring changes to be recorded,
So that the pool can be reviewed later if something looks wrong.

**Acceptance Criteria:**

**Given** scores are updated
**When** the system stores the update
**Then** it records what changed and when
**And** the change is available for later review

### Story 5.2: Investigate scoring issues with admin tools

As a commissioner,
I want admin tools to investigate scoring issues,
So that I can understand what happened when results look wrong.

**Acceptance Criteria:**

**Given** I am signed in as a commissioner
**When** I open the admin investigation tools
**Then** I can review refresh history and scoring events
**And** I can trace the current leaderboard back to stored inputs

### Story 5.3: Show fallback or failure states clearly

As a commissioner or player,
I want fallback and failure states to be visible,
So that I am not misled when score data is unavailable.

**Acceptance Criteria:**

**Given** the primary score source is unavailable
**When** I view the pool or leaderboard
**Then** the system shows a clear fallback or failure state
**And** it does not present stale data as current

### Story 5.4: Keep lock-state and freshness messaging consistent

As a player or commissioner,
I want lock-state and freshness messaging to be consistent,
So that I always know whether I can edit and whether the data is current.

**Acceptance Criteria:**

**Given** I view the pool in different parts of the product
**When** lock or freshness state changes
**Then** the messaging stays consistent across screens
**And** the message is understandable without color alone
**And** the status treatment is shared between commissioner and player views

### Story 5.5: Provide a responsive, accessible PWA experience

As a player or commissioner,
I want the product to work as a responsive PWA,
So that I can use it on desktop and mobile without a native app.

**Acceptance Criteria:**

**Given** I open the product on desktop or mobile
**When** I navigate the main flows
**Then** the layout adapts to the screen size
**And** the app remains usable as an online-only PWA
**And** touch targets stay usable on mobile

**Given** I use keyboard navigation or assistive tech
**When** I move through the app
**Then** focus states and status changes remain perceivable
**And** the key flows remain accessible
**And** status chips, confirmation states, and errors remain legible on small screens

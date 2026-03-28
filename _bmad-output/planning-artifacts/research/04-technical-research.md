---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - docs/brainstorming/brainstorming-session-2026-03-27-.md
  - _bmad-output/planning-artifacts/research/domain-fantasy-golf-pool-mvp-research-2026-03-27.md
  - _bmad-output/planning-artifacts/research/market-fantasy-golf-pool-mvp-research-2026-03-27.md
workflowType: 'research'
lastStep: 6
research_type: 'technical'
research_topic: 'Fantasy golf pool MVP'
research_goals: 'Define the fastest trustworthy technical architecture for a commissioner-first fantasy golf pool MVP, including stack selection, scoring pipeline, integrations, observability, security, and a practical path to future mobile expansion.'
user_name: 'Gary'
date: '2026-03-28'
web_research_enabled: true
source_verification: true
---

# Research Report: technical

**Date:** 2026-03-28
**Author:** Gary
**Research Type:** technical

---

## Research Overview

This technical research translates the commissioner-first fantasy golf pool opportunity into an implementation-ready architecture. The core engineering conclusion is simple: the MVP should optimize for trust, speed of launch, and deterministic scoring rather than broad extensibility or heavy real-time complexity.

The recommended stack is a Next.js web app backed by Supabase Postgres, Auth, Realtime, and Edge Functions, with the scoring and leaderboard logic kept in pure TypeScript so it can be tested independently and later reused in a mobile client. Current platform docs support this direction: Next.js supports App Router, route handlers, metadata/manifest files, and PWA-oriented deployment patterns; Supabase provides the database, authentication, realtime updates, edge execution, and cron-oriented background capabilities needed for a lightweight but reliable tournament workflow; React Native remains a credible future client once the shared domain logic is stable.

---

## Executive Summary

The best technical path for the fantasy golf pool MVP is a narrow, reliability-first web product with a clean domain core. The highest-risk parts of the product are scoring correctness, lock-time behavior, external API dependence, and commissioner trust. Those risks should be addressed with explicit state models, test coverage, auditability, fallback data handling, and visible freshness indicators rather than with feature breadth.

The architecture should separate three layers: presentation in Next.js, domain logic in shared TypeScript utilities, and data/orchestration in Supabase plus background jobs. That structure supports quick web launch today and reduces the cost of a later React Native expansion. It also fits the research findings: commissioners need fast setup and dependable operation; players need simple mobile joining and trustworthy live results.

**Key Technical Findings:**

- Next.js App Router is a strong fit for the commissioner web app and future PWA delivery.
- Supabase covers the MVP backend needs without introducing unnecessary infrastructure sprawl.
- Pure TypeScript scoring logic is essential for correctness, testability, and mobile reuse.
- Polling plus freshness indicators is lower risk than depending entirely on realtime push.
- Observability, alerts, and fallback sources are product features, not ops extras.

**Technical Recommendations:**

- Build the MVP as a Next.js web app with Supabase backend services.
- Extract scoring, lock, and leaderboard rules into a shared domain package.
- Use scheduled refresh jobs and cached snapshots for score ingestion.
- Add structured logging, stale-data warnings, and health checks from day one.
- Defer native mobile development until the shared core is proven in production.

## Table of Contents

1. Technical Research Introduction and Methodology
2. Fantasy Golf Pool Technical Landscape and Architecture Analysis
3. Implementation Approaches and Best Practices
4. Technology Stack Evolution and Current Trends
5. Integration and Interoperability Patterns
6. Performance and Scalability Analysis
7. Security and Compliance Considerations
8. Strategic Technical Recommendations
9. Implementation Roadmap and Risk Assessment
10. Future Technical Outlook and Innovation Opportunities
11. Technical Research Methodology and Source Verification
12. Technical Appendices and Reference Materials

## 1. Technical Research Introduction and Methodology

### Technical Research Significance

Fantasy golf pool software is not technically hard in the abstract; it is hard where correctness, trust, and live updates intersect. The MVP wins only if commissioners believe the system will not embarrass them during a live tournament window. That makes the technical design unusually sensitive to scoring accuracy, deadline enforcement, observability, and graceful failure modes.

The research focus is therefore practical: identify the smallest stack and architecture that can ship quickly while protecting against the failures that would destroy trust. That means choosing boring, well-supported primitives over novel architecture, and making the scoring pipeline auditable end-to-end.

_Technical Importance: reliability and correctness are the product._
_Business Impact: technical mistakes become commissioner-facing trust failures._
_Source: `https://nextjs.org/docs`; `https://supabase.com/docs`; `https://reactnative.dev/docs/getting-started`_

### Technical Research Methodology

This report synthesizes the brainstorming session, the domain and market research outputs, and current platform documentation for the proposed stack. The analysis emphasizes architecture fit, implementation speed, operational risk, and future portability.

- **Technical Scope**: web app architecture, scoring engine design, backend services, data flow, observability, security, and future mobile reuse
- **Data Sources**: current docs for Next.js, Supabase, and React Native; prior domain and market research; brainstorming output
- **Analysis Framework**: domain decomposition, dependency mapping, risk analysis, and implementation sequencing
- **Time Period**: current platform capabilities as of 2026-03-28
- **Technical Depth**: implementation-oriented, with emphasis on MVP practicality

### Technical Research Goals and Objectives

**Original Technical Goals:** Define the fastest trustworthy technical architecture for a commissioner-first fantasy golf pool MVP, including stack selection, scoring pipeline, integrations, observability, security, and a practical path to future mobile expansion.

**Achieved Technical Objectives:**

- Identified a stack that supports rapid web launch without locking the product into brittle architecture.
- Mapped the core data and scoring pipeline needed for best-ball scoring, lock rules, and live standings.
- Clarified the main reliability and compliance risks, along with mitigation patterns.
- Established a shared-code strategy that keeps future React Native expansion feasible.

## 2. Fantasy Golf Pool Technical Landscape and Architecture Analysis

### Current Technical Architecture Patterns

The strongest architecture for this MVP is a modular monolith with clear domain boundaries. The web app should handle user-facing flows, while backend services should own scoring refresh, leaderboard generation, and audit logging. The product does not need microservices at this stage; it needs a small number of well-separated modules with reliable execution.

The recommended structure is:

- **Presentation layer**: Next.js App Router pages and components for commissioner setup, joins, picks, and leaderboards
- **Domain layer**: pure TypeScript utilities for scoring, pick validation, lock enforcement, and ranking
- **Data layer**: Supabase Postgres for pools, users, entries, scores, and audit records
- **Background layer**: Supabase Edge Functions or scheduled jobs for score refresh and alerting
- **Delivery layer**: PWA-ready web app with mobile-friendly layouts and installable metadata

This pattern fits the current Next.js docs, which highlight App Router, route handlers, metadata files, and PWA-oriented capabilities, and it aligns with Supabase’s documented database, auth, realtime, and edge-function model.

_Dominant Patterns: modular monolith, shared domain logic, scheduled refresh, and audit-friendly persistence_
_Architectural Evolution: web-first now, mobile reuse later_
_Architectural Trade-offs: less realtime novelty, more determinism and simpler operations_
_Source: `https://nextjs.org/docs`; `https://supabase.com/docs`_

### System Design Principles and Best Practices

The system should be built around four principles: deterministic scoring, explicit state, observable freshness, and fail-safe degradation. Scoring must be reproducible from stored inputs. Lock status must be visible and enforced in one place. Data freshness must be obvious to users. If upstream data fails, the UI should degrade gracefully instead of silently lying.

Best-practice patterns for this product include template-based pool setup, server-side validation of all pick submissions, idempotent refresh jobs, and an append-only audit trail for scoring changes. Those patterns reduce the chances of commissioner-facing disputes and support debugging when external data sources misbehave.

_Design Principles: trust, determinism, minimal surface area, and explicit state transitions_
_Best Practice Patterns: pure functions, idempotent jobs, audit logs, and server-side validation_
_Architectural Quality Attributes: correctness, maintainability, debuggability, and mobile usability_
_Source: `https://supabase.com/docs`; `https://nextjs.org/docs`_

## 3. Implementation Approaches and Best Practices

### Current Implementation Methodologies

The MVP should use a vertical-slice implementation approach: build one full path from commissioner setup to player entry to live standings before broadening scope. That reduces integration risk and keeps the team focused on the actual tournament workflow.

Recommended sequence:

1. Pool creation and tournament selection
2. Invite link generation and auth flow
3. Pick submission with validation and lock rules
4. Score ingestion and refresh pipeline
5. Leaderboard calculation and stale-data UI
6. Observability, alerts, and fallback sources

Quality assurance should start with scoring tests before UI polish. The most valuable tests are around best-ball selection, tie handling, birdie tiebreakers, withdrawals, and late submissions.

_Development Approaches: vertical slice, test-first domain logic, and incremental release_
_Code Organization Patterns: feature modules for UI, shared domain package, and backend jobs_
_Quality Assurance Practices: scenario tests, lock-time tests, and scoring regression tests_
_Deployment Strategies: staged web release with controlled tournament rollout_
_Source: `https://nextjs.org/docs`; `https://supabase.com/docs`_

### Implementation Framework and Tooling

Next.js is the best front-end framework fit because it already supports the app structure needed for route-level pages, server actions or route handlers, and PWA delivery. Supabase is a practical backend fit because it combines Postgres, authentication, realtime updates, edge functions, and client libraries in one managed platform.

For mobile expansion, React Native should be treated as a later client, not a launch dependency. The critical enabler is shared TypeScript logic for scoring and pick validation. React Native docs reinforce that the platform is suitable once JavaScript fundamentals and reusable app logic are in place.

_Development Frameworks: Next.js for web, Supabase for backend, React Native later for mobile_
_Tool Ecosystem: shared TypeScript, testing framework, cron jobs, and structured logging_
_Build and Deployment Systems: simple CI with test gates and environment-based deployment_
_Source: `https://nextjs.org/docs`; `https://supabase.com/docs`; `https://reactnative.dev/docs/getting-started`_

## 4. Technology Stack Evolution and Current Trends

### Current Technology Stack Landscape

The stack should intentionally stay conventional. TypeScript is the right language for both the app and the shared domain logic because it enables code reuse and reduces edge-case regressions. Next.js remains the strongest fit for the web layer because it bridges interactive UI and server-side application behavior. Supabase offers the fastest backend path because it bundles the database and operational primitives needed for an MVP.

For data, Postgres should be the source of truth. For communication, server-rendered pages plus targeted client interactivity are enough. Realtime can be added selectively for leaderboard updates, but polling remains the safer default for early reliability.

_Programming Languages: TypeScript-first implementation_
_Frameworks and Libraries: Next.js and future React Native client_
_Database and Storage Technologies: Supabase Postgres with row-level policies_
_API and Communication Technologies: route handlers, background jobs, and optional realtime updates_
_Source: `https://nextjs.org/docs`; `https://supabase.com/docs`_

### Technology Adoption Patterns

The main trend relevant to this product is convergence around shared code and managed backend primitives. That favors building the MVP in a way that can later be lifted into a mobile client without rewriting scoring logic. Another important trend is that app frameworks increasingly support PWA-friendly and hybrid delivery patterns, which fits this product’s need for mobile accessibility without forcing immediate native development.

_Adoption Trends: web-first launch, shared domain logic, managed backend services_
_Migration Patterns: web MVP first, then mobile client reuse_
_Emerging Technologies: edge execution, realtime sync, and installable web experiences_
_Source: `https://nextjs.org/docs`; `https://supabase.com/docs`; `https://reactnative.dev/docs/getting-started`_

## 5. Integration and Interoperability Patterns

### Current Integration Approaches

The core integrations are external scoring data, authentication, and notification/alerting. Scoring ingestion should be isolated behind a provider adapter so the app can switch sources or add a fallback source without changing the domain logic. Auth should stay simple with passwordless or magic-link style entry. Alerts should be emitted by background jobs when score refreshes fail or data staleness exceeds a threshold.

Data integration should be normalized into stable internal records: tournaments, pools, entries, golfer selections, hole scores, refresh runs, and audit events. That keeps the leaderboard calculation independent from provider quirks.

_API Design Patterns: provider adapters, internal normalization, and idempotent mutations_
_Service Integration: auth, scoring ingestion, background jobs, and notifications_
_Data Integration: canonical internal tables backed by Postgres_
_Source: `https://supabase.com/docs`; `https://nextjs.org/docs`_

### Interoperability Standards and Protocols

Interoperability should be boring and explicit. Use HTTP-based APIs for external data, SQL for internal persistence, and typed domain interfaces inside the app. Avoid coupling UI components directly to provider payloads. The system should also preserve an audit trail for every automated scoring update so disputes can be reconstructed later.

_Standards Compliance: conventional web APIs, SQL persistence, and typed interfaces_
_Protocol Selection: HTTP for providers, internal function calls for domain logic_
_Integration Challenges: provider instability, payload drift, and stale-score handling_
_Source: `https://supabase.com/docs`; `https://nextjs.org/docs`_

## 6. Performance and Scalability Analysis

### Performance Characteristics and Optimization

The MVP’s performance needs are modest in raw scale but strict in perceived responsiveness. The app must feel instant for pool setup and entry submission, and it must present fast enough leaderboard updates that users trust the system. The main optimizations are caching, small payloads, precomputed standings, and minimizing client-side work.

Performance should be measured by refresh latency, submission round-trip time, leaderboard render time, and the lag between external score updates and visible standings. Precomputing leaderboard snapshots after each refresh reduces UI complexity and makes the app more predictable.

_Performance Benchmarks: low-latency pick submission, refresh cadence under control, and fast leaderboard rendering_
_Optimization Strategies: cached snapshots, precomputed standings, and limited client state_
_Monitoring and Measurement: refresh duration, error rate, and stale-data age_
_Source: `https://nextjs.org/docs`; `https://supabase.com/docs`_

### Scalability Patterns and Approaches

This product scales best through simplicity, not distributed complexity. A single database-backed application can serve many pools if the data model is clean and jobs are idempotent. If usage grows, the first scaling lever is better job isolation and cache strategy, not service decomposition.

Capacity planning should focus on refresh frequency, tournament spikes, and concurrent leaderboard reads. Elasticity is mostly about handling peak tournament windows without making the commissioner wait.

_Scalability Patterns: modular monolith, background job isolation, and read-optimized snapshots_
_Capacity Planning: tournament-window bursts and leaderboard traffic peaks_
_Elasticity and Auto-scaling: managed platform scaling before custom infrastructure_
_Source: `https://supabase.com/docs`; `https://nextjs.org/docs`_

## 7. Security and Compliance Considerations

### Security Best Practices and Frameworks

Security should focus on access control, data integrity, and predictable handling of private pools. Commissioners need elevated privileges, but those privileges should be enforced server-side with row-level access policies and role checks. Sensitive actions such as pool creation, score overrides, or manual corrections should be logged.

Secure development practices include server-side validation for every mutation, secret isolation for provider credentials, and a narrow set of trusted background jobs. The UI should never be the source of truth for sensitive permissions.

_Security Frameworks: role-based access, server-side validation, and row-level protections_
_Threat Landscape: unauthorized edits, stale or manipulated scores, and provider credential leakage_
_Secure Development Practices: least privilege, audit logging, and input validation_
_Source: `https://supabase.com/docs`; `https://nextjs.org/docs`_

### Compliance and Regulatory Considerations

The MVP should avoid unnecessary compliance burden by staying in private, commissioner-led pool territory first. If the product later supports paid or regulated contests, that expansion should be designed as a separate compliance track, not an afterthought.

For the MVP, the important technical implication is to keep money handling and eligibility logic out of the core path unless strictly required. That preserves launch speed and reduces legal exposure.

_Industry Standards: private-group contest norms and explicit rule disclosure_
_Regulatory Compliance: defer cash-play complexity until the core workflow is proven_
_Audit and Governance: transparent rule storage, score audits, and correction logs_
_Source: domain and market research synthesis_

## 8. Strategic Technical Recommendations

### Technical Strategy and Decision Framework

The architecture decision framework should rank options by trust, speed, and future reuse. Any choice that improves short-term visual polish but weakens scoring certainty should be rejected. The recommended architecture is:

1. Next.js web app for commissioner and player flows
2. Supabase Postgres/Auth/Edge Functions as managed backend
3. Shared TypeScript domain library for scoring and validation
4. Background job system for score refresh and alerts
5. Optional realtime updates layered on top, not instead of polling

That path keeps the MVP understandable and gives the team a stable base for iteration.

_Architecture Recommendations: modular web-first architecture with shared domain logic_
_Technology Selection: choose managed services over custom infrastructure where possible_
_Implementation Strategy: ship the smallest trusted path, then expand with measured complexity_
_Source: `https://nextjs.org/docs`; `https://supabase.com/docs`; `https://reactnative.dev/docs/getting-started`_

### Competitive Technical Advantage

The technical moat is not raw technology; it is reliability and clarity. A product that always shows fresh, explainable standings will beat a flashier product that occasionally confuses commissioners. Additional advantage comes from reusable templates, fast setup, and a clean migration path to mobile.

_Technology Differentiation: auditability, trust signals, and domain-specific scoring clarity_
_Innovation Opportunities: migration tools, explanation layers, and shared mobile-ready logic_
_Strategic Technology Investments: tests, logging, alerting, and data freshness indicators_
_Source: domain and market research synthesis_

## 9. Implementation Roadmap and Risk Assessment

### Technical Implementation Framework

The implementation should move in phases:

1. **Foundation**: data model, auth, pool creation, invite flow
2. **Core gameplay**: picks, lock rules, scoring engine, leaderboard snapshots
3. **Trust layer**: logging, alerts, stale indicators, audit trail
4. **Polish**: mobile UX, PWA installability, player summaries
5. **Future expansion**: provider fallback, richer realtime, mobile client

This order matches the business priority of getting a trustworthy MVP into a real tournament window quickly.

_Implementation Phases: foundation, gameplay, trust layer, polish, expansion_
_Technology Migration Strategy: keep logic shared so mobile can follow later_
_Resource Planning: small team, managed backend, and strong test coverage_
_Source: brainstorming session and platform docs_

### Technical Risk Management

The biggest risks are upstream data failure, scoring bugs, lock-time race conditions, and hidden complexity around future paid-play features. The mitigation strategy is to design for observability and simple rollback paths.

- **Provider risk**: normalize external data and support fallback sources
- **Scoring risk**: unit test all calculation paths and keep logic pure
- **State risk**: store lock time and submission timestamps server-side
- **Trust risk**: show freshness, logging, and clear error states in the UI

_Technical Risks: provider instability, scoring defects, and stale data propagation_
_Implementation Risks: race conditions, bad migrations, and brittle UI-state coupling_
_Business Impact Risks: commissioner embarrassment and user churn from trust failures_
_Source: domain and market research synthesis_

## 10. Future Technical Outlook and Innovation Opportunities

### Emerging Technology Trends

Near term, the most useful trend is continued improvement in web app capabilities that narrow the gap with native mobile. Mid-term, the strongest opportunity is reusing the same TypeScript domain core inside a React Native client. Long-term, the product could evolve toward richer contest modes, notifications, and realtime collaboration without changing the core scoring engine.

_Near-term Technical Evolution: stronger web-first mobile experiences and better managed backend tooling_
_Medium-term Technology Trends: shared web/mobile code and more portable domain logic_
_Long-term Technical Vision: reusable contest platform across golf formats and devices_
_Source: `https://nextjs.org/docs`; `https://reactnative.dev/docs/getting-started`; `https://supabase.com/docs`_

### Innovation and Research Opportunities

The best innovation opportunities are not flashy. They are practical: score explanations, commissioner migration tools, import/export support, and better trust UX. A later mobile app should reuse the same scoring engine, same permission model, and same audit format.

_Research Opportunities: fallback scoring providers, explanation UX, and migration tooling_
_Emerging Technology Adoption: mobile client reuse after web validation_
_Innovation Framework: optimize for trust first, then add convenience and social depth_
_Source: domain and market research synthesis

## 11. Technical Research Methodology and Source Verification

### Comprehensive Technical Source Documentation

Primary technical sources were current documentation for Next.js, Supabase, and React Native. Secondary sources were the brainstorming output plus the domain and market research reports, which established the product requirements and the trust-first operating model.

_Primary Technical Sources: Next.js docs, Supabase docs, React Native docs_
_Secondary Technical Sources: brainstorming session, domain research, market research_
_Technical Web Search Queries: Next.js docs App Router PWA, Supabase docs auth realtime edge functions, React Native introduction and getting started_

### Technical Research Quality Assurance

Technical confidence is high for stack selection and architecture direction because the platform capabilities are publicly documented and current. Confidence is lower for exact throughput and usage volume because those depend on the eventual product rollout.

_Technical Source Verification: current docs used for platform capability confirmation_
_Technical Confidence Levels: high for architecture fit, medium for scale assumptions_
_Technical Limitations: no production telemetry yet; future metrics will refine assumptions_
_Methodology Transparency: stack fit was derived from product goals plus current platform docs_

## 12. Technical Appendices and Reference Materials

### Detailed Technical Data Tables

| Area | Recommendation | Reason |
|---|---|---|
| Web framework | Next.js App Router | Fast launch, app + server integration, PWA support |
| Backend | Supabase | Managed Postgres, Auth, Realtime, Edge Functions |
| Domain logic | Pure TypeScript | Testable and reusable for future mobile |
| Score refresh | Scheduled polling with snapshots | Lower risk than realtime-only |
| Mobile path | React Native later | Reuse shared logic after MVP validation |

### Technical Resources and References

_Technical Standards: standard web app auth, SQL modeling, and server-side validation_
_Open Source Projects: Next.js, Supabase client libraries, React Native_
_Research Papers and Publications: not required for stack selection; product research is the main input_
_Technical Communities: Next.js, Supabase, and React Native docs and community channels_

---

## Technical Research Conclusion

### Summary of Key Technical Findings

The safest and fastest technical path is a Next.js + Supabase MVP with shared TypeScript domain logic and a polling-based scoring pipeline. That stack gives the product enough power to launch quickly while keeping the most important part of the experience - scoring trust - under tight control.

### Strategic Technical Impact Assessment

This architecture minimizes early platform risk, preserves a clean path to React Native, and aligns directly with the business need for commissioner trust. It also avoids premature complexity in realtime, microservices, and custom infrastructure.

### Next Steps Technical Recommendations

1. Define the canonical data model for pools, entries, scores, and audit events.
2. Implement the scoring engine as a pure TypeScript module with tests first.
3. Build the Next.js commissioner flow and player join flow end to end.
4. Add refresh jobs, stale-data warnings, and alerting before polish.
5. Defer native mobile until the web workflow proves reliable in real use.

---

**Technical Research Completion Date:** 2026-03-28
**Research Period:** current comprehensive technical analysis
**Document Length:** As needed for comprehensive technical coverage
**Source Verification:** All technical facts cited with current sources
**Technical Confidence Level:** High - based on multiple authoritative technical sources

_This comprehensive technical research document serves as an authoritative technical reference on Fantasy golf pool MVP and provides strategic technical insights for informed decision-making and implementation._

# Continuity Phase 2 Plan

## Goal

Phase 2 adds `Enhanced Accuracy Mode` to Continuity as an opt-in Pro feature for scanned, messy, or low-confidence documents.

The goal is not "AI by default." The goal is:

- improve field accuracy above 90%
- reduce average review time below 30 seconds per document
- preserve user trust with visible evidence, fallback behavior, and explicit privacy controls

## Current Baseline

Continuity Phase 1 is local-first:

- upload invoice and optional W-9
- parse with browser-based PDF logic
- review extracted fields
- persist structured finance records
- generate and export a purchase order

Phase 2 builds on that. It does not replace it.

## Phase 2 Architecture

### New Layer

Add a document-intelligence layer between upload and review.

This layer returns one normalized extraction result regardless of provider:

- local extractor
- AI extractor
- fallback local extractor
- fused result

### Extraction Boundary

The app should use an interface shaped like:

```ts
interface Extractor {
  name: 'local' | 'ai' | 'fallback_local' | 'fused';
  extract(input): Promise<ExtractionResult>;
}
```

### Provider Rules

- `pilot` plan: local only
- `pro` plan with toggle off: local only
- `pro` plan with toggle on: AI path first, local fallback on failure
- later auto-mode: route scanned or low-confidence documents to enhanced extraction

## Data Model Additions

### extraction_sessions

Purpose:

- session-level extraction audit
- provider selection and fallback tracking
- privacy/compliance timestamps
- AI metering

### extraction_field_candidates

Purpose:

- persist candidate values by field and provider
- support dual-evidence review
- preserve extraction traces for future model improvement

### review_field_decisions

Purpose:

- log what local predicted
- log what AI predicted
- log what the user accepted or changed

This becomes the bridge to Phase 3 training data.

### ai_usage_monthly

Purpose:

- track per-user AI docs, pages, and cost
- support fair-use logic and kill-switch operations

## Privacy and Compliance Rules

- Enhanced Accuracy is opt-in only in Phase 2.
- Source files must be processed through a secure server-side endpoint.
- Uploaded source files must be temporary.
- Temporary files should be deleted within 24 hours or less.
- AI outputs must never silently overwrite local outputs.
- No training on user documents in Phase 2.

## Product Rollout

### Phase 2.0

- add extractor interface
- add extraction session schema
- add upload toggle for Pro only
- build AI endpoint with local fallback
- store session, candidate, and decision data

### Phase 2.1

- update landing page with Enhanced Accuracy messaging
- launch to Pro users
- observe manual correction rates and extraction costs

### Phase 2.2

- auto-route scanned and low-confidence documents to enhanced extraction
- keep user-visible evidence and fallback behavior

## QA Test Plan

QA is required for Phase 2, not optional.

### Unit Tests

- extractor routing rules by plan and toggle
- fallback behavior when AI provider fails
- confidence fusion logic
- schema validation for AI JSON responses
- cost and page metering calculations

### Integration Tests

- upload with local-only path
- upload with enhanced path
- AI timeout -> local fallback
- review screen showing local vs AI disagreement
- decision persistence into review logs
- monthly AI usage aggregation

### Manual QA Scenarios

- clean text invoice on Pilot
- scanned invoice on Pro with toggle off
- scanned invoice on Pro with toggle on
- malformed AI response
- provider timeout
- cost cap or feature-disabled behavior
- privacy copy and consent wording

### Acceptance Gates

Do not call Phase 2 ready unless:

- average review time is under 30 seconds
- required edits are below 20%
- field accuracy is above 90%
- fallback creates no dead end
- AI usage is measurable per user

## Immediate Implementation Order

1. apply extraction session migration
2. refactor current local parser behind extractor contract
3. add enhanced extraction toggle and plan gating
4. build secure AI extraction edge function
5. persist field candidates and review decisions
6. add QA automation for routing, fallback, and review evidence

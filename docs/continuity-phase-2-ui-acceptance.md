# Continuity Phase 2 UI Acceptance

## Goal

Make the upload and review experience match the actual Phase 2 extraction behavior:

- local-first processing remains the baseline
- scanned or low-confidence documents may auto-escalate to enhanced extraction
- users can force enhanced extraction explicitly
- review must explain what Continuity did and why
- extraction failures or expired review state must recover gracefully without blank screens

## Upload Acceptance Criteria

1. The extraction control must distinguish between:
   - automatic routing when needed
   - user-forced enhanced extraction
2. Upload copy must explain that Continuity starts locally and may use enhanced extraction for scanned or low-confidence documents.
3. If the user forces enhanced extraction, the UI must say so explicitly before extraction starts.
4. If enhanced extraction is unavailable because of rollout or plan gating, the UI must say the app will use local processing only.
5. While extraction is running, the UI must show a truthful status message describing the expected path:
   - local only
   - local with possible auto-escalation
   - forced enhanced extraction
6. The Phase 1 privacy copy must remain explicit that encrypted source-document storage is not enabled.

## Review Acceptance Criteria

1. The review page must never render blank when route state is missing.
2. If review state is missing or expired, the page must show a recovery card with a clear path back to upload.
3. The extraction summary must show:
   - requested mode
   - final provider used
   - routing reason when enhanced extraction was automatic
   - fallback reason when enhanced extraction failed
   - AI usage and processing mode
4. The extraction summary must explain the difference between:
   - forced enhanced extraction
   - automatic enhanced extraction
   - local fallback
5. Changed-field comparison must remain limited to fields where AI changed the review value.

## QA Checklist

### Unit / Logic

1. Upload messaging reflects local-only, auto-routing, and forced-enhanced states.
2. Review routing reason text is correct for:
   - scanned document
   - low-confidence required fields
   - forced enhanced extraction
3. Review recovery state is rendered when route state is absent.

### Browser / Manual

1. Local extraction with enhanced toggle off keeps working for a clean digital invoice.
2. Forced enhanced extraction shows the extraction summary after review.
3. Automatic enhanced extraction shows the routing reason when a scanned or low-confidence document escalates.
4. Refreshing or deep-linking to `/review` shows a recovery state instead of a blank page.
5. Privacy copy on upload still states that encrypted source document storage is not enabled in Phase 1.

## Definition of Done

This UI pass is complete when:

- the upload page explains the real extraction logic
- the review page explains why enhanced extraction was or was not used
- missing review state no longer results in a blank screen
- automated tests cover the messaging logic and recovery state
- manual QA confirms upload -> review behavior on the production deployment

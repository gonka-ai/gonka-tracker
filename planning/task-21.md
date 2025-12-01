# Task 21: Participant Filter Controls

## Goal

Allow operators to focus on a curated subset of nodes by adding a searchable multi-select filter above the participant table and persist the selection in the URL so filtered views can be shared.

## Problem

- The participant table can list hundreds of entries, making it difficult to isolate specific hosts.
- Analysts repeatedly search for the same indexes and currently rely on browser find or manual scrolling.
- There is no way to share a filtered state; the dashboard URL always renders the full table.

## Solution

### UX

- Add a compact multi-select control directly above `ParticipantTable`.
- The control displays selected participant indexes as pills and exposes a dropdown with a search box.
- Search matches participant index and moniker (when available).
- Empty selection → show all rows; a non-empty selection limits the table to the chosen indexes.
- Show a quick action to clear all selections.
- When filters remove every row, display a short “No participants match filter” helper under the control.

### State & Routing

- New `participantFilter` state in `App.tsx` (array of participant indexes).
- Parse `participants` query param (comma-separated) on load to pre-populate the filter.
- Mirror state back to the URL (keep existing params intact). Removing the final selection removes the param.
- Continue supporting `participant` param for the row modal; the two query params must co-exist without clobbering each other.

### Components

- Add `ParticipantFilter` component (`frontend/src/components/ParticipantFilter.tsx`) that renders the dropdown and search.
- Extend `ParticipantTable` props with `visibleParticipants` (string array) and pass the setter so the table can host the filter control.
- Inside the table component, derive `displayParticipants` by filtering the sorted list with the provided indexes.

### Edge Cases

- If the URL includes invalid indexes, keep them in the control but show them as “missing” chips so the user can remove them.
- When the epoch changes, keep the filter state; chips with no matching participant are still shown so the operator remembers what they filtered for.

## Testing

- Manual: select several participants, confirm only those rows show up.
- Manual: refresh page and/or share URL, verify filters persist.
- Manual: clear filters, confirm table returns to full list and URL param disappears.



> npm run e2e

> dnd@0.0.0 e2e
> playwright test
> [WebServer] Node.js version v25.6.1 detected.
> [WebServer] Odd numbered Node.js versions will not enter LTS status and should not be used for production. For more information, please see https://nodejs.org/en/about/previous-releases/.

Running 456 tests using 6 workers
[chromium] › e2e/autoscroll-drift.spec.ts:71:3 › Autoscroll Placeholder Drift › placeholder should stay aligned with drag preview during autoscroll down
List1 Down - Placeholder: END_OF_LIST, ActualIdx: 50, ExpectedIdx: ~49, ScrollTop: 2100, IndexDrift: 1
[chromium] › e2e/autoscroll-drift.spec.ts:12:3 › Autoscroll Placeholder Drift › placeholder should stay aligned in List 2 during extended autoscroll
List2 Extended - Placeholder: END_OF_LIST, ActualIdx: 50, ExpectedIdx: ~49, ScrollTop: 2100, IndexDrift: 1
[chromium] › e2e/autoscroll-drift.spec.ts:318:3 › Autoscroll Placeholder Drift › placeholder should track preview position accurately with slow mouse movement

=== Cycle 1 ===
[chromium] › e2e/autoscroll-drift.spec.ts:463:3 › Autoscroll Placeholder Drift › no gap should remain after drop at maximum scroll
After drop - scrollTop: 2100, maxScroll: 2100, gap: 0, scrollHeight: 2500
[chromium] › e2e/autoscroll-drift.spec.ts:162:3 › Autoscroll Placeholder Drift › placeholder should stay aligned during autoscroll up
Up - Placeholder: END_OF_LIST, ActualIdx: 0, ExpectedIdx: ~0, ScrollTop: 0, IndexDrift: 0
[chromium] › e2e/autoscroll-drift.spec.ts:120:3 › Autoscroll Placeholder Drift › placeholder drift should not accumulate during extended autoscroll
Extended - Placeholder: END_OF_LIST, ActualIdx: 50, ExpectedIdx: ~49, ScrollTop: 2100, IndexDrift: 1
[chromium] › e2e/autoscroll-drift.spec.ts:236:3 › Autoscroll Placeholder Drift › cumulative drift should not occur during repeated up-down autoscroll cycles
Cycle 1: Bottom(scroll=2100, items=12) -> Top(scroll=0, items=12)
[chromium] › e2e/autoscroll-drift.spec.ts:206:3 › Autoscroll Placeholder Drift › placeholder should be accurate at absolute maximum scroll
Max scroll - placeholderIndex: 50
[chromium] › e2e/autoscroll-drift.spec.ts:236:3 › Autoscroll Placeholder Drift › cumulative drift should not occur during repeated up-down autoscroll cycles
Cycle 2: Bottom(scroll=2100, items=12) -> Top(scroll=0, items=12)
[chromium] › e2e/autoscroll-drift.spec.ts:318:3 › Autoscroll Placeholder Drift › placeholder should track preview position accurately with slow mouse movement

=== Cycle 2 ===
[chromium] › e2e/autoscroll-drift.spec.ts:236:3 › Autoscroll Placeholder Drift › cumulative drift should not occur during repeated up-down autoscroll cycles
Cycle 3: Bottom(scroll=2100, items=12) -> Top(scroll=0, items=12)
Cycle 4: Bottom(scroll=2100, items=12) -> Top(scroll=0, items=12)
[webkit] › e2e/autoscroll-drift.spec.ts:71:3 › Autoscroll Placeholder Drift › placeholder should stay aligned with drag preview during autoscroll down
List1 Down - Placeholder: END_OF_LIST, ActualIdx: 33, ExpectedIdx: ~32, ScrollTop: 1267, IndexDrift: 1
[webkit] › e2e/autoscroll-drift.spec.ts:12:3 › Autoscroll Placeholder Drift › placeholder should stay aligned in List 2 during extended autoscroll
List2 Extended - Placeholder: END_OF_LIST, ActualIdx: 40, ExpectedIdx: ~39, ScrollTop: 1611, IndexDrift: 1
[webkit] › e2e/autoscroll-drift.spec.ts:318:3 › Autoscroll Placeholder Drift › placeholder should track preview position accurately with slow mouse movement

=== Cycle 1 ===
[chromium] › e2e/autoscroll-drift.spec.ts:236:3 › Autoscroll Placeholder Drift › cumulative drift should not occur during repeated up-down autoscroll cycles
Cycle 5: Bottom(scroll=2100, items=12) -> Top(scroll=0, items=12)
After cycles - scrollTop: 0, scrollHeight: 2500
Visible items: 12
Final drag state: {
"isDragging": true,
"draggedItemId": "list1-0",
"sourceDroppable": "list-1",
"activeDroppable": "list-1",
"placeholder": "END_OF_LIST",
"placeholderIndex": 5
}
[webkit] › e2e/autoscroll-drift.spec.ts:162:3 › Autoscroll Placeholder Drift › placeholder should stay aligned during autoscroll up
Up - Placeholder: END_OF_LIST, ActualIdx: 13, ExpectedIdx: ~13, ScrollTop: 652, IndexDrift: 0
[webkit] › e2e/autoscroll-drift.spec.ts:120:3 › Autoscroll Placeholder Drift › placeholder drift should not accumulate during extended autoscroll
Extended - Placeholder: END_OF_LIST, ActualIdx: 50, ExpectedIdx: ~49, ScrollTop: 2100, IndexDrift: 1
[webkit] › e2e/autoscroll-drift.spec.ts:463:3 › Autoscroll Placeholder Drift › no gap should remain after drop at maximum scroll
After drop - scrollTop: 2100, maxScroll: 2100, gap: 0, scrollHeight: 2500
[webkit] › e2e/autoscroll-drift.spec.ts:236:3 › Autoscroll Placeholder Drift › cumulative drift should not occur during repeated up-down autoscroll cycles
Cycle 1: Bottom(scroll=1611, items=16) -> Top(scroll=0, items=12)
[webkit] › e2e/autoscroll-drift.spec.ts:414:5 › Autoscroll Placeholder Drift › WebKit-specific drift tests › Safari should not drift during rapid up-down autoscroll direction changes
Safari rapid direction change - drift: 1, actual: -1, expected: 0
[webkit] › e2e/autoscroll-drift.spec.ts:206:3 › Autoscroll Placeholder Drift › placeholder should be accurate at absolute maximum scroll
Max scroll - placeholderIndex: 50
[webkit] › e2e/autoscroll-drift.spec.ts:318:3 › Autoscroll Placeholder Drift › placeholder should track preview position accurately with slow mouse movement

=== Cycle 2 ===
[webkit] › e2e/autoscroll-drift.spec.ts:236:3 › Autoscroll Placeholder Drift › cumulative drift should not occur during repeated up-down autoscroll cycles
Cycle 2: Bottom(scroll=1611, items=16) -> Top(scroll=18, items=12)
Cycle 3: Bottom(scroll=1629, items=16) -> Top(scroll=18, items=12)
Cycle 4: Bottom(scroll=1629, items=16) -> Top(scroll=27, items=12)
Cycle 5: Bottom(scroll=1638, items=16) -> Top(scroll=36, items=12)
After cycles - scrollTop: 18, scrollHeight: 2500
Visible items: 12
Final drag state: {
"isDragging": true,
"draggedItemId": "list1-0",
"sourceDroppable": "list-1",
"activeDroppable": "list-1",
"placeholder": "END_OF_LIST",
"placeholderIndex": 5
}
[firefox] › e2e/autoscroll-drift.spec.ts:12:3 › Autoscroll Placeholder Drift › placeholder should stay aligned in List 2 during extended autoscroll
List2 Extended - Placeholder: END_OF_LIST, ActualIdx: 50, ExpectedIdx: ~49, ScrollTop: 2100, IndexDrift: 1
[firefox] › e2e/autoscroll-drift.spec.ts:71:3 › Autoscroll Placeholder Drift › placeholder should stay aligned with drag preview during autoscroll down
List1 Down - Placeholder: END_OF_LIST, ActualIdx: 50, ExpectedIdx: ~49, ScrollTop: 2100, IndexDrift: 1
[firefox] › e2e/autoscroll-drift.spec.ts:318:3 › Autoscroll Placeholder Drift › placeholder should track preview position accurately with slow mouse movement

=== Cycle 1 ===
[firefox] › e2e/autoscroll-drift.spec.ts:162:3 › Autoscroll Placeholder Drift › placeholder should stay aligned during autoscroll up
Up - Placeholder: END_OF_LIST, ActualIdx: 0, ExpectedIdx: ~0, ScrollTop: 0, IndexDrift: 0
[firefox] › e2e/autoscroll-drift.spec.ts:463:3 › Autoscroll Placeholder Drift › no gap should remain after drop at maximum scroll
After drop - scrollTop: 2100, maxScroll: 2100, gap: 0, scrollHeight: 2500
[firefox] › e2e/autoscroll-drift.spec.ts:120:3 › Autoscroll Placeholder Drift › placeholder drift should not accumulate during extended autoscroll
Extended - Placeholder: END_OF_LIST, ActualIdx: 50, ExpectedIdx: ~49, ScrollTop: 2100, IndexDrift: 1
[firefox] › e2e/autoscroll-drift.spec.ts:206:3 › Autoscroll Placeholder Drift › placeholder should be accurate at absolute maximum scroll
Max scroll - placeholderIndex: 50
[firefox] › e2e/autoscroll-drift.spec.ts:236:3 › Autoscroll Placeholder Drift › cumulative drift should not occur during repeated up-down autoscroll cycles
Cycle 1: Bottom(scroll=2100, items=12) -> Top(scroll=0, items=12)
[firefox] › e2e/autoscroll-drift.spec.ts:318:3 › Autoscroll Placeholder Drift › placeholder should track preview position accurately with slow mouse movement

=== Cycle 2 ===
[firefox] › e2e/autoscroll-drift.spec.ts:236:3 › Autoscroll Placeholder Drift › cumulative drift should not occur during repeated up-down autoscroll cycles
Cycle 2: Bottom(scroll=2100, items=12) -> Top(scroll=0, items=12)
Cycle 3: Bottom(scroll=2100, items=12) -> Top(scroll=0, items=12)
Cycle 4: Bottom(scroll=2100, items=12) -> Top(scroll=0, items=12)

1.  [firefox] › e2e/page-scroll.spec.ts:225:3 › Page Scroll Demo › should position drag placeholder correctly when scrolled

    Error: expect(locator).toBeVisible() failed

    Locator: locator('.vdnd-drag-placeholder-visible')
    Expected: visible
    Timeout: 2000ms
    Error: element(s) not found

    Call log:
    - Expect "toBeVisible" with timeout 2000ms
    - waiting for locator('.vdnd-drag-placeholder-visible')

    254 | // (The placeholder element is the authoritative representation of the computed drop position.)
    255 | const placeholder = page.locator('.vdnd-drag-placeholder-visible');

    > 256 | await expect(placeholder).toBeVisible({ timeout: 2000 });

           |                               ^

    257 | await expect(async () => {
    258 | const placeholderBox = await placeholder.boundingBox();
    259 | expect(placeholderBox).not.toBeNull();
    at /Users/crush/Projects/dnd/e2e/page-scroll.spec.ts:256:31

    Error Context: test-results/page-scroll-Page-Scroll-De-87894-der-correctly-when-scrolled-firefox/error-context.md

Cycle 5: Bottom(scroll=2100, items=12) -> Top(scroll=0, items=12)
After cycles - scrollTop: 0, scrollHeight: 2500
Visible items: 12
Final drag state: {
"isDragging": true,
"draggedItemId": "list1-0",
"sourceDroppable": "list-1",
"activeDroppable": "list-1",
"placeholder": "END_OF_LIST",
"placeholderIndex": 5
} 2) [firefox] › e2e/page-scroll.spec.ts:357:3 › Page Scroll Demo › should keep drag preview and placeholder visible during long autoscroll

    Error: expect(received).toBeLessThanOrEqual(expected)

    Expected: <= 38
    Received:    42

      497 |       contentType: 'application/json',
      498 |     });
    > 499 |     expect(maxDrift).toBeLessThanOrEqual(alignmentTolerance);
          |                      ^
      500 |
      501 |     await page.mouse.up();
      502 |   });
        at /Users/crush/Projects/dnd/e2e/page-scroll.spec.ts:499:22

    Error Context: test-results/page-scroll-Page-Scroll-De-298e3-ible-during-long-autoscroll-firefox/error-context.md

2 flaky
[firefox] › e2e/page-scroll.spec.ts:225:3 › Page Scroll Demo › should position drag placeholder correctly when scrolled
[firefox] › e2e/page-scroll.spec.ts:357:3 › Page Scroll Demo › should keep drag preview and placeholder visible during long autoscroll
3 skipped
451 passed (1.8m)

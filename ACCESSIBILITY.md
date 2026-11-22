# mdlite 0.1.1 — readable, low-glare interface

Candidate: 615f41292981a1a2d1c1543a91f374deef47e1c9. Private repository: https://github.com/priestkos/mdlite.

## Changes
- Document text21px, source/code20px, UI labels16–17px; headings25–36px.
- Main file/mode/formatting controls at least44px high; toolbar labels remain visible at small size.
- Warm cream paper, muted green-gray workspace, darker text and clearer borders rather than pure white.
- Three-pixel keyboard focus outlines; reduced-motion and Windows forced-color CSS accommodations.
- Compact windows hide sidebar below820px to retain writing space; native View menu retains zoom controls.
- No document/storage behavior or dependency versions changed. About dialog reads actual app version.

## Real verification
- Focused RED: old text14px instead of20px minimum and hidden toolbar labels at760px.
- Four accessibility tests pass: typography/target dimensions, sampled WCAG text contrast >=4.5:1, keyboard focus, nonwhite paper, distinct disabled styling; 1180x800 and760x540 control bounds.
- Windows CI https://github.com/priestkos/mdlite/actions/runs/45013924395: unit8 passed, source GUI18 passed, packaged GUI18 passed, portable launch/screenshot/clean close passed.
- Actual Windows screenshot inspected: larger type/cream surfaces/dark labels, no visible error or clipping. Automated dimensions, not visual font-size estimates, establish exact sizes.
- Download SHA256 matches Windows runner:b3cac72bcef78cf9b0a775720b37463dcc6a7f4cbf733d960c33819bb4e2f016.
- Local full suite was not entirely green: one run hit an asynchronous-resize test race (fixed by waiting for viewport), subsequent run15/17 with teardown and large-clipboard timeouts on slow Linux host. No assertion evidence of document regression; full clean Windows source+packaged runs are the release evidence, not the partial local run.
- Focused read-only review found disabled controls could look active. Reproduced with a failing computed-style test; fixed later-specific disabled styles (legible gray fill, dashed border), then all four focused tests passed. Windows run45013642073 exposed an editor-test teardown hang; cleanup now explicitly destroys only test windows, while dedicated native-close/portable tests still verify real close behavior. The subsequent complete Windows run passed. This is not a full WCAG conformance certification, assistive-technology test, or user trial on an elderly person's actual display.

## Artifact and records
Executable: windows-exe/v0.1.1-final/mdlite-windows-x64/release/mdlite-0.1.1-windows-x64.exe.
Evidence: evidence/accessibility-windows.log/json, accessibility-red.log, accessibility-green.log and screenshots; Windows artifact evidence under windows-exe/v0.1.1-final/mdlite-windows-x64/evidence.
Historical0.1.0 HANDOFF.md/VERIFICATION.md remain unchanged as history; this document is the current update report.

Unsigned Windows x64 build. Same limitations: rich-edit Markdown normalization, no autosave/image preview, UTF-8 file limit10MB. Production audit0; existing development minimatch advisory remains.

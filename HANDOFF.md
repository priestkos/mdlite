# mdlite verification and handoff

## Candidate and artifact
- Private repository: https://github.com/priestkos/mdlite
- Runtime candidate: cf06c328c8cfb9a9ea35777734848ef409068b98.
- Successful Windows workflow: https://github.com/priestkos/mdlite/actions/runs/44778387524
- Portable Windows x64 app: `windows-exe/delivery/mdlite-windows-x64/release/mdlite-0.1.0-windows-x64.exe`.
- Size: 111884224 bytes. SHA256: `fa9079887c47f5a3c9296208bfaed9b15e48790f678ea5e7c250be63a2be1295` (matches runner after download).
- The self-extracting NSIS launcher is PE32; it contains the x64 Electron application. No Node/Python install is required on the user's machine.
- Permanent checkout, reports and evidence: `/root/Projects/mdlite`. Source is committed/pushed, artifacts/evidence are gitignored and retained here. No public release, installer/file association or updater was published.

## Built
Single-document offline WYSIWYG Markdown editor, original teal SVG/PNG/ICO, simple labelled file controls, Edit/Read/Source, formatting toolbar, tasks/tables/code/lists, outline, word count, native dialogs, undo/redo, unsaved-change protection, external-change conflict checks and atomic same-directory publication. Runtime isolation denies arbitrary local resources, networking, navigation and popups. Raw HTML is literal; images are placeholders.

## Executed verification
- Linux standard Vite production build succeeded (relative paths required for file://).
- `npm test`: 8/8 pass.
- `xvfb-run -a npm run test:gui`: 14/14 pass, real Electron window and native IPC/file store (dialogs substituted in test process only).
- Windows runner: same 8 unit tests and 14 GUI tests passed from source, then 14 passed against packaged `win-unpacked/mdlite.exe`.
- Portable launcher separately opened the actual UI, native frame captured, clean close and launcher cleanup passed.
- Actual final Windows screenshot visually inspected: title, icon, menus and editor rendered; no visible error. This is Windows CI evidence, not testing on a consumer Windows11 machine or all DPI/accessibility configurations.
- `npm audit --omit=dev`:0 vulnerabilities. Full audit retains6 moderate build-chain reports rooted in minimatch; GitHub has1 development-scope moderate advisory. No blind dependency override/downgrade applied.

## Review findings and fixes
Original report retained at `evidence/review.md`.
- R1: invalid/oversize draft synchronization lost dirty state; fixed by retaining drafts independently of save validation and routing close through renderer change queue plus main confirmation. Same-turn input/close and invalid-draft close regression tests included.
- R2: global `<` replacement corrupted code; fixed with HTML-token-only inert lexer. Fenced/inline code retained after unrelated rich edit; HTML safety regression retained.
- R3: NUL-save/read inconsistency; fixed by rejecting NUL at save without dropping the draft or marking clean.
- Focused independent follow-up: R2/R3 verified repaired in `evidence/review-followup.md`; the remaining large-paste R1 was fixed in cf06c32 and independently verified no longer reproducing in `evidence/review-final.md`. Large metadata work is bounded and draft synchronization happens first. All three reported findings are dispositioned; review is scoped, not exhaustive.

## Evidence index and history
- `evidence/windows-delivery.log`, `local-final2-gui.log`, `large-paste-red.log` and `large-paste-green.log`.
- `windows-exe/delivery/mdlite-windows-x64/evidence/`: native/editor PNGs, portable smoke title and runner hash.
- Older `windows-exe/first-run`, `verified`, and `final` are historical builds superseded by `delivery`; do not distribute them. First CI failed only from a harness taskkill race after portable opened. The earlier green runtime was subsequently repaired for the review findings.

## Limits
Unsigned executable: Windows SmartScreen may warn; verify source before running. UTF-8 `.md`/`.markdown`,10 MB file boundary; unsavable drafts remain protected but must be reduced/corrected to save. No autosave/crash recovery. Rich edits normalize Markdown; advanced HTML/YAML/extensions may change, so use Source. No local/remote image preview, math/Mermaid, tabs or file association installer. File conflict validation is not a hostile concurrent-filesystem transaction. Electron increases package size relative to pdflite.

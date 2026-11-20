# Discovery findings

- pdflite at /root/Projects/pdflite is private priestkos/pdflite; Python/Tk GUI, offline, large labelled controls, Windows portable distribution, no telemetry or updater. Inspected README and app.py; no edits there.
- New mdlite repository did not exist in authenticated account catalogue before work. GitHub gh authenticated as priestkos with repo/workflow scope.
- Runtime here is Linux; Windows artifacts must build and run on GitHub Windows runners, not claim Linux checks prove Windows desktop compatibility.
- Chose Electron 45.4.1 + TipTap 3.35.0, exact versions pinned with lockfile. Electron costs package size but supplies a maintained editing engine rather than inventing a Markdown editor in Tk.
- UI warm minimal paper/teal design, system fonts, local assets only. Read/Source modes accompany rich edit; arbitrary Markdown syntax is NOT losslessly representable by rich-text editing.
- Runtime npm audit --omit=dev reports zero vulnerabilities. Full initial audit reports six moderate dev/build-chain advisories through electron-builder minimatch dependencies. No blind force downgrade/major override; retain exact audit evidence and document limitation.
- File writes are same-directory temporary + rename, protecting against ordinary partial writes. Existing active file contents are checked before save; this is not a hostile-filesystem transaction and does not claim concurrent-process race immunity.
- Main process owns file dialogs, size/UTF-8 validation, dirty snapshot, unsaved prompts, atomic save. Renderer cannot choose arbitrary file paths for IPC saves.

# mdlite

A calm, offline Markdown editor for Windows. Open a `.md` file, edit the formatted page, and save ordinary Markdown. Inspired by pdflite's simple, labelled controls.

## First version

- **Edit** for visual writing, **Read** for viewing, **Source** for raw Markdown.
- Formatting toolbar, headings, lists, checklists, tables, quotes and code.
- Document outline, word count, undo/redo and standard file shortcuts.
- Native Open / Save / Save as dialogs; unsaved-change prompts.
- Original teal document icon. Local system fonts; no accounts or telemetry.

## Use

Run the portable `mdlite-0.1.0-windows-x64.exe`. No Node.js installation is required. Builds are unsigned and Windows may show a SmartScreen warning; verify the download source before running. No automatic updater or public release is configured.

**Ctrl+N** New · **Ctrl+O** Open · **Ctrl+S** Save · **Ctrl+Shift+S** Save as.

Open and save dialogs support `.md` / `.markdown`. UTF-8 only, maximum 10 MB. Use Source for advanced Markdown. **Rich-text editing can normalize whitespace, list markers and other syntax, and does not preserve every Markdown extension.** Merely viewing a file or changing modes should not rewrite its source. External images, HTML execution and link navigation are disabled for safety. This version does not preview local images, render math/Mermaid, or provide an automatic recovery/autosave system.

Saving checks for changes made outside mdlite and asks you to use Save as rather than overwrite them. Same-directory temporary writes avoid ordinary partial-write corruption; this is not a concurrent or hostile-filesystem transaction. Keep backups of important work.

## Development

Use a supported Node.js version (Windows CI: Node 24):

```sh
npm ci
npm test
npm run build
npm run test:gui
npm start
```

On headless Linux: `xvfb-run -a npm run test:gui`. Linux is a development test host, not the target distribution.

Windows portable build:

```powershell
npm run pack:win
```

GitHub Actions builds and tests on a Windows runner, exercises the packaged application and smoke-tests the portable launcher. It uploads a private workflow artifact; it does not publish a release. Exact verification results and known gaps belong in [HANDOFF.md](HANDOFF.md).

## Records

- [Product/design plan](PLAN.md)
- [Authoritative execution plan](task_plan.md)
- [Progress](progress.md), [findings](findings.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

Private source; no public source licence has been selected.

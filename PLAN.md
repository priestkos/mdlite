# mdlite 0.1 scope

A local-only Windows Markdown editor with Edit, Read and Source views, a document outline, formatting tools and native file dialogs. No accounts, cloud sync, analytics or network access. The app stores files locally and does not navigate links or load Markdown images. Original folded-page M/download mark is generated as PNG and ICO from the SVG.

Source text is kept exactly as opened, including line endings and BOM, until a user actually edits it. Switching views and saving without changes do not serialize the rich editor. Rich edits necessarily normalize Markdown and may lose unsupported features including raw HTML, YAML front matter, custom Markdown extensions and formatting details. Use Source for these documents; conversion is not lossless. Raw HTML is rendered inert, links cannot navigate, and images are represented by placeholders without fetching resources. Source editing uses a browser textarea, which normalizes line endings on actual edits; untouched source is retained exactly.

Native document actions are serialized and errors shown in the status bar. Main-process close protection, external change detection, and native dialogs are handled by the narrow preload bridge. Windows packaged execution and platform-specific integration require verification on Windows; GUI tests use the real Electron app with an isolated user data directory.

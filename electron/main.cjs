const { app, BrowserWindow, dialog, ipcMain, Menu, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { DocumentStore } = require('./documents.cjs');
const { isAppResource } = require('./resources.cjs');

if (process.env.MDLITE_TEST_USER_DATA) app.setPath('userData', process.env.MDLITE_TEST_USER_DATA);
const welcome = `# A little space to think\n\nWelcome to **mdlite**. A simple home for your Markdown.\n\n## Make it yours\n\nWrite naturally, or use the toolbar to add a little structure. Your words stay on your computer.\n\n- **Edit** — format your words, not your syntax.\n- **Read** — step back and enjoy the page.\n- **Source** — work directly with Markdown.\n\n## A small checklist\n\n- [x] Find a quieter place to write\n- [ ] Open a Markdown file\n- [ ] Make something worth keeping\n\n> Less interface. More room for your ideas.\n\n## Start with a thought\n\nChoose **New** for a blank page, or **Open** to pick up where you left off.\n`;
const store = new DocumentStore(welcome);
let window;
let busy = false;
let allowClose = false;
const entry = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href;

function updateTitle() {
  window.setTitle(`${store.snapshot().dirty ? '● ' : ''}${store.path ? path.basename(store.path) : 'Untitled'} — mdlite`);
  window.setDocumentEdited(store.snapshot().dirty);
}

async function saveDocument(text, saveAs) {
  store.changed(text);
  let target = store.path;
  if (!target || saveAs) {
    const result = await dialog.showSaveDialog(window, {
      title: 'Save Markdown', defaultPath: target || 'Untitled.md',
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    if (result.canceled || !result.filePath) return null;
    target = result.filePath;
    if (!path.extname(target)) target += '.md';
    if (target !== store.path) {
      try {
        await fs.lstat(target);
        const answer = await dialog.showMessageBox(window, {
          type: 'warning', message: 'Replace this file?', detail: target,
          buttons: ['Cancel', 'Replace'], defaultId: 0, cancelId: 0, noLink: true,
        });
        if (answer.response !== 1) return null;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  const document = await store.save(target, text, true);
  updateTitle();
  return document;
}

async function confirmDiscard() {
  if (!store.snapshot().dirty) return true;
  const result = await dialog.showMessageBox(window, {
    type: 'question', message: 'Save your changes?',
    detail: 'Your unsaved changes will be lost if you discard them.',
    buttons: ['Save', 'Discard', 'Cancel'], defaultId: 0, cancelId: 2, noLink: true,
  });
  if (result.response === 1) return true;
  if (result.response === 2) return false;
  return Boolean(await saveDocument(store.text, false));
}

async function openDocument(target) {
  if (!await confirmDiscard()) return null;
  if (!target) {
    const result = await dialog.showOpenDialog(window, {
      title: 'Open Markdown', properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    if (result.canceled || !result.filePaths.length) return null;
    target = result.filePaths[0];
  }
  const document = await store.open(target);
  updateTitle();
  return document;
}

function register(channel, operation) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      throw new Error('This request is not from the editor.');
    }
    if (channel === 'document:get') return store.snapshot();
    if (channel === 'document:changed') {
      if (busy) throw new Error('A document operation is already in progress.');
      store.changed(args[0]); updateTitle(); return;
    }
    if (busy) throw new Error('A document operation is already in progress.');
    busy = true;
    try { return await operation(...args); }
    finally { busy = false; updateTitle(); }
  });
}

function showError(error) { dialog.showErrorBox('mdlite could not complete that', error.message); }

async function createWindow() {
  // Local app resources only: Markdown can never request remote images or scripts.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAppResource(details.url, path.join(__dirname, '..')) });
  });
  window = new BrowserWindow({
    width: 1180, height: 800, minWidth: 760, minHeight: 540,
    backgroundColor: '#f5f5f2', icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  register('document:get', () => store.snapshot());
  register('document:changed', text => store.changed(text));
  register('document:open', () => openDocument());
  register('document:new', async () => {
    if (!await confirmDiscard()) return null;
    return store.reset();
  });
  register('document:close', async () => {
    if (await confirmDiscard()) {
      allowClose = true;
      setImmediate(() => window.destroy());
    }
  });
  register('document:save', (text, saveAs) => {
    if (typeof saveAs !== 'boolean') throw new Error('Invalid save request.');
    return saveDocument(text, saveAs);
  });
  const command = name => () => window.webContents.send('command', name);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [
      { label: 'New', click: command('new') },
      { label: 'Open…', click: command('open') },
      { label: 'Save', click: command('save') },
      { label: 'Save as…', click: command('save-as') },
      { type: 'separator' }, { role: 'quit' },
    ] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
    { label: 'Help', submenu: [{ label: 'About mdlite', click: () => dialog.showMessageBox(window, {
      type: 'info', message: `mdlite ${app.getVersion()}`, detail: 'A calm, offline Markdown editor.\n\nRich-text edits normalize Markdown. Use Source for advanced syntax. External images and links are disabled.\n\nCtrl+N New · Ctrl+O Open · Ctrl+S Save · Ctrl+Shift+S Save as',
    }) }] },
  ]));
  window.on('close', event => {
    if (allowClose) return;
    event.preventDefault();
    if (busy) return;
    // Route native close through the renderer's edit queue before consulting
    // the store; even same-turn edits must reach the unsaved-changes prompt.
    window.webContents.send('command', 'close');
  });
  await window.loadURL(entry);
  updateTitle();
  const target = process.argv.find((arg, index) => index > 0 && /\.(md|markdown)$/i.test(arg) && !arg.startsWith('--'));
  if (target) {
    try { window.webContents.send('document', await openDocument(path.resolve(target))); }
    catch (error) { showError(error); }
  }
}

app.whenReady().then(createWindow).catch(error => { showError(error); app.quit(); });
app.on('window-all-closed', () => app.quit());

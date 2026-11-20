import fs from 'node:fs/promises';
import path from 'node:path';
const locations = new Map();
// Resolve the production closure from the lockfile so scoped and nested
// packages retain their notices.
const lock = JSON.parse(await fs.readFile('package-lock.json', 'utf8'));
for (const [relative, pkg] of Object.entries(lock.packages)) {
  if (relative && !pkg.dev) locations.set(path.resolve(relative), relative.replaceAll('node_modules/', ''));
}
await fs.mkdir('notices', { recursive: true });
for (const [directory, name] of locations) {
  let entries;
  try { entries = await fs.readdir(directory); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  for (const entry of entries.filter(name => /^(licen[cs]e|copying|notice)/i.test(name))) {
    const source = path.join(directory, entry);
    if (!(await fs.stat(source)).isFile()) continue;
    const destination = path.join('notices', name.replaceAll('/', '__'), entry);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
  }
}
for (const name of ['LICENSE', 'LICENSES.chromium.html']) {
  await fs.copyFile(path.join('node_modules', 'electron', 'dist', name), path.join('notices', `electron-${name}`));
}
console.log(`Collected notices for ${locations.size} production package locations plus Electron.`);

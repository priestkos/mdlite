const path = require('node:path');
const { fileURLToPath } = require('node:url');

function isAppResource(url, appRoot) {
  try {
    const file = fileURLToPath(url);
    return ['dist', 'assets'].some(folder => {
      const relative = path.relative(path.join(appRoot, folder), file);
      return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
    });
  } catch { return false; }
}
module.exports = { isAppResource };

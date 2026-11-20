const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { isAppResource } = require('../electron/resources.cjs');

test('renderer resource boundary allows bundles and icon but blocks arbitrary local files and network', () => {
  const root = path.resolve('fixture-app');
  const url = relative => pathToFileURL(path.join(root, relative)).href;
  assert.equal(isAppResource(url('dist/index.html'), root), true);
  assert.equal(isAppResource(url('dist/assets/main.js'), root), true);
  assert.equal(isAppResource(url('assets/icon.png'), root), true);
  for (const forbidden of [url('electron/main.cjs'), url('../secret.txt'), url('dist-other/secret'), 'https://example.com/', 'file://remote-host/share/file', 'data:text/html,hello', 'not a url']) {
    assert.equal(isAppResource(forbidden, root), false, forbidden);
  }
});

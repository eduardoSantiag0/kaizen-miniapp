// @sabaki/sgf unconditionally `require`s 'fs' in parse.js, and optionally
// pulls in 'iconv-lite' and 'jschardet' for Node-only buffer-encoding
// detection — none of which this app uses (it only calls sgf.parse(text)).
// The package's own README asks bundler users to treat fs/jschardet/iconv-lite
// as externals; this project's bundler (Angular's esbuild builder) has no such
// hook, so instead we replace the two nested optional packages with empty
// stubs after every install. 'fs' itself is handled as a plain top-level
// dependency (see package.json) since it isn't a real npm dependency edge.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const targets = [
  { name: 'iconv-lite', vendor: 'empty-iconv-lite' },
  { name: 'jschardet', vendor: 'empty-jschardet' },
];

for (const { name, vendor } of targets) {
  const dest = path.join(root, 'node_modules', '@sabaki', 'sgf', 'node_modules', name);
  const src = path.join(root, 'vendor', vendor);

  if (!fs.existsSync(path.join(root, 'node_modules', '@sabaki', 'sgf'))) continue;

  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(path.join(src, 'package.json'), path.join(dest, 'package.json'));
  fs.copyFileSync(path.join(src, 'index.js'), path.join(dest, 'index.js'));
}

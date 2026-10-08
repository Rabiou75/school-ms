import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'desktop/electron-builder.yml');

const content = [
  "appId: cm.schoolms.desktop",
  "productName: School MS",
  "copyright: Copyright 2026 School MS",
  "",
  "directories:",
  "  output: dist",
  "  buildResources: build",
  "",
  "files:",
  "  - main.js",
  "  - splash.html",
  "  - package.json",
  "",
  "extraResources:",
  "  - from: embed",
  "    to: runtime",
  "",
  "asar: false",
  "",
  "win:",
  "  target:",
  "    - target: nsis",
  "      arch: [x64]",
  "    - target: portable",
  "      arch: [x64]",
  "  artifactName: ${productName}-${version}-${arch}.${ext}",
  "",
  "nsis:",
  "  oneClick: false",
  "  perMachine: false",
  "  allowToChangeInstallationDirectory: true",
  "  createDesktopShortcut: true",
  "  createStartMenuShortcut: true",
  "  shortcutName: School MS",
  ""
].join('\n');

writeFileSync(path, content, 'utf8');
console.log('OK electron-builder.yml — embed now goes to resources/runtime');
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'desktop/main.js');
let s = readFileSync(path, 'utf8');

// 1. Change RESOURCES/RUNTIME resolution
const before = "const RESOURCES = app.isPackaged ? process.resourcesPath : join(__dirname, '..');";
const after  = "const RESOURCES = app.isPackaged ? process.resourcesPath : join(__dirname, '..');\nconst RUNTIME = app.isPackaged ? join(RESOURCES, 'runtime') : join(__dirname, '..');";

if (s.includes(before) && !s.includes('const RUNTIME')) {
  s = s.replace(before, after);
  console.log('  + added RUNTIME constant');
} else if (s.includes('const RUNTIME')) {
  console.log('  = RUNTIME already defined');
}

// 2. Replace RESOURCES with RUNTIME in paths that need the app runtime
// (but keep RESOURCES for the app.asar-based paths — actually with asar:false,
// app files are at resources/app/, so paths should use RUNTIME)

// Prisma CLI path
s = s.replace(
  /const prismaCli = join\(RESOURCES, 'app', 'packages', 'database', 'node_modules', 'prisma', 'build', 'index\.js'\);/,
  "const prismaCli = join(RUNTIME, 'node_modules', 'prisma', 'build', 'index.js');"
);
s = s.replace(
  /const schemaPath = join\(RESOURCES, 'app', 'packages', 'database', 'prisma', 'schema\.prisma'\);/,
  "const schemaPath = join(RUNTIME, 'node_modules', '@school', 'database', 'prisma', 'schema.prisma');"
);
s = s.replace(
  /const seedPath = join\(RESOURCES, 'app', 'packages', 'database', 'prisma', 'seed\.js'\);/,
  "const seedPath = join(RUNTIME, 'node_modules', '@school', 'database', 'prisma', 'seed.js');"
);

// API entry
s = s.replace(
  /const apiEntry = join\(RESOURCES, 'app', 'apps', 'api', 'dist', 'main\.js'\);/,
  "const apiEntry = join(RUNTIME, 'apps', 'api', 'dist', 'main.js');"
);

// Web entry
s = s.replace(
  /const webEntry = join\(RESOURCES, 'app', 'apps', 'web', '\.next', 'standalone', 'apps', 'web', 'server\.js'\);/,
  "const webEntry = join(RUNTIME, 'apps', 'web', '.next', 'standalone', 'apps', 'web', 'server.js');"
);
s = s.replace(
  /const fallback = join\(RESOURCES, 'app', 'apps', 'web', '\.next', 'standalone', 'server\.js'\);/,
  "const fallback = join(RUNTIME, 'apps', 'web', '.next', 'standalone', 'server.js');"
);

// Web cwd
s = s.replace(
  /cwd: join\(RESOURCES, 'app', 'apps', 'web'\)/,
  "cwd: join(RUNTIME, 'apps', 'web')"
);

// NODE_PATH so API can resolve @school/* and @prisma/client
// (In the apiProc spawn env)
if (!s.includes('NODE_PATH')) {
  s = s.replace(
    /(apiProc = spawn\(process\.execPath, \[apiEntry\], \{[\s\S]*?env: \{)([\s\S]*?)(\},)/,
    (m, head, body, tail) => head + body + "      NODE_PATH: join(RUNTIME, 'node_modules'),\n" + tail
  );
  console.log('  + NODE_PATH for API');
}

if (!s.includes("NODE_PATH: join(RUNTIME, 'node_modules'),\n      PORT")) {
  // Web env — add NODE_PATH too
  s = s.replace(
    /(webProc = spawn\(process\.execPath, \[entry\], \{[\s\S]*?env: \{)([\s\S]*?)(\},)/,
    (m, head, body, tail) => head + body + "      NODE_PATH: join(RUNTIME, 'node_modules'),\n" + tail
  );
  console.log('  + NODE_PATH for Web');
}

writeFileSync(path, s, 'utf8');
console.log('OK main.js paths updated to use RUNTIME');
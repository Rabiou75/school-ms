import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

// Robust font resolver: walks up from __dirname to find the assets folder
const resolver = `
// ---- Robust font path resolution ----
// The runtime cwd is unpredictable (apps/api, monorepo root, docker /app).
// Walk up from this file's directory to locate the assets folder.
import { fileURLToPath } from 'node:url';
const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = __filename_.substring(0, __filename_.lastIndexOf('\\\\'));

function findAssetsDir(): string {
  const candidates: string[] = [];
  let dir = __dirname_;
  for (let i = 0; i < 6; i++) {
    candidates.push(join(dir, 'assets'));
    candidates.push(join(dir, 'apps', 'api', 'assets'));
    dir = join(dir, '..');
  }
  candidates.push(join(process.cwd(), 'assets'));
  candidates.push(join(process.cwd(), 'apps', 'api', 'assets'));

  for (const c of candidates) {
    try {
      if (existsSync(join(c, 'Amiri-Regular.ttf'))) return c;
    } catch {}
  }
  return '';
}

const ASSETS_DIR = findAssetsDir();
const AMIRI_REGULAR = ASSETS_DIR ? join(ASSETS_DIR, 'Amiri-Regular.ttf') : '';
const AMIRI_BOLD    = ASSETS_DIR ? join(ASSETS_DIR, 'Amiri-Bold.ttf')    : '';

// Log once so we can see what happened at runtime
if (!ASSETS_DIR) {
  console.warn('[pdf] Amiri fonts not found — Arabic will fall back to Helvetica (garbled)');
} else {
  console.log('[pdf] Amiri fonts loaded from: ' + ASSETS_DIR);
}
`;

function patchFile(relPath, label) {
  const p = join(root, relPath);
  let s = readFileSync(p, 'utf8');

  if (s.includes('findAssetsDir')) {
    console.log('  = ' + label + ' already patched');
    return;
  }

  // Remove existing FONT_DIR / AMIRI_* constants
  s = s.replace(/const FONT_DIR = [^\n]+\n/, '');
  s = s.replace(/const AMIRI_REGULAR = [^\n]+\n/, '');
  s = s.replace(/const AMIRI_BOLD = [^\n]+\n/, '');

  // Insert resolver right after the pdfkit import
  s = s.replace(
    "import PDFDocument from 'pdfkit';",
    "import PDFDocument from 'pdfkit';\n" + resolver
  );

  // Update registerFonts to use the resolved paths
  s = s.replace(
    /function registerFonts\(doc: any\): boolean \{[^}]*\}/,
    `function registerFonts(doc: any): boolean {
  if (!AMIRI_REGULAR || !AMIRI_BOLD) return false;
  if (!existsSync(AMIRI_REGULAR) || !existsSync(AMIRI_BOLD)) return false;
  try {
    doc.registerFont('Amiri', AMIRI_REGULAR);
    doc.registerFont('Amiri-Bold', AMIRI_BOLD);
    return true;
  } catch {
    return false;
  }
}`
  );

  writeFileSync(p, s, 'utf8');
  console.log('  + ' + label + ' patched');
}

patchFile('apps/api/src/payments/receipt.service.ts', 'receipt.service.ts');
patchFile('apps/api/src/exams/report-card.service.ts', 'report-card.service.ts');

console.log('\n✅ Font path fixed');
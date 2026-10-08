import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

// Simple path resolver using __dirname (works in CommonJS)
// Nest source:   apps/api/src/payments/     -> ../../assets = apps/api/assets
// Nest compiled: apps/api/dist/payments/    -> ../../assets = apps/api/assets
const resolverHeader = [
  "import { existsSync } from 'node:fs';",
  "import { join } from 'node:path';",
  "",
  "const FONT_CANDIDATES = [",
  "  join(__dirname, '..', '..', 'assets'),",
  "  join(__dirname, '..', '..', '..', 'assets'),",
  "  join(process.cwd(), 'assets'),",
  "  join(process.cwd(), 'apps', 'api', 'assets'),",
  "];",
  "",
  "function findAssetsDir(): string {",
  "  for (const dir of FONT_CANDIDATES) {",
  "    try { if (existsSync(join(dir, 'Amiri-Regular.ttf'))) return dir; } catch {}",
  "  }",
  "  return '';",
  "}",
  "",
  "const ASSETS_DIR = findAssetsDir();",
  "const AMIRI_REGULAR = ASSETS_DIR ? join(ASSETS_DIR, 'Amiri-Regular.ttf') : '';",
  "const AMIRI_BOLD    = ASSETS_DIR ? join(ASSETS_DIR, 'Amiri-Bold.ttf')    : '';",
  "",
  "if (!ASSETS_DIR) console.warn('[pdf] Amiri fonts not found — Arabic will be garbled');",
  "else console.log('[pdf] Amiri fonts loaded from: ' + ASSETS_DIR);",
  "",
  "function registerFonts(doc: any): boolean {",
  "  if (!AMIRI_REGULAR || !AMIRI_BOLD) return false;",
  "  if (!existsSync(AMIRI_REGULAR) || !existsSync(AMIRI_BOLD)) return false;",
  "  try {",
  "    doc.registerFont('Amiri', AMIRI_REGULAR);",
  "    doc.registerFont('Amiri-Bold', AMIRI_BOLD);",
  "    return true;",
  "  } catch { return false; }",
  "}",
  "",
  "function bidi(text: string): string {",
  "  if (!text) return text;",
  "  const re = /[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]+/g;",
  "  const out: string[] = [];",
  "  let last = 0; let m: RegExpExecArray | null;",
  "  while ((m = re.exec(text)) !== null) {",
  "    out.push(text.slice(last, m.index));",
  "    out.push(m[0].split('').reverse().join(''));",
  "    last = m.index + m[0].length;",
  "  }",
  "  out.push(text.slice(last));",
  "  return out.join('');",
  "}",
  "",
  "async function bufferFromDoc(doc: any): Promise<Buffer> {",
  "  const chunks: Buffer[] = [];",
  "  return new Promise<Buffer>((resolve, reject) => {",
  "    doc.on('data', (c: Buffer) => chunks.push(c));",
  "    doc.on('end', () => resolve(Buffer.concat(chunks)));",
  "    doc.on('error', reject);",
  "    doc.end();",
  "  });",
  "}",
  ""
].join('\n');

function patchFile(relPath) {
  const p = join(root, relPath);
  let s = readFileSync(p, 'utf8');

  // Strip out any previous font helper code (the broken import.meta block)
  s = s.replace(/\/\/ ---- Robust font path resolution ----[\s\S]*?^}\n/m, '');
  s = s.replace(/const FONT_DIR = [^\n]+\n/g, '');
  s = s.replace(/const AMIRI_REGULAR = [^\n]+\n/g, '');
  s = s.replace(/const AMIRI_BOLD = [^\n]+\n/g, '');
  s = s.replace(/import \{ existsSync \} from 'node:fs';\n/g, '');
  s = s.replace(/import \{ join \} from 'node:path';\n/g, '');
  s = s.replace(/import \{ fileURLToPath \} from 'node:url';\n/g, '');
  s = s.replace(/const __filename_ = [^\n]+\n/g, '');
  s = s.replace(/const __dirname_ = [^\n]+\n/g, '');
  s = s.replace(/function findAssetsDir\(\): string \{[\s\S]*?^}\n/m, '');
  s = s.replace(/function registerFonts\(doc: any\): boolean \{[\s\S]*?^}\n/m, '');
  s = s.replace(/function bidi\(text: string\): string \{[\s\S]*?^}\n/m, '');
  s = s.replace(/async function bufferFromDoc\(doc: any\): Promise<Buffer> \{[\s\S]*?^}\n/m, '');
  s = s.replace(/^\/\/ Helper[\s\S]*?$/m, '');

  // Insert fresh helper block right after the pdfkit import
  s = s.replace(
    "import PDFDocument from 'pdfkit';",
    "import PDFDocument from 'pdfkit';\n\n" + resolverHeader
  );

  writeFileSync(p, s, 'utf8');
  console.log('  + ' + relPath);
}

patchFile('apps/api/src/payments/receipt.service.ts');
patchFile('apps/api/src/exams/report-card.service.ts');

console.log('\n✅ Font resolvers rewritten (CommonJS-safe)');
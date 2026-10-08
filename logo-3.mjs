import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const path = join(root, 'apps/web/app/[locale]/dashboard/settings/page.tsx');
let s = readFileSync(path, 'utf8');

if (s.includes('LogoUpload')) {
  console.log('= LogoUpload already present');
} else {
  const component = [
    "function LogoUpload({ currentUrl, onUploaded }: { currentUrl: string | null; onUploaded: (url: string) => void }) {",
    "  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';",
    "  const [uploading, setUploading] = useState(false);",
    "  const [err, setErr] = useState<string | null>(null);",
    "",
    "  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {",
    "    const f = e.target.files?.[0];",
    "    if (!f) return;",
    "    if (f.size > 2 * 1024 * 1024) { setErr('Fichier trop volumineux (max 2 Mo)'); return; }",
    "    setUploading(true); setErr(null);",
    "    try {",
    "      const token = localStorage.getItem('accessToken');",
    "      const fd = new FormData();",
    "      fd.append('file', f);",
    "      const res = await fetch(API_URL + '/api/v1/settings/logo', {",
    "        method: 'POST',",
    "        headers: { Authorization: 'Bearer ' + token },",
    "        body: fd,",
    "      });",
    "      if (!res.ok) throw new Error(await res.text());",
    "      const data = await res.json();",
    "      onUploaded(data.logoUrl);",
    "    } catch (e: any) { setErr(String(e)); }",
    "    finally { setUploading(false); }",
    "  };",
    "",
    "  const full = currentUrl ? (currentUrl.startsWith('http') ? currentUrl : API_URL + currentUrl) : null;",
    "",
    "  return (",
    "    <div className=\"rounded-lg border border-gray-200 bg-gray-50 p-3\">",
    "      <div className=\"mb-2 text-xs font-medium uppercase tracking-wide text-gray-600\">Logo</div>",
    "      <div className=\"flex items-center gap-3\">",
    "        {full ? (",
    "          <img src={full} alt=\"logo\" className=\"h-16 w-16 rounded bg-white object-contain p-1 shadow-sm\" />",
    "        ) : (",
    "          <div className=\"flex h-16 w-16 items-center justify-center rounded bg-white text-2xl shadow-sm\">🏫</div>",
    "        )}",
    "        <div>",
    "          <input type=\"file\" accept=\"image/png,image/jpeg,image/webp,image/svg+xml\" onChange={handleFile} disabled={uploading} className=\"text-xs\" />",
    "          <p className=\"mt-1 text-[10px] text-gray-500\">PNG, JPG, WEBP ou SVG - max 2 Mo</p>",
    "        </div>",
    "      </div>",
    "      {err && <p className=\"mt-2 text-xs text-red-600\">{err}</p>}",
    "      {uploading && <p className=\"mt-2 text-xs text-gray-500\">Envoi en cours...</p>}",
    "    </div>",
    "  );",
    "}",
    "",
    ""
  ].join('\n');

  // Insert before SchoolTab
  if (s.includes('function SchoolTab() {')) {
    s = s.replace('function SchoolTab() {', component + 'function SchoolTab() {');
  }

  // Insert the LogoUpload inside SchoolTab
  const anchor = '<div className="max-w-2xl space-y-4 rounded-xl border bg-white p-6">';
  if (s.includes(anchor)) {
    s = s.replace(
      anchor,
      anchor + '\n      <LogoUpload currentUrl={form.logoUrl} onUploaded={(url) => setForm({ ...form, logoUrl: url })} />'
    );
  }

  writeFileSync(path, s, 'utf8');
  console.log('+ settings/page.tsx (LogoUpload)');
}

console.log('\nOK logo-3 done');
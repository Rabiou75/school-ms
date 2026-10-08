import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const L = (a) => a.join('\n');

// ============================================================
// 1. Add testEmail method to NotificationsService
// ============================================================
{
  const p = join(root, 'apps/api/src/notifications/notifications.service.ts');
  let s = readFileSync(p, 'utf8');

  if (s.includes('async testEmail(')) {
    console.log('  = notifications.service.ts already has testEmail');
  } else {
    // Add BadRequestException to imports if missing
    if (!s.includes('BadRequestException')) {
      s = s.replace(
        "import { Injectable, Logger } from '@nestjs/common';",
        "import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';"
      );
    }
    if (!s.includes('NotFoundException')) {
      s = s.replace(
        /import \{ ([^}]+) \} from '@nestjs\/common';/,
        (m, g) => {
          if (g.includes('NotFoundException')) return m;
          return "import { " + g.trim() + ", NotFoundException } from '@nestjs/common';";
        }
      );
    }

    // Insert testEmail before the final closing brace
    const method = L([
      "",
      "  // ---------- SMTP test ----------",
      "  async testEmail(userId: string, to: string) {",
      "    const user = await this.getRecipient(userId);",
      "    if (!user) throw new NotFoundException('user_not_found');",
      "",
      "    const cfg = await this.getIntegrationCfg(user.schoolId, 'smtp');",
      "    if (!cfg || !cfg.host) throw new BadRequestException('smtp_not_configured');",
      "",
      "    const subject = 'SMTP test - School MS';",
      "    const body = 'If you received this email, your SMTP configuration is working correctly.';",
      "",
      "    const result = await this.email.send(cfg, { to, subject, body });",
      "",
      "    await this.prisma.notificationLog.create({",
      "      data: {",
      "        userId,",
      "        schoolId: user.schoolId,",
      "        channel: 'EMAIL',",
      "        to,",
      "        subject,",
      "        body,",
      "        status: result.ok ? 'SENT' : 'FAILED',",
      "        providerId: result.providerId ?? null,",
      "        error: result.error ?? null,",
      "      },",
      "    }).catch(() => {});",
      "",
      "    return { ok: result.ok, providerId: result.providerId ?? null, error: result.error ?? null };",
      "  }",
      ""
    ]);

    const idx = s.lastIndexOf('\n}');
    s = s.slice(0, idx) + method + s.slice(idx);
    writeFileSync(p, s, 'utf8');
    console.log('  + notifications.service.ts (testEmail)');
  }
}

// ============================================================
// 2. Add endpoint to NotificationsController
// ============================================================
{
  const p = join(root, 'apps/api/src/notifications/notifications.controller.ts');
  let s = readFileSync(p, 'utf8');

  if (s.includes('test-email')) {
    console.log('  = notifications.controller.ts already has test-email');
  } else {
    const method = L([
      "",
      "  @Post('test-email')",
      "  testEmail(@Req() req: any, @Body() body: { to: string }) {",
      "    return this.svc.testEmail(req.user.sub, body.to);",
      "  }",
      ""
    ]);

    const idx = s.lastIndexOf('\n}');
    s = s.slice(0, idx) + method + s.slice(idx);
    writeFileSync(p, s, 'utf8');
    console.log('  + notifications.controller.ts (test-email route)');
  }
}

// ============================================================
// 3. Rewrite IntegrationsTab with test-email button
// ============================================================
{
  const p = join(root, 'apps/web/app/[locale]/dashboard/settings/page.tsx');
  let s = readFileSync(p, 'utf8');

  const startMarker = 'function IntegrationsTab() {';
  const endMarker = 'function YearsTab() {';

  const startIdx = s.indexOf(startMarker);
  const endIdx = s.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    console.log('  ! cannot locate IntegrationsTab in settings/page.tsx');
  } else {
    const newTab = L([
      "function IntegrationsTab() {",
      "  const t = useTranslations('settings');",
      "  const [data, setData] = useState<any>(null);",
      "  const [err, setErr] = useState<string | null>(null);",
      "  const [ok, setOk] = useState<string | null>(null);",
      "  const [saving, setSaving] = useState(false);",
      "  const [testTo, setTestTo] = useState('');",
      "  const [testResult, setTestResult] = useState<string | null>(null);",
      "  const [testing, setTesting] = useState(false);",
      "",
      "  useEffect(() => {",
      "    apiFetch('/api/v1/settings/integrations')",
      "      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))",
      "      .then(setData)",
      "      .catch((e) => setErr(String(e)));",
      "  }, []);",
      "",
      "  const save = async () => {",
      "    setSaving(true); setErr(null); setOk(null);",
      "    try {",
      "      const r = await apiFetch('/api/v1/settings/integrations', {",
      "        method: 'PUT',",
      "        body: JSON.stringify(data),",
      "      });",
      "      if (!r.ok) throw new Error(await r.text());",
      "      setOk(t('saved'));",
      "    } catch (e: any) { setErr(String(e)); }",
      "    finally { setSaving(false); }",
      "  };",
      "",
      "  const sendTestEmail = async () => {",
      "    if (!testTo) return;",
      "    setTesting(true); setTestResult(null);",
      "    try {",
      "      const r = await apiFetch('/api/v1/notifications/test-email', {",
      "        method: 'POST',",
      "        body: JSON.stringify({ to: testTo }),",
      "      });",
      "      const d = await r.json().catch(() => ({}));",
      "      if (r.ok && d.ok) {",
      "        setTestResult('OK - email envoye a ' + testTo);",
      "      } else if (r.ok) {",
      "        setTestResult('ECHEC: ' + (d.error || 'inconnu'));",
      "      } else {",
      "        const txt = await r.text();",
      "        setTestResult('ERREUR: ' + txt.slice(0, 200));",
      "      }",
      "    } catch (e: any) { setTestResult('ERREUR: ' + String(e)); }",
      "    finally { setTesting(false); }",
      "  };",
      "",
      "  if (!data) return <p className=\"text-gray-500\">{t('loading')}</p>;",
      "",
      "  const setSmtp = (k: string, v: any) => setData({ ...data, smtp: { ...data.smtp, [k]: v } });",
      "  const setSms  = (k: string, v: any) => setData({ ...data, sms:  { ...data.sms,  [k]: v } });",
      "  const setCpt  = (k: string, v: any) => setData({ ...data, cinetpay: { ...data.cinetpay, [k]: v } });",
      "",
      "  return (",
      "    <div className=\"grid gap-6 lg:grid-cols-2\">",
      "      <div className=\"space-y-4 rounded-xl border bg-white p-6\">",
      "        <h2 className=\"text-lg font-semibold\">Email (SMTP)</h2>",
      "        <p className=\"text-xs text-gray-500\">Gmail: activez la validation en 2 etapes, puis creez un mot de passe d application (16 caracteres) sur myaccount.google.com/apppasswords</p>",
      "        <Field label={t('smtpHost')}>",
      "          <input value={data.smtp.host} onChange={(e) => setSmtp('host', e.target.value)} placeholder=\"smtp.gmail.com\" className=\"w-full rounded border px-3 py-2\" />",
      "        </Field>",
      "        <div className=\"grid grid-cols-2 gap-3\">",
      "          <Field label={t('smtpPort')}>",
      "            <input type=\"number\" value={data.smtp.port} onChange={(e) => setSmtp('port', Number(e.target.value))} className=\"w-full rounded border px-3 py-2\" />",
      "          </Field>",
      "          <Field label={t('smtpUser')}>",
      "            <input value={data.smtp.user} onChange={(e) => setSmtp('user', e.target.value)} placeholder=\"you@gmail.com\" className=\"w-full rounded border px-3 py-2\" />",
      "          </Field>",
      "        </div>",
      "        <Field label={t('smtpPass')}>",
      "          <input type=\"password\" value={data.smtp.pass} onChange={(e) => setSmtp('pass', e.target.value)} placeholder=\"xxxx xxxx xxxx xxxx\" className=\"w-full rounded border px-3 py-2\" />",
      "        </Field>",
      "        <Field label={t('smtpFrom')}>",
      "          <input value={data.smtp.from} onChange={(e) => setSmtp('from', e.target.value)} placeholder=\"Ecole &lt;no-reply@school.cm&gt;\" className=\"w-full rounded border px-3 py-2\" />",
      "        </Field>",
      "",
      "        <div className=\"rounded-lg border border-gray-200 bg-gray-50 p-3\">",
      "          <div className=\"text-xs font-medium uppercase text-gray-600\">Tester l envoi</div>",
      "          <div className=\"mt-2 flex gap-2\">",
      "            <input type=\"email\" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder=\"votre-email@example.com\" className=\"flex-1 rounded border px-3 py-2 text-sm\" />",
      "            <button type=\"button\" onClick={sendTestEmail} disabled={testing || !testTo} className=\"rounded bg-teal-600 px-3 py-2 text-sm text-white hover:bg-teal-700 disabled:opacity-50\">",
      "              {testing ? '...' : 'Tester'}",
      "            </button>",
      "          </div>",
      "          <p className=\"mt-2 text-[10px] text-gray-500\">Enregistrez d abord vos parametres SMTP, puis testez.</p>",
      "          {testResult && (",
      "            <p className={'mt-2 text-xs ' + (testResult.startsWith('OK') ? 'text-green-700' : 'text-red-600')}>{testResult}</p>",
      "          )}",
      "        </div>",
      "      </div>",
      "",
      "      <div className=\"space-y-4 rounded-xl border bg-white p-6\">",
      "        <h2 className=\"text-lg font-semibold\">SMS</h2>",
      "        <Field label={t('smsProvider')}>",
      "          <select value={data.sms.provider} onChange={(e) => setSms('provider', e.target.value)} className=\"w-full rounded border px-3 py-2\">",
      "            <option value=\"africastalking\">Africa's Talking</option>",
      "            <option value=\"twilio\">Twilio</option>",
      "            <option value=\"orange\">Orange SMS</option>",
      "            <option value=\"mtn\">MTN SMS</option>",
      "          </select>",
      "        </Field>",
      "        <Field label={t('smsUsername')}>",
      "          <input value={data.sms.username} onChange={(e) => setSms('username', e.target.value)} className=\"w-full rounded border px-3 py-2\" />",
      "        </Field>",
      "        <Field label={t('smsApiKey')}>",
      "          <input type=\"password\" value={data.sms.apiKey} onChange={(e) => setSms('apiKey', e.target.value)} className=\"w-full rounded border px-3 py-2\" />",
      "        </Field>",
      "        <Field label={t('smsSender')}>",
      "          <input value={data.sms.sender} onChange={(e) => setSms('sender', e.target.value)} placeholder=\"SCHOOL\" className=\"w-full rounded border px-3 py-2\" />",
      "        </Field>",
      "      </div>",
      "",
      "      <div className=\"space-y-4 rounded-xl border bg-white p-6 lg:col-span-2\">",
      "        <h2 className=\"text-lg font-semibold\">CinetPay (Mobile Money)</h2>",
      "        <div className=\"grid grid-cols-2 gap-3\">",
      "          <Field label={t('cinetpayApiKey')}>",
      "            <input type=\"password\" value={data.cinetpay.apiKey} onChange={(e) => setCpt('apiKey', e.target.value)} placeholder=\"sk_test_... or sk_live_...\" className=\"w-full rounded border px-3 py-2\" />",
      "          </Field>",
      "          <Field label={t('cinetpaySiteId')}>",
      "            <input value={data.cinetpay.siteId} onChange={(e) => setCpt('siteId', e.target.value)} className=\"w-full rounded border px-3 py-2\" />",
      "          </Field>",
      "        </div>",
      "        <p className=\"text-xs text-gray-500\">{t('cinetpayHint')}</p>",
      "      </div>",
      "",
      "      <div className=\"lg:col-span-2 space-y-2\">",
      "        {err && <p className=\"rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800\">{err}</p>}",
      "        {ok && <p className=\"rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800\">{ok}</p>}",
      "      </div>",
      "",
      "      <div className=\"lg:col-span-2 flex justify-end\">",
      "        <button onClick={save} disabled={saving} className=\"rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50\">",
      "          {saving ? '...' : t('save')}",
      "        </button>",
      "      </div>",
      "    </div>",
      "  );",
      "}",
      "",
      ""
    ]);

    s = s.slice(0, startIdx) + newTab + s.slice(endIdx);
    writeFileSync(p, s, 'utf8');
    console.log('  + settings/page.tsx (IntegrationsTab with test button)');
  }
}

console.log('\nOK smtp-test.mjs done');
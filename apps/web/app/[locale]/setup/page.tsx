'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Lang = 'en' | 'fr' | 'ar';

const T: Record<string, Record<Lang, string>> = {
  title:        { en: 'Welcome to School MS', fr: 'Bienvenue dans School MS', ar: 'مرحباً بك في School MS' },
  subtitle:     { en: 'Set up your school in 3 quick steps.', fr: 'Configurez votre ecole en 3 etapes.', ar: 'قم بإعداد مدرستك في 3 خطوات.' },
  stepSchool:   { en: 'School info', fr: 'Infos ecole', ar: 'بيانات المدرسة' },
  stepAdmin:    { en: 'Admin account', fr: 'Compte admin', ar: 'حساب المدير' },
  stepConfirm:  { en: 'Confirm', fr: 'Confirmation', ar: 'تأكيد' },
  schoolName:   { en: 'School name', fr: "Nom de l'ecole", ar: 'اسم المدرسة' },
  schoolNamePh: { en: 'e.g. Lycee Bilingue de Yaounde', fr: 'ex. Lycee Bilingue de Yaounde', ar: 'مثال: ثانوية ياوندي' },
  country:      { en: 'Country', fr: 'Pays', ar: 'البلد' },
  currency:     { en: 'Currency', fr: 'Devise', ar: 'العملة' },
  language:     { en: 'Default language', fr: 'Langue par defaut', ar: 'اللغة الافتراضية' },
  firstName:    { en: 'Your first name', fr: 'Votre prenom', ar: 'اسمك الأول' },
  lastName:     { en: 'Your last name', fr: 'Votre nom', ar: 'اسم العائلة' },
  email:        { en: 'Admin email', fr: 'Email administrateur', ar: 'بريد المدير' },
  emailHint:    { en: 'This will be your login.', fr: 'Ce sera votre identifiant.', ar: 'سيكون هذا معرّف الدخول.' },
  password:     { en: 'Password', fr: 'Mot de passe', ar: 'كلمة المرور' },
  passwordHint: { en: 'Minimum 8 characters.', fr: 'Minimum 8 caracteres.', ar: '8 أحرف على الأقل.' },
  password2:    { en: 'Confirm password', fr: 'Confirmer le mot de passe', ar: 'تأكيد كلمة المرور' },
  mismatch:     { en: 'Passwords do not match.', fr: 'Les mots de passe ne correspondent pas.', ar: 'كلمتا المرور غير متطابقتين.' },
  tooShort:     { en: 'Password must be at least 8 characters.', fr: 'Minimum 8 caracteres.', ar: '8 أحرف على الأقل.' },
  reviewHint:   { en: 'Review and confirm.', fr: 'Verifiez et confirmez.', ar: 'راجع وأكّد.' },
  back:         { en: 'Back', fr: 'Retour', ar: 'رجوع' },
  next:         { en: 'Next', fr: 'Suivant', ar: 'التالي' },
  finish:       { en: 'Create school', fr: "Creer l'ecole", ar: 'إنشاء المدرسة' },
  creating:     { en: 'Creating...', fr: 'Creation...', ar: 'جار الإنشاء...' },
  successTitle: { en: 'All set!', fr: 'Pret !', ar: 'اكتمل الإعداد!' },
  successBody:  { en: 'Your school is ready. Log in with the credentials below.', fr: 'Votre ecole est prete. Connectez-vous avec les identifiants ci-dessous.', ar: 'مدرستك جاهزة. سجّل الدخول بالبيانات أدناه.' },
  goLogin:      { en: 'Go to login', fr: 'Aller a la connexion', ar: 'الذهاب لتسجيل الدخول' },
  errorGeneric: { en: 'Setup failed. Please try again.', fr: 'Echec de la configuration.', ar: 'فشل الإعداد.' },
  emailTaken:   { en: 'This email is already registered.', fr: 'Cet email est deja utilise.', ar: 'البريد مستخدم.' },
};

export default function SetupWizard() {
  const params = useParams() as { locale?: string };
  const router = useRouter();
  const locale = params?.locale || 'fr';
  const l: Lang = locale === 'en' || locale === 'ar' ? locale : 'fr';

  const [step, setStep] = useState(0);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<any>(null);

  const [form, setForm] = useState({
    schoolName: '',
    country: 'CM',
    currency: 'XAF',
    defaultLocale: 'fr',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPassword: '',
    adminPassword2: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    fetch(API_URL + '/api/v1/system/setup-status')
      .then((r) => r.ok ? r.json() : { needsSetup: true })
      .then((d) => {
        if (!d.needsSetup) {
          router.replace('/' + locale + '/login');
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [locale, router]);

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    try {
      const r = await fetch(API_URL + '/api/v1/system/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: form.schoolName,
          country: form.country,
          currency: form.currency,
          defaultLocale: form.defaultLocale,
          adminFirstName: form.adminFirstName,
          adminLastName: form.adminLastName,
          adminEmail: form.adminEmail,
          adminPassword: form.adminPassword,
        }),
      });
      const raw = await r.text();
      let d: any = {};
      try { d = JSON.parse(raw); } catch { d = { raw }; }
      if (!r.ok) {
        if (raw.includes('email_already_registered')) setErr(T.emailTaken[l]);
        else if (raw.includes('password_too_short')) setErr(T.tooShort[l]);
        else setErr(d.message || T.errorGeneric[l]);
        setSubmitting(false);
        return;
      }
      setDone(d);
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-lg">
          <div className="text-4xl">OK</div>
          <h1 className="mt-3 text-2xl font-bold">{T.successTitle[l]}</h1>
          <p className="mt-2 text-sm text-gray-600">{T.successBody[l]}</p>
          <dl className="mt-6 space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">{T.schoolName[l]}</dt>
              <dd className="font-medium">{done.schoolName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">{T.email[l]}</dt>
              <dd className="font-mono">{done.adminEmail}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">{T.password[l]}</dt>
              <dd className="font-mono">{form.adminPassword}</dd>
            </div>
          </dl>
          <button
            onClick={() => router.push('/' + locale + '/login')}
            className="mt-6 w-full rounded bg-brand-600 py-2 text-white hover:bg-brand-700"
          >
            {T.goLogin[l]}
          </button>
        </div>
      </div>
    );
  }

  const canNext = () => {
    if (step === 0) return form.schoolName.trim().length > 0;
    if (step === 1) {
      return form.adminEmail.includes('@') &&
        form.adminFirstName.trim().length > 0 &&
        form.adminLastName.trim().length > 0 &&
        form.adminPassword.length >= 8 &&
        form.adminPassword === form.adminPassword2;
    }
    return true;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-2xl rounded-xl border bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-brand-600">{T.title[l]}</h1>
        <p className="mt-1 text-sm text-gray-500">{T.subtitle[l]}</p>

        <div className="mt-6 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 items-center gap-2">
              <div className={'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ' + (step >= i ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500')}>
                {i + 1}
              </div>
              <span className={'text-xs ' + (step >= i ? 'text-brand-700 font-medium' : 'text-gray-400')}>
                {i === 0 ? T.stepSchool[l] : i === 1 ? T.stepAdmin[l] : T.stepConfirm[l]}
              </span>
              {i < 2 && <div className={'h-1 flex-1 rounded ' + (step > i ? 'bg-brand-600' : 'bg-gray-200')} />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="mt-8 space-y-4">
            <Field label={T.schoolName[l]}>
              <input value={form.schoolName} onChange={set('schoolName')} placeholder={T.schoolNamePh[l]} autoFocus className="w-full rounded border px-3 py-2" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={T.country[l]}>
                <select value={form.country} onChange={set('country')} className="w-full rounded border px-3 py-2">
                  <option value="CM">Cameroun</option>
                  <option value="CF">Republique Centrafricaine</option>
                  <option value="TD">Tchad</option>
                  <option value="CG">Congo</option>
                  <option value="GA">Gabon</option>
                  <option value="GQ">Guinee Equatoriale</option>
                  <option value="OTHER">Autre / Other</option>
                </select>
              </Field>
              <Field label={T.currency[l]}>
                <select value={form.currency} onChange={set('currency')} className="w-full rounded border px-3 py-2">
                  <option value="XAF">XAF — Franc CFA</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="USD">USD — Dollar</option>
                </select>
              </Field>
            </div>
            <Field label={T.language[l]}>
              <select value={form.defaultLocale} onChange={set('defaultLocale')} className="w-full rounded border px-3 py-2">
                <option value="fr">Francais</option>
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="mt-8 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label={T.firstName[l]}>
                <input value={form.adminFirstName} onChange={set('adminFirstName')} className="w-full rounded border px-3 py-2" />
              </Field>
              <Field label={T.lastName[l]}>
                <input value={form.adminLastName} onChange={set('adminLastName')} className="w-full rounded border px-3 py-2" />
              </Field>
            </div>
            <Field label={T.email[l]} hint={T.emailHint[l]}>
              <input type="email" value={form.adminEmail} onChange={set('adminEmail')} placeholder="admin@your-school.cm" className="w-full rounded border px-3 py-2" />
            </Field>
            <Field label={T.password[l]} hint={T.passwordHint[l]}>
              <input type="password" value={form.adminPassword} onChange={set('adminPassword')} className="w-full rounded border px-3 py-2" />
            </Field>
            <Field label={T.password2[l]}>
              <input type="password" value={form.adminPassword2} onChange={set('adminPassword2')} className="w-full rounded border px-3 py-2" />
            </Field>
            {form.adminPassword.length > 0 && form.adminPassword.length < 8 && (
              <p className="text-xs text-red-600">{T.tooShort[l]}</p>
            )}
            {form.adminPassword2.length > 0 && form.adminPassword !== form.adminPassword2 && (
              <p className="text-xs text-red-600">{T.mismatch[l]}</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-gray-600">{T.reviewHint[l]}</p>
            <dl className="space-y-3 rounded-lg bg-gray-50 p-5 text-sm">
              <Row label={T.schoolName[l]} value={form.schoolName} />
              <Row label={T.country[l]} value={form.country} />
              <Row label={T.currency[l]} value={form.currency} />
              <Row label={T.language[l]} value={form.defaultLocale} />
              <div className="border-t pt-3" />
              <Row label={T.firstName[l]} value={form.adminFirstName + ' ' + form.adminLastName} />
              <Row label={T.email[l]} value={form.adminEmail} mono />
              <Row label={T.password[l]} value={'*'.repeat(form.adminPassword.length)} />
            </dl>
          </div>
        )}

        {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

        <div className="mt-8 flex justify-between">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || submitting} className="rounded border px-4 py-2 text-sm disabled:opacity-30">
            {T.back[l]}
          </button>
          {step < 2 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canNext()} className="rounded bg-brand-600 px-6 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
              {T.next[l]}
            </button>
          ) : (
            <button onClick={submit} disabled={submitting} className="rounded bg-brand-600 px-6 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
              {submitting ? T.creating[l] : T.finish[l]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-gray-500">{hint}</span>}
    </label>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className={mono ? 'font-mono text-right' : 'text-right font-medium'}>{value}</dd>
    </div>
  );
}
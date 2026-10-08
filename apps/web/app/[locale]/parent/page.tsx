'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Child = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  className: string | null;
  classId: string | null;
};
type Me = {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  phone: string;
  email: string | null;
  children: Child[];
};

const T = {
  welcome:    { en: 'Welcome',    fr: 'Bienvenue',     ar: 'مرحبا' },
  loading:    { en: 'Loading...', fr: 'Chargement...', ar: 'جار التحميل...' },
  myChildren: { en: 'My children', fr: 'Mes enfants',  ar: 'أطفالي' },
  class:      { en: 'Class',      fr: 'Classe',        ar: 'الفصل' },
  born:       { en: 'Born',       fr: 'Ne le',         ar: 'مواليد' },
  grades:     { en: 'Grades',     fr: 'Notes',         ar: 'العلامات' },
  invoices:   { en: 'Invoices',   fr: 'Factures',      ar: 'الفواتير' },
  attendance: { en: 'Attendance', fr: 'Presence',      ar: 'الحضور' },
  noChildren: { en: 'No children linked to your account.', fr: 'Aucun enfant lie a votre compte.', ar: 'لا يوجد أطفال.' },
} as const;

export default function ParentHome() {
  const { locale } = useParams() as { locale: string };
  const l: 'en' | 'fr' | 'ar' =
    locale === 'en' || locale === 'ar' ? locale : 'fr';
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/v1/parent/me')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setMe)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {me ? T.welcome[l] + ', ' + me.firstName + ' ' + me.lastName : T.loading[l]}
      </h1>
      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      {me && (
        <>
          <h2 className="mt-8 text-lg font-semibold">{T.myChildren[l]}</h2>
          {me.children.length === 0 && (
            <p className="mt-4 text-gray-500">{T.noChildren[l]}</p>
          )}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {me.children.map((c) => (
              <div key={c.id} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-lg font-bold text-teal-800">
                    {c.firstName[0]}{c.lastName[0]}
                  </div>
                  <div>
                    <div className="font-bold">{c.firstName} {c.lastName}</div>
                    <div className="font-mono text-xs text-gray-500">{c.admissionNo}</div>
                  </div>
                </div>
                <div className="mt-4 space-y-1 text-sm">
                  <div><span className="text-gray-500">{T.class[l]}: </span>{c.className || '—'}</div>
                  <div className="text-xs text-gray-500">{T.born[l]}: {new Date(c.dateOfBirth).toLocaleDateString()}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Link href={'/' + locale + '/parent/children/' + c.id + '?tab=grades'}
                        className="rounded bg-brand-600 px-3 py-1 text-white hover:bg-brand-700">
                    {T.grades[l]}
                  </Link>
                  <Link href={'/' + locale + '/parent/children/' + c.id + '?tab=invoices'}
                        className="rounded border border-brand-600 px-3 py-1 text-brand-700 hover:bg-teal-50">
                    {T.invoices[l]}
                  </Link>
                  <Link href={'/' + locale + '/parent/children/' + c.id + '?tab=attendance'}
                        className="rounded border border-brand-600 px-3 py-1 text-brand-700 hover:bg-teal-50">
                    {T.attendance[l]}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function SchoolLogo() {
  const [school, setSchool] = useState<any>(null);

  useEffect(() => {
    apiFetch('/api/v1/settings/school')
      .then((r) => (r.ok ? r.json() : null))
      .then(setSchool)
      .catch(() => {});
  }, []);

  const url = school?.logoUrl
    ? (school.logoUrl.startsWith('http') ? school.logoUrl : API_URL + school.logoUrl)
    : null;

  return (
    <div className="flex items-center gap-2 overflow-hidden">
      {url ? (
        <img src={url} alt="logo" className="h-8 w-8 flex-shrink-0 rounded object-contain" />
      ) : (
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-brand-600 text-xs font-bold text-white">
          {(school?.name || 'S')[0]}
        </span>
      )}
      <span className="truncate text-sm font-bold text-brand-600">
        {school?.name ? school.name.slice(0, 24) : 'SMS'}
      </span>
    </div>
  );
}

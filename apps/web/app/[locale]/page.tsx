'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

export default function Home() {
  const { locale } = useParams() as { locale: string };
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    router.replace('/' + locale + (token ? '/dashboard' : '/login'));
  }, [locale, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Redirecting…</p>
    </main>
  );
}

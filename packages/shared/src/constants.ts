export const SUPPORTED_LOCALES = ['en', 'fr', 'ar'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';
export const CURRENCY = 'XAF';
export const RTL_LOCALES: Locale[] = ['ar'];

export const APP_NAME = 'School MS';
export const APP_VERSION = '1.1.0';
export const APP_BUILD_DATE = '2026-10-13';
export const APP_LICENSE = 'Proprietary';
export const APP_GITHUB = 'https://github.com/Rabiou75/school-ms';
export const APP_SUPPORT_EMAIL = 'support@school-ms.local';

export const formatXAF = (amount: number, locale: Locale = 'fr'): string =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-CM' : `${locale}-CM`, {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(amount);

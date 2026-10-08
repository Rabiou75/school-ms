export const SUPPORTED_LOCALES = ['en', 'fr', 'ar'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';
export const CURRENCY = 'XAF';
export const RTL_LOCALES: Locale[] = ['ar'];

export const formatXAF = (amount: number, locale: Locale = 'fr'): string =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-CM' : `${locale}-CM`, {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(amount);

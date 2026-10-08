export const formatXAF = (n: number, locale = 'fr'): string =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-CM' : locale + '-CM', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(n);
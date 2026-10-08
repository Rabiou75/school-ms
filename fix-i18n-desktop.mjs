import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'apps/web/i18n.ts');
const L = (a) => a.join('\n');

const content = L([
  "import { getRequestConfig } from 'next-intl/server';",
  "import { notFound } from 'next/navigation';",
  "",
  "const locales = ['en', 'fr', 'ar'];",
  "",
  "export default getRequestConfig(async ({ requestLocale }) => {",
  "  const locale = await requestLocale;",
  "  if (!locale || !locales.includes(locale)) notFound();",
  "  return {",
  "    locale,",
  "    messages: (await import(`./messages/${locale}.json`)).default,",
  "  };",
  "});",
  ""
]);

writeFileSync(path, content, 'utf8');
console.log('OK apps/web/i18n.ts rewritten for next-intl 3.22+');
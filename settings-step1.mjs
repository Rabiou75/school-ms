import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

// ============================================================
// 1. Add SchoolSetting model to schema if missing
// ============================================================
const schemaPath = join(root, 'packages/database/prisma/schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

if (!schema.includes('model SchoolSetting')) {
  schema += `

model SchoolSetting {
  id        String   @id @default(cuid())
  schoolId  String
  key       String
  value     String
  updatedAt DateTime @updatedAt

  school School @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@unique([schoolId, key])
}
`;
  const sm = schema.match(/model School \{[\s\S]*?\n\}/m);
  if (sm && !sm[0].includes('settings SchoolSetting[]')) {
    const idx = sm[0].lastIndexOf('\n}');
    schema = schema.replace(sm[0], sm[0].slice(0, idx) + '\n  settings SchoolSetting[]' + sm[0].slice(idx));
  }
  writeFileSync(schemaPath, schema, 'utf8');
  console.log('  + SchoolSetting model + School.settings relation');
} else {
  console.log('  = SchoolSetting already present');
}

// ============================================================
// 2. Fix the two TypeScript errors in settings.service.ts
// ============================================================
const svcPath = join(root, 'apps/api/src/settings/settings.service.ts');
let svc = readFileSync(svcPath, 'utf8');

svc = svc.replace(
  'const map: Record<string, string> = Object.fromEntries(rows.map((r) => [r.key, r.value]));',
  'const map: Record<string, string> = Object.fromEntries(\n      rows.map((r: { key: string; value: string }) => [r.key, r.value]),\n    );'
);

svc = svc.replace(
  "const data: any = {};\n    for (const k of ['firstName', 'lastName', 'phone', 'locale']) {\n      if (dto[k] !== undefined) data[k] = dto[k] || null;\n    }",
  "const data: Record<string, any> = {};\n    const allowed = ['firstName', 'lastName', 'phone', 'locale'] as const;\n    for (const k of allowed) {\n      if ((dto as any)[k] !== undefined) data[k] = (dto as any)[k] || null;\n    }"
);

writeFileSync(svcPath, svc, 'utf8');
console.log('  + settings.service.ts TypeScript fixes');

// ============================================================
// 3. Update sidebar layout.tsx to include Settings
// ============================================================
const layoutPath = join(root, 'apps/web/app/[locale]/dashboard/layout.tsx');
let layout = readFileSync(layoutPath, 'utf8');

if (!layout.includes("'settings'")) {
  layout = layout.replace(
    "type NavKey = 'dashboard' | 'students' | 'parents' | 'staff' | 'classes' | 'subjects' | 'attendance' | 'exams' | 'finance';",
    "type NavKey = 'dashboard' | 'students' | 'parents' | 'staff' | 'classes' | 'subjects' | 'attendance' | 'exams' | 'finance' | 'settings';"
  );
  layout = layout.replace(
    "const NAV: NavKey[] = ['dashboard', 'students', 'parents', 'staff', 'classes', 'subjects', 'attendance', 'exams', 'finance'];",
    "const NAV: NavKey[] = ['dashboard', 'students', 'parents', 'staff', 'classes', 'subjects', 'attendance', 'exams', 'finance', 'settings'];"
  );
  layout = layout.replace(
    "  finance:    { en: 'Finance',    fr: 'Finances',        ar: 'المالية' },",
    "  finance:    { en: 'Finance',    fr: 'Finances',        ar: 'المالية' },\n  settings:   { en: 'Settings',   fr: 'Parametres',      ar: 'الإعدادات' },"
  );
  layout = layout.replace(
    "  finance: '💰',",
    "  finance: '💰', settings: '⚙️',"
  );
  writeFileSync(layoutPath, layout, 'utf8');
  console.log('  + sidebar Settings link');
} else {
  console.log('  = sidebar already has Settings');
}

// ============================================================
// 4. Merge settings i18n keys
// ============================================================
const dict = {
  en: {
    title: 'Settings', subtitle: 'Administration & configuration',
    tabSchool: 'School', tabAccount: 'My Account', tabUsers: 'Users', tabIntegrations: 'Integrations', tabYears: 'Academic Years',
    loading: 'Loading…', save: 'Save', saved: 'Saved.', cancel: 'Cancel',
    schoolName: 'School name', email: 'Email', phone: 'Phone', city: 'City', country: 'Country',
    currency: 'Currency', defaultLocale: 'Default language', address: 'Address', logoUrl: 'Logo URL',
    myProfile: 'My profile', firstName: 'First name', lastName: 'Last name', locale: 'Language',
    saveProfile: 'Save profile', profileSaved: 'Profile updated.',
    changePassword: 'Change password', currentPassword: 'Current password', newPassword: 'New password',
    confirmPassword: 'Confirm new password', passwordHint: 'Minimum 8 characters.',
    changePasswordButton: 'Change password', passwordChanged: 'Password changed.',
    passwordMismatch: 'Passwords do not match.', currentPasswordWrong: 'Current password is incorrect.',
    passwordTooShort: 'Password must be at least 8 characters.', minChars: 'Min 8 characters',
    usersTitle: 'Users & access', usersHint: 'Change roles and enable/disable accounts.',
    userName: 'Name', userRole: 'Role', userStatus: 'Status', userLastLogin: 'Last login',
    active: 'Active', inactive: 'Inactive', noUsers: 'No users yet.',
    resetPassword: 'Reset password',
    smtpTitle: 'Email (SMTP)', smtpHost: 'Host', smtpPort: 'Port', smtpUser: 'Username',
    smtpPass: 'Password', smtpFrom: 'From address',
    smsTitle: 'SMS', smsProvider: 'Provider', smsUsername: 'Username', smsApiKey: 'API key', smsSender: 'Sender name',
    cinetpayTitle: 'CinetPay (Mobile Money)',
    cinetpayApiKey: 'API key', cinetpaySiteId: 'Site ID',
    cinetpayHint: 'Use sandbox keys (sk_test_…) for testing, production keys (sk_live_…) for real payments.',
    yearsTitle: 'Academic years', newYear: 'New year',
    yearName: 'Name', yearStart: 'Start date', yearEnd: 'End date', yearStatus: 'Status',
    current: 'Current', archived: 'Archived', setCurrent: 'Set current', noYears: 'No academic years.',
  },
  fr: {
    title: 'Parametres', subtitle: 'Administration & configuration',
    tabSchool: 'Ecole', tabAccount: 'Mon compte', tabUsers: 'Utilisateurs', tabIntegrations: 'Integrations', tabYears: 'Annees scolaires',
    loading: 'Chargement…', save: 'Enregistrer', saved: 'Enregistre.', cancel: 'Annuler',
    schoolName: "Nom de l'ecole", email: 'Email', phone: 'Telephone', city: 'Ville', country: 'Pays',
    currency: 'Devise', defaultLocale: 'Langue par defaut', address: 'Adresse', logoUrl: 'URL du logo',
    myProfile: 'Mon profil', firstName: 'Prenom', lastName: 'Nom', locale: 'Langue',
    saveProfile: 'Enregistrer le profil', profileSaved: 'Profil mis a jour.',
    changePassword: 'Changer le mot de passe', currentPassword: 'Mot de passe actuel', newPassword: 'Nouveau mot de passe',
    confirmPassword: 'Confirmer', passwordHint: 'Minimum 8 caracteres.',
    changePasswordButton: 'Changer', passwordChanged: 'Mot de passe change.',
    passwordMismatch: 'Les mots de passe ne correspondent pas.', currentPasswordWrong: 'Mot de passe actuel incorrect.',
    passwordTooShort: 'Minimum 8 caracteres.', minChars: 'Min 8 caracteres',
    usersTitle: 'Utilisateurs & acces', usersHint: 'Changez les roles et activez/desactivez les comptes.',
    userName: 'Nom', userRole: 'Role', userStatus: 'Statut', userLastLogin: 'Derniere connexion',
    active: 'Actif', inactive: 'Inactif', noUsers: 'Aucun utilisateur.',
    resetPassword: 'Reinitialiser le mot de passe',
    smtpTitle: 'Email (SMTP)', smtpHost: 'Hote', smtpPort: 'Port', smtpUser: 'Utilisateur',
    smtpPass: 'Mot de passe', smtpFrom: 'Adresse expediteur',
    smsTitle: 'SMS', smsProvider: 'Fournisseur', smsUsername: 'Utilisateur', smsApiKey: 'Cle API', smsSender: 'Nom expediteur',
    cinetpayTitle: 'CinetPay (Mobile Money)',
    cinetpayApiKey: 'Cle API', cinetpaySiteId: 'Site ID',
    cinetpayHint: 'Utilisez les cles sandbox (sk_test_…) pour tester, production (sk_live_…) pour les paiements reels.',
    yearsTitle: 'Annees scolaires', newYear: 'Nouvelle annee',
    yearName: 'Nom', yearStart: 'Date debut', yearEnd: 'Date fin', yearStatus: 'Statut',
    current: 'En cours', archived: 'Archive', setCurrent: 'Definir en cours', noYears: 'Aucune annee scolaire.',
  },
  ar: {
    title: 'الإعدادات', subtitle: 'الإدارة والتكوين',
    tabSchool: 'المدرسة', tabAccount: 'حسابي', tabUsers: 'المستخدمون', tabIntegrations: 'التكاملات', tabYears: 'السنوات الدراسية',
    loading: 'جار التحميل…', save: 'حفظ', saved: 'تم الحفظ.', cancel: 'إلغاء',
    schoolName: 'اسم المدرسة', email: 'البريد', phone: 'الهاتف', city: 'المدينة', country: 'البلد',
    currency: 'العملة', defaultLocale: 'اللغة الافتراضية', address: 'العنوان', logoUrl: 'رابط الشعار',
    myProfile: 'ملفي', firstName: 'الاسم الأول', lastName: 'اسم العائلة', locale: 'اللغة',
    saveProfile: 'حفظ الملف', profileSaved: 'تم تحديث الملف.',
    changePassword: 'تغيير كلمة المرور', currentPassword: 'كلمة المرور الحالية', newPassword: 'كلمة جديدة',
    confirmPassword: 'تأكيد', passwordHint: '8 أحرف على الأقل.',
    changePasswordButton: 'تغيير', passwordChanged: 'تم التغيير.',
    passwordMismatch: 'كلمتا المرور غير متطابقتين.', currentPasswordWrong: 'كلمة المرور الحالية خاطئة.',
    passwordTooShort: '8 أحرف على الأقل.', minChars: '8 أحرف على الأقل',
    usersTitle: 'المستخدمون والصلاحيات', usersHint: 'غيّر الأدوار وفعّل/عطّل الحسابات.',
    userName: 'الاسم', userRole: 'الدور', userStatus: 'الحالة', userLastLogin: 'آخر دخول',
    active: 'نشط', inactive: 'غير نشط', noUsers: 'لا مستخدمين.',
    resetPassword: 'إعادة تعيين كلمة المرور',
    smtpTitle: 'البريد (SMTP)', smtpHost: 'المضيف', smtpPort: 'المنفذ', smtpUser: 'المستخدم',
    smtpPass: 'كلمة المرور', smtpFrom: 'المرسل',
    smsTitle: 'الرسائل النصية', smsProvider: 'المزود', smsUsername: 'المستخدم', smsApiKey: 'مفتاح API', smsSender: 'اسم المرسل',
    cinetpayTitle: 'سينيت باي (Mobile Money)',
    cinetpayApiKey: 'مفتاح API', cinetpaySiteId: 'معرف الموقع',
    cinetpayHint: 'استخدم مفاتيح الاختبار (sk_test_…) للاختبار، ومفاتيح الإنتاج (sk_live_…) للدفع الحقيقي.',
    yearsTitle: 'السنوات الدراسية', newYear: 'سنة جديدة',
    yearName: 'الاسم', yearStart: 'تاريخ البداية', yearEnd: 'تاريخ النهاية', yearStatus: 'الحالة',
    current: 'الحالية', archived: 'مؤرشفة', setCurrent: 'تعيين كحالية', noYears: 'لا توجد سنوات دراسية.',
  },
};

for (const locale of ['en', 'fr', 'ar']) {
  const f = join(root, 'apps/web/messages/' + locale + '.json');
  let raw = readFileSync(f, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const data = JSON.parse(raw);
  data.settings = { ...(data.settings || {}), ...dict[locale] };
  writeFileSync(f, JSON.stringify(data, null, 2), 'utf8');
  console.log('  ~ messages/' + locale + '.json');
}

console.log('\n✅ Step 1 done');
console.log('\nNext:');
console.log('  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force');
console.log('  pnpm db:generate');
console.log('  pnpm db:migrate    (name: school_setting_model)');
console.log('  cd apps\\api ; npx nest build ; cd ..\\..');
console.log('  pnpm dev');
console.log('\nThen run Script B (settings page) which I will send next.');
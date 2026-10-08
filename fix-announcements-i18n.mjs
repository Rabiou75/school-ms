import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const dict = {
  en: {
    title: 'Announcements', newAnnouncement: 'New announcement',
    newTitle: 'New announcement', editTitle: 'Edit announcement',
    announcementTitle: 'Title', titlePlaceholder: 'e.g. Parent-teacher meeting',
    message: 'Message', bodyPlaceholder: 'Write your announcement…',
    audience: 'Audience',
    audAll: 'All users', audParents: 'Parents', audStaff: 'Staff',
    audStudents: 'Students', audClass: 'A specific class',
    selectClass: 'Class',
    channels: 'Delivery channels',
    chInApp: 'In-app', chEmail: 'Email', chSms: 'SMS',
    channelsHint: 'In-app always works. Email and SMS require configuration in Settings → Integrations.',
    publishNow: 'Publish now (delivers to the audience)',
    save: 'Save', cancel: 'Cancel',
    edit: 'Edit', delete: 'Delete', rebroadcast: 'Re-send',
    published: 'Published', draft: 'Draft',
    loading: 'Loading…', noAnnouncements: 'No announcements yet.',
    confirmDelete: 'Delete "{title}"? This cannot be undone.',
    confirmRebroadcast: 'Re-send this announcement to the audience?',
    broadcastSent: 'Sent to {n} of {total} users.',
    savedAsDraft: 'Saved as draft.',
    updated: 'Updated.',
    createdAndPublished: 'Published and sent to the audience.',
    updatedAndPublished: 'Updated and published.',
  },
  fr: {
    title: 'Annonces', newAnnouncement: 'Nouvelle annonce',
    newTitle: 'Nouvelle annonce', editTitle: "Modifier l'annonce",
    announcementTitle: 'Titre', titlePlaceholder: 'ex. Reunion parents-professeurs',
    message: 'Message', bodyPlaceholder: 'Ecrivez votre annonce…',
    audience: 'Destinataires',
    audAll: 'Tous les utilisateurs', audParents: 'Parents', audStaff: 'Personnel',
    audStudents: 'Eleves', audClass: 'Une classe specifique',
    selectClass: 'Classe',
    channels: 'Canaux de diffusion',
    chInApp: 'In-app', chEmail: 'Email', chSms: 'SMS',
    channelsHint: 'In-app fonctionne toujours. Email et SMS necessitent une configuration dans Parametres → Integrations.',
    publishNow: 'Publier maintenant (diffuse aux destinataires)',
    save: 'Enregistrer', cancel: 'Annuler',
    edit: 'Modifier', delete: 'Supprimer', rebroadcast: 'Renvoyer',
    published: 'Publiee', draft: 'Brouillon',
    loading: 'Chargement…', noAnnouncements: 'Aucune annonce.',
    confirmDelete: 'Supprimer « {title} » ? Irreversible.',
    confirmRebroadcast: 'Renvoyer cette annonce aux destinataires ?',
    broadcastSent: 'Envoye a {n} sur {total} utilisateurs.',
    savedAsDraft: 'Enregistre comme brouillon.',
    updated: 'Mis a jour.',
    createdAndPublished: 'Publiee et diffusee.',
    updatedAndPublished: 'Mise a jour et publiee.',
  },
  ar: {
    title: 'الإعلانات', newAnnouncement: 'إعلان جديد',
    newTitle: 'إعلان جديد', editTitle: 'تعديل الإعلان',
    announcementTitle: 'العنوان', titlePlaceholder: 'مثال: اجتماع أولياء الأمور',
    message: 'الرسالة', bodyPlaceholder: 'اكتب إعلانك…',
    audience: 'الجمهور',
    audAll: 'جميع المستخدمين', audParents: 'أولياء الأمور', audStaff: 'الموظفون',
    audStudents: 'الطلاب', audClass: 'فصل محدد',
    selectClass: 'الفصل',
    channels: 'قنوات الإرسال',
    chInApp: 'داخل التطبيق', chEmail: 'البريد', chSms: 'رسائل نصية',
    channelsHint: 'داخل التطبيق يعمل دائماً. البريد والرسائل تحتاج تهيئة في الإعدادات.',
    publishNow: 'نشر الآن (يُرسل إلى الجمهور)',
    save: 'حفظ', cancel: 'إلغاء',
    edit: 'تعديل', delete: 'حذف', rebroadcast: 'إعادة الإرسال',
    published: 'منشور', draft: 'مسودة',
    loading: 'جار التحميل…', noAnnouncements: 'لا توجد إعلانات.',
    confirmDelete: 'حذف "{title}"؟',
    confirmRebroadcast: 'إعادة إرسال هذا الإعلان؟',
    broadcastSent: 'تم الإرسال إلى {n} من {total}.',
    savedAsDraft: 'تم الحفظ كمسودة.',
    updated: 'تم التحديث.',
    createdAndPublished: 'تم النشر والإرسال.',
    updatedAndPublished: 'تم التحديث والنشر.',
  },
};

for (const locale of ['en', 'fr', 'ar']) {
  const f = join(root, 'apps/web/messages/' + locale + '.json');
  let raw = readFileSync(f, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const data = JSON.parse(raw);
  data.announcements = { ...(data.announcements || {}), ...dict[locale] };
  writeFileSync(f, JSON.stringify(data, null, 2), 'utf8');
  console.log('  ~ messages/' + locale + '.json — announcements keys added');
}

console.log('\n✅ Announcements i18n fixed');
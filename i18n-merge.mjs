import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const dict = {
  en: {
    staff: {
      title: 'Staff', newStaff: 'New staff member', editTitle: 'Edit staff', newTitle: 'New staff',
      employeeNo: 'Employee no', name: 'Name', position: 'Position',
      email: 'Email', hireDate: 'Hire date', salary: 'Base salary', salaryXAF: 'Base salary (XAF)',
      status: 'Status', active: 'Active', inactive: 'Inactive',
      edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel',
      loading: 'Loading...', noStaff: 'No staff yet.',
      firstName: 'First name', lastName: 'Last name',
      male: 'Male', female: 'Female', other: 'Other', gender: 'Gender',
      confirmDelete: 'Deactivate {name}? (soft-delete, reversible)',
    },
    classes: {
      title: 'Classes', newClass: 'New class', editTitle: 'Edit class', newTitle: 'New class',
      name: 'Name', level: 'Level', capacity: 'Capacity',
      year: 'Year', viewStudents: 'View students', attendance: 'Attendance',
      edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel',
      loading: 'Loading...', noClasses: 'No classes yet.',
      confirmDelete: 'Delete class {name}? This cannot be undone.',
      hasStudents: 'Cannot delete: this class still has students.',
      nameExists: 'A class with this name already exists for the current year.',
      noYear: 'No current academic year set. Create one first.',
    },
    subjects: {
      title: 'Subjects', newSubject: 'New subject', editTitle: 'Edit subject', newTitle: 'New subject',
      code: 'Code', name: 'Name (EN)', nameFr: 'Name (FR)', nameAr: 'Name (AR)',
      edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel',
      loading: 'Loading...', noSubjects: 'No subjects yet.',
      confirmDelete: 'Delete subject {name}?',
      hasMarks: 'Cannot delete: this subject already has marks recorded.',
      codeExists: 'A subject with this code already exists.',
    },
  },
  fr: {
    staff: {
      title: 'Personnel', newStaff: 'Nouveau membre', editTitle: 'Modifier', newTitle: 'Nouveau membre',
      employeeNo: 'Matricule', name: 'Nom', position: 'Poste',
      email: 'Email', hireDate: 'Date embauche', salary: 'Salaire de base', salaryXAF: 'Salaire de base (XAF)',
      status: 'Statut', active: 'Actif', inactive: 'Inactif',
      edit: 'Modifier', delete: 'Desactiver', save: 'Enregistrer', cancel: 'Annuler',
      loading: 'Chargement...', noStaff: 'Aucun personnel.',
      firstName: 'Prenom', lastName: 'Nom',
      male: 'Masculin', female: 'Feminin', other: 'Autre', gender: 'Sexe',
      confirmDelete: 'Desactiver {name} ? (reversible)',
    },
    classes: {
      title: 'Classes', newClass: 'Nouvelle classe', editTitle: 'Modifier la classe', newTitle: 'Nouvelle classe',
      name: 'Nom', level: 'Niveau', capacity: 'Capacite',
      year: 'Annee', viewStudents: 'Voir les eleves', attendance: 'Presence',
      edit: 'Modifier', delete: 'Supprimer', save: 'Enregistrer', cancel: 'Annuler',
      loading: 'Chargement...', noClasses: 'Aucune classe.',
      confirmDelete: 'Supprimer la classe {name} ? Irreversible.',
      hasStudents: 'Impossible de supprimer : des eleves sont encore inscrits.',
      nameExists: 'Une classe avec ce nom existe deja pour l\'annee en cours.',
      noYear: 'Aucune annee scolaire en cours.',
    },
    subjects: {
      title: 'Matieres', newSubject: 'Nouvelle matiere', editTitle: 'Modifier', newTitle: 'Nouvelle matiere',
      code: 'Code', name: 'Nom (EN)', nameFr: 'Nom (FR)', nameAr: 'Nom (AR)',
      edit: 'Modifier', delete: 'Supprimer', save: 'Enregistrer', cancel: 'Annuler',
      loading: 'Chargement...', noSubjects: 'Aucune matiere.',
      confirmDelete: 'Supprimer {name} ?',
      hasMarks: 'Impossible de supprimer : des notes sont enregistrees.',
      codeExists: 'Ce code existe deja.',
    },
  },
  ar: {
    staff: {
      title: 'الموظفون', newStaff: 'موظف جديد', editTitle: 'تعديل', newTitle: 'موظف جديد',
      employeeNo: 'الرقم الوظيفي', name: 'الاسم', position: 'المنصب',
      email: 'البريد', hireDate: 'تاريخ التعيين', salary: 'الراتب', salaryXAF: 'الراتب (XAF)',
      status: 'الحالة', active: 'نشط', inactive: 'غير نشط',
      edit: 'تعديل', delete: 'حذف', save: 'حفظ', cancel: 'إلغاء',
      loading: 'جار التحميل...', noStaff: 'لا يوجد موظفون.',
      firstName: 'الاسم الأول', lastName: 'اسم العائلة',
      male: 'ذكر', female: 'أنثى', other: 'آخر', gender: 'الجنس',
      confirmDelete: 'إلغاء تنشيط {name}؟',
    },
    classes: {
      title: 'الفصول', newClass: 'فصل جديد', editTitle: 'تعديل الفصل', newTitle: 'فصل جديد',
      name: 'الاسم', level: 'المستوى', capacity: 'السعة',
      year: 'السنة', viewStudents: 'عرض الطلاب', attendance: 'الحضور',
      edit: 'تعديل', delete: 'حذف', save: 'حفظ', cancel: 'إلغاء',
      loading: 'جار التحميل...', noClasses: 'لا توجد فصول.',
      confirmDelete: 'حذف الفصل {name}؟',
      hasStudents: 'لا يمكن الحذف: يوجد طلاب مسجلون.',
      nameExists: 'يوجد فصل بهذا الاسم.',
      noYear: 'لا توجد سنة دراسية حالية.',
    },
    subjects: {
      title: 'المواد', newSubject: 'مادة جديدة', editTitle: 'تعديل', newTitle: 'مادة جديدة',
      code: 'الرمز', name: 'الاسم (EN)', nameFr: 'الاسم (FR)', nameAr: 'الاسم (AR)',
      edit: 'تعديل', delete: 'حذف', save: 'حفظ', cancel: 'إلغاء',
      loading: 'جار التحميل...', noSubjects: 'لا توجد مواد.',
      confirmDelete: 'حذف {name}؟',
      hasMarks: 'لا يمكن الحذف: توجد علامات.',
      codeExists: 'الرمز مستخدم بالفعل.',
    },
  },
};

for (const locale of ['en', 'fr', 'ar']) {
  const path = join(root, 'apps/web/messages/' + locale + '.json');
  let raw = readFileSync(path, 'utf8');
  // Defensive: strip BOM if still present
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);

  const data = JSON.parse(raw);
  data.staff    = { ...(data.staff    || {}), ...dict[locale].staff };
  data.classes  = { ...(data.classes  || {}), ...dict[locale].classes };
  data.subjects = { ...(data.subjects || {}), ...dict[locale].subjects };

  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  console.log('  ~ apps/web/messages/' + locale + '.json merged');
}

console.log('\n✅ i18n keys merged');
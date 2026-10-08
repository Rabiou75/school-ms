import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const seedPath = join(root, 'packages/database/prisma/seed.ts');

// Read current seed to preserve it, then append parent block by rewriting the file
// with our known-good version (includes parent + original content).
const seed = `import { PrismaClient, UserRole, Gender } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Lycee Bilingue de Yaounde...");

  // ---------- School ----------
  const school = await prisma.school.upsert({
    where: { slug: "lby" },
    update: {},
    create: {
      name: "Lycee Bilingue de Yaounde",
      slug: "lby",
      country: "CM",
      currency: "XAF",
      defaultLocale: "fr",
      email: "contact@lby.cm",
    },
  });

  // ---------- Admin ----------
  await prisma.user.upsert({
    where: { email: "admin@demo-school.cm" },
    update: { schoolId: school.id },
    create: {
      schoolId: school.id,
      email: "admin@demo-school.cm",
      passwordHash: await bcrypt.hash("Admin@1234", 10),
      firstName: "Super",
      lastName: "Admin",
      role: UserRole.SUPER_ADMIN,
      locale: "fr",
    },
  });

  // ---------- Academic year ----------
  const year = await prisma.academicYear.upsert({
    where: { schoolId_name: { schoolId: school.id, name: "2025-2026" } },
    update: {},
    create: {
      schoolId: school.id,
      name: "2025-2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-07-31"),
      isCurrent: true,
    },
  });

  // ---------- Classes ----------
  const classNames = ["6eme A", "5eme A", "4eme A", "3eme A"];
  const classes = [];
  for (const name of classNames) {
    const existing = await prisma.class.findFirst({ where: { schoolId: school.id, name } });
    const k = existing ?? await prisma.class.create({
      data: { schoolId: school.id, academicYearId: year.id, name, level: name.split(" ")[0], capacity: 40 },
    });
    classes.push(k);
  }
  console.log("  classes: " + classes.length);

  // ---------- Subjects ----------
  const subjects = [
    { code: "MATH", name: "Mathematics", nameFr: "Mathematiques", nameAr: "الرياضيات" },
    { code: "FR",   name: "French",      nameFr: "Francais",      nameAr: "الفرنسية" },
    { code: "EN",   name: "English",     nameFr: "Anglais",       nameAr: "الإنجليزية" },
    { code: "PHY",  name: "Physics",     nameFr: "Physique",      nameAr: "الفيزياء" },
    { code: "BIO",  name: "Biology",     nameFr: "Biologie",      nameAr: "الأحياء" },
    { code: "HIST", name: "History",     nameFr: "Histoire",      nameAr: "التاريخ" },
  ];
  for (const s of subjects) {
    await prisma.subject.upsert({
      where: { schoolId_code: { schoolId: school.id, code: s.code } },
      update: {},
      create: { schoolId: school.id, ...s },
    });
  }
  console.log("  subjects: " + subjects.length);

  // ---------- Teachers ----------
  const teachers = [
    { firstName: "Marie",  lastName: "Ngo Bassong", gender: Gender.FEMALE, email: "m.ngo@lby.cm",     position: "Teacher - Mathematics", salary: 180000 },
    { firstName: "Paul",   lastName: "Mbarga",      gender: Gender.MALE,   email: "p.mbarga@lby.cm",  position: "Teacher - Physics",     salary: 175000 },
    { firstName: "Aicha",  lastName: "Fotso",       gender: Gender.FEMALE, email: "a.fotso@lby.cm",   position: "Teacher - French",      salary: 170000 },
    { firstName: "Eric",   lastName: "Kamdem",      gender: Gender.MALE,   email: "e.kamdem@lby.cm",  position: "Teacher - English",     salary: 170000 },
    { firstName: "Sophie", lastName: "Tchoumi",     gender: Gender.FEMALE, email: "s.tchoumi@lby.cm", position: "Teacher - Biology",     salary: 165000 },
  ];
  const teacherHash = await bcrypt.hash("Teacher@1234", 10);
  for (let i = 0; i < teachers.length; i++) {
    const t = teachers[i];
    const u = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: {
        schoolId: school.id, email: t.email, passwordHash: teacherHash,
        firstName: t.firstName, lastName: t.lastName, role: UserRole.TEACHER, locale: "fr",
      },
    });
    const empNo = "TCH-" + String(i + 1).padStart(3, "0");
    await prisma.staff.upsert({
      where: { schoolId_employeeNo: { schoolId: school.id, employeeNo: empNo } },
      update: {},
      create: {
        schoolId: school.id, userId: u.id, employeeNo: empNo,
        firstName: t.firstName, lastName: t.lastName, gender: t.gender,
        position: t.position, hireDate: new Date("2023-09-01"), baseSalary: t.salary,
      },
    });
  }
  console.log("  teachers: " + teachers.length);

  // ---------- Guardians ----------
  const guardianDefs = [
    { firstName: "Jean",     lastName: "Atangana", relation: "Pere",  phone: "+237 6 99 11 22 33" },
    { firstName: "Claudine", lastName: "Mvogo",    relation: "Mere",  phone: "+237 6 99 44 55 66" },
    { firstName: "Bernard",  lastName: "Nkodo",    relation: "Pere",  phone: "+237 6 99 77 88 99" },
    { firstName: "Estelle",  lastName: "Owona",    relation: "Mere",  phone: "+237 6 77 12 34 56" },
    { firstName: "Michel",   lastName: "Biya",     relation: "Tuteur", phone: "+237 6 77 98 76 54" },
  ];
  const guardians = [];
  for (const g of guardianDefs) {
    const existing = await prisma.guardian.findFirst({
      where: { schoolId: school.id, firstName: g.firstName, lastName: g.lastName },
    });
    const guard = existing ?? await prisma.guardian.create({ data: { schoolId: school.id, ...g } });
    guardians.push(guard);
  }
  console.log("  guardians: " + guardians.length);

  // ---------- Students ----------
  const firstNames = ["Aminata","Brice","Celine","David","Emilie","Franck","Grace","Herve","Ines","Joel","Kevine","Lucie","Marc","Nadine","Olivier","Patricia","Quentin","Rachelle","Serge","Yannick"];
  const lastNames  = ["Nkolo","Manga","Fouda","Tabi","Ayuk","Njike","Bello","Essomba","Ngono","Nkeng"];
  let studentCount = 0;
  for (let i = 0; i < 20; i++) {
    const admissionNo = "LBY-2025-" + String(i + 1).padStart(4, "0");
    const existing = await prisma.student.findUnique({
      where: { schoolId_admissionNo: { schoolId: school.id, admissionNo } },
    });
    if (existing) continue;
    await prisma.student.create({
      data: {
        schoolId: school.id,
        admissionNo,
        firstName: firstNames[i],
        lastName: lastNames[i % lastNames.length],
        gender: i % 2 === 0 ? Gender.MALE : Gender.FEMALE,
        dateOfBirth: new Date(2010 + (i % 4), i % 12, 1 + (i % 28)),
        classId: classes[i % classes.length].id,
        guardianId: guardians[i % guardians.length].id,
        phone: "+237 6 9" + String(i).padStart(2, "0") + " 00 00 " + String(i).padStart(2, "0"),
      },
    });
    studentCount++;
  }
  console.log("  students: " + studentCount);

  // ---------- Fees ----------
  const fees = [
    { name: "Frais de scolarite - Trimestre 1", amount: 150000 },
    { name: "Frais de scolarite - Trimestre 2", amount: 150000 },
    { name: "Frais de scolarite - Trimestre 3", amount: 150000 },
    { name: "Frais d inscription",              amount: 25000 },
  ];
  for (const f of fees) {
    const existing = await prisma.fee.findFirst({ where: { schoolId: school.id, name: f.name } });
    if (!existing) await prisma.fee.create({ data: { schoolId: school.id, ...f } });
  }
  console.log("  fees: " + fees.length);

  // ---------- Announcements ----------
  const announcements = [
    { title: "Rentree scolaire 2025-2026", body: "La rentree aura lieu le 1er septembre 2025 a 7h30." },
    { title: "Reunion parents-professeurs", body: "Reunion le samedi 15 octobre a 9h dans la salle polyvalente." },
  ];
  for (const a of announcements) {
    const existing = await prisma.announcement.findFirst({ where: { schoolId: school.id, title: a.title } });
    if (!existing) {
      await prisma.announcement.create({
        data: { schoolId: school.id, title: a.title, body: a.body, audience: "ALL", publishedAt: new Date() },
      });
    }
  }
  console.log("  announcements: " + announcements.length);

  // ---------- DEMO PARENT ----------
  // Link a PARENT user to the first guardian (Jean Atangana), who has 4 children.
  const parentHash = await bcrypt.hash("Parent@1234", 10);
  const parentUser = await prisma.user.upsert({
    where: { email: "parent@lby.cm" },
    update: { schoolId: school.id },
    create: {
      schoolId: school.id,
      email: "parent@lby.cm",
      passwordHash: parentHash,
      firstName: "Jean",
      lastName: "Atangana",
      role: UserRole.PARENT,
      locale: "fr",
    },
  });

  // Link first guardian to this user
  await prisma.guardian.update({
    where: { id: guardians[0].id },
    data: { userId: parentUser.id },
  });

  const childCount = await prisma.student.count({ where: { guardianId: guardians[0].id } });
  console.log("  demo parent: parent@lby.cm / Parent@1234 (" + childCount + " children)");

  console.log("");
  console.log("Seed complete");
  console.log("  Admin  : admin@demo-school.cm / Admin@1234");
  console.log("  Teacher: m.ngo@lby.cm / Teacher@1234");
  console.log("  Parent : parent@lby.cm / Parent@1234");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
`;

writeFileSync(seedPath, seed, 'utf8');
console.log('✅ seed.ts rewritten with demo parent');
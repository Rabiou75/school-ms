'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Lang = 'en' | 'fr' | 'ar';

const DAYS: Record<Lang, string[]> = {
  en: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  fr: ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],
  ar: ['الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],
};

const T: Record<string, Record<Lang, string>> = {
  title:      { en: 'Timetable',        fr: 'Emploi du temps',   ar: 'الجدول الدراسي' },
  newSlot:    { en: 'Add course',       fr: 'Ajouter un cours',  ar: 'إضافة حصة' },
  empty:      { en: 'No courses scheduled.', fr: 'Aucun cours programme.', ar: 'لا توجد حصص.' },
  room:       { en: 'Room',             fr: 'Salle',             ar: 'القاعة' },
  subject:    { en: 'Subject',          fr: 'Matiere',           ar: 'المادة' },
  teacher:    { en: 'Teacher',          fr: 'Enseignant',        ar: 'المعلم' },
  day:        { en: 'Day',              fr: 'Jour',              ar: 'اليوم' },
  start:      { en: 'Start',            fr: 'Debut',             ar: 'البداية' },
  end:        { en: 'End',              fr: 'Fin',               ar: 'النهاية' },
  save:       { en: 'Save',             fr: 'Enregistrer',       ar: 'حفظ' },
  cancel:     { en: 'Cancel',           fr: 'Annuler',           ar: 'إلغاء' },
  editTitle:  { en: 'Edit course',      fr: 'Modifier le cours', ar: 'تعديل الحصة' },
  newTitle:   { en: 'Add a course',     fr: 'Ajouter un cours',  ar: 'إضافة حصة' },
  confirmDel: { en: 'Delete this course?', fr: 'Supprimer ce cours ?', ar: 'حذف هذه الحصة؟' },
  errClass:   { en: 'Time conflict for this class.', fr: 'Conflit horaire pour cette classe.', ar: 'تعارض في وقت الفصل.' },
  errTeacher: { en: 'This teacher already has a class at this time.', fr: 'Ce professeur a deja un cours sur ce creneau.', ar: 'هذا المعلم لديه حصة في نفس الوقت.' },
  errRange:   { en: 'End time must be after start time.', fr: 'L heure de fin doit etre apres le debut.', ar: 'يجب أن يكون وقت النهاية بعد وقت البداية.' },
};

type Slot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  subject: { id: string; name: string; code: string };
  teacher: { id: string; firstName: string; lastName: string } | null;
};

export default function TimetablePage() {
  const params = useParams() as { locale?: string };
  const locale = params?.locale || 'fr';
  const l: Lang = locale === 'en' || locale === 'ar' ? locale : 'fr';

  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editSlot, setEditSlot] = useState<Slot | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/v1/classes').then((r) => (r.ok ? r.json() : [])),
      apiFetch('/api/v1/subjects').then((r) => (r.ok ? r.json() : [])),
      apiFetch('/api/v1/staff').then((r) => (r.ok ? r.json() : [])),
    ]).then(([c, s, st]) => {
      setClasses(Array.isArray(c) ? c : []);
      setSubjects(Array.isArray(s) ? s : []);
      setStaff(Array.isArray(st) ? st : []);
      if (c[0]?.id) setClassId(c[0].id);
    }).catch((e) => setErr(String(e)));
  }, []);

  const load = () => {
    if (!classId) return;
    apiFetch('/api/v1/timetable/class/' + classId)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSlots(Array.isArray(d) ? d : []))
      .catch((e) => setErr(String(e)));
  };
  useEffect(load, [classId]);

  const remove = async (id: string) => {
    if (!confirm(T.confirmDel[l])) return;
    await apiFetch('/api/v1/timetable/' + id, { method: 'DELETE' });
    load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{T.title[l]}</h1>
        <div className="flex items-center gap-2">
          <select value={classId} onChange={(e) => setClassId(e.target.value)}
                  className="rounded border px-3 py-2 text-sm">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setShowNew(true)} disabled={!classId}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
            + {T.newSlot[l]}
          </button>
        </div>
      </div>

      {err && <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50">
            <tr>
              {DAYS[l].map((d) => (
                <th key={d} className="border-r p-3 text-left font-medium last:border-r-0">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {[1, 2, 3, 4, 5, 6].map((day) => {
                const daySlots = slots.filter((s) => s.dayOfWeek === day);
                return (
                  <td key={day} className="border-r border-t p-2 align-top last:border-r-0">
                    {daySlots.length === 0 && <div className="text-xs text-gray-300">—</div>}
                    {daySlots.map((s) => (
                      <div key={s.id} className="mb-2 rounded border border-teal-200 bg-teal-50 p-2 text-xs">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-teal-900">{s.subject.code}</div>
                            <div className="text-[10px] text-teal-700">{s.startTime}–{s.endTime}</div>
                            {s.teacher && (
                              <div className="mt-1 text-[10px] text-gray-600">
                                {s.teacher.firstName} {s.teacher.lastName}
                              </div>
                            )}
                            {s.room && <div className="text-[10px] text-gray-500">{T.room[l]}: {s.room}</div>}
                          </div>
                          <div className="flex flex-col gap-1">
                            <button onClick={() => setEditSlot(s)} className="text-[10px] text-gray-500 hover:text-brand-700">✏️</button>
                            <button onClick={() => remove(s.id)} className="text-[10px] text-gray-500 hover:text-red-600">✕</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {(showNew || editSlot) && (
        <SlotModal
          classId={classId}
          slot={editSlot}
          subjects={subjects}
          staff={staff}
          lang={l}
          onClose={() => { setShowNew(false); setEditSlot(null); }}
          onSaved={() => { setShowNew(false); setEditSlot(null); load(); }}
        />
      )}
    </div>
  );
}

function SlotModal({ classId, slot, subjects, staff, lang, onClose, onSaved }: any) {
  const l: Lang = lang;
  const isEdit = !!slot;
  const [form, setForm] = useState({
    subjectId: slot?.subject?.id ?? subjects[0]?.id ?? '',
    teacherId: slot?.teacher?.id ?? '',
    dayOfWeek: slot?.dayOfWeek ?? 1,
    startTime: slot?.startTime ?? '08:00',
    endTime: slot?.endTime ?? '09:00',
    room: slot?.room ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const url = isEdit ? '/api/v1/timetable/' + slot.id : '/api/v1/timetable';
      const method = isEdit ? 'PUT' : 'POST';
      const body: any = { ...form };
      if (!isEdit) body.classId = classId;
      const r = await apiFetch(url, { method, body: JSON.stringify(body) });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes('class_time_conflict')) { setErr(T.errClass[l]); setSaving(false); return; }
        if (txt.includes('teacher_time_conflict')) { setErr(T.errTeacher[l]); setSaving(false); return; }
        if (txt.includes('invalid_time_range')) { setErr(T.errRange[l]); setSaving(false); return; }
        throw new Error(txt);
      }
      onSaved();
    } catch (e: any) { setErr(String(e)); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{isEdit ? T.editTitle[l] : T.newTitle[l]}</h3>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{T.subject[l]}</span>
          <select required value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                  className="w-full rounded border px-3 py-2">
            {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{T.teacher[l]}</span>
          <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                  className="w-full rounded border px-3 py-2">
            <option value="">—</option>
            {staff.map((s: any) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.position})</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{T.day[l]}</span>
          <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
                  className="w-full rounded border px-3 py-2">
            {DAYS[l].map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{T.start[l]}</span>
            <input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                   className="w-full rounded border px-3 py-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">{T.end[l]}</span>
            <input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                   className="w-full rounded border px-3 py-2" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium">{T.room[l]}</span>
          <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}
                 placeholder="Salle 12" className="w-full rounded border px-3 py-2" />
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">{T.cancel[l]}</button>
          <button disabled={saving} className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? '...' : T.save[l]}
          </button>
        </div>
      </form>
    </div>
  );
}

import { z } from 'zod';

export const attendanceStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;

export const markAttendanceSchema = z.object({
  studentId: z.string().min(1),
  date: z.string(),
  status: z.enum(attendanceStatuses),
  remarks: z.string().optional(),
});

export const bulkAttendanceSchema = z.object({
  classId: z.string().min(1),
  date: z.string(),
  status: z.enum(attendanceStatuses).default('PRESENT'),
});

export type MarkAttendanceDto = z.infer<typeof markAttendanceSchema>;
export type BulkAttendanceDto = z.infer<typeof bulkAttendanceSchema>;

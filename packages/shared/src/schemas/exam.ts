import { z } from 'zod';

export const examTypes = ['QUIZ','MID_TERM','FINAL','MOCK','CONTINUOUS'] as const;

export const createExamSchema = z.object({
  name: z.string().min(1),
  type: z.enum(examTypes).default('MID_TERM'),
  classId: z.string().optional(),
  termId: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
});

export const markEntrySchema = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  score: z.number().min(0),
  maxScore: z.number().positive().default(20),
  coefficient: z.number().positive().default(1),
});

export const saveMarksSchema = z.object({
  entries: z.array(markEntrySchema),
});

export type CreateExamDto = z.infer<typeof createExamSchema>;
export type MarkEntryDto = z.infer<typeof markEntrySchema>;
export type SaveMarksDto = z.infer<typeof saveMarksSchema>;

import { z } from 'zod';

export const createSubjectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  nameFr: z.string().optional(),
  nameAr: z.string().optional(),
});
export type CreateSubjectDto = z.infer<typeof createSubjectSchema>;

export const updateSubjectSchema = createSubjectSchema.partial();
export type UpdateSubjectDto = z.infer<typeof updateSubjectSchema>;

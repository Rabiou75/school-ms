import { z } from 'zod';

export const createStudentSchema = z.object({
  admissionNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  dateOfBirth: z.string(),
  classId: z.string().optional(),
  guardianId: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});
export type CreateStudentDto = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = createStudentSchema.partial();
export type UpdateStudentDto = z.infer<typeof updateStudentSchema>;
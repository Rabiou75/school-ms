import { z } from 'zod';

export const createStaffSchema = z.object({
  employeeNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  position: z.string().min(1),
  hireDate: z.string(),
  baseSalary: z.number().int().min(0),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});
export type CreateStaffDto = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = createStaffSchema.partial();
export type UpdateStaffDto = z.infer<typeof updateStaffSchema>;

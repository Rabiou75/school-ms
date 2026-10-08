import { z } from 'zod';

export const createGuardianSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  relation: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  // If password provided, also create a PARENT user account
  password: z.string().min(8).optional().or(z.literal('')),
});

export const updateGuardianSchema = createGuardianSchema.partial();
export type CreateGuardianDto = z.infer<typeof createGuardianSchema>;
export type UpdateGuardianDto = z.infer<typeof updateGuardianSchema>;

import { z } from 'zod';

export const createClassSchema = z.object({
  name: z.string().min(1),
  level: z.string().optional(),
  capacity: z.number().int().positive().default(40),
});
export type CreateClassDto = z.infer<typeof createClassSchema>;

export const updateClassSchema = createClassSchema.partial();
export type UpdateClassDto = z.infer<typeof updateClassSchema>;

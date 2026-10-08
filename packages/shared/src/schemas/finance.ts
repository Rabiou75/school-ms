import { z } from 'zod';

export const paymentMethods = ['CASH','MTN_MOMO','ORANGE_MONEY','BANK_TRANSFER','CHEQUE','CARD','OTHER'] as const;

export const createFeeSchema = z.object({
  name: z.string().min(1),
  amount: z.number().int().positive(),
  classId: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const createInvoiceSchema = z.object({
  studentId: z.string().min(1),
  dueDate: z.string(),
  total: z.number().int().positive(),
});

export const recordPaymentSchema = z.object({
  amount: z.number().int().positive(),
  method: z.enum(paymentMethods),
  reference: z.string().optional(),
});

export type CreateFeeDto = z.infer<typeof createFeeSchema>;
export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;
export type RecordPaymentDto = z.infer<typeof recordPaymentSchema>;

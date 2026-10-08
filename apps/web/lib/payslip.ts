import { apiFetch } from './api';

export async function downloadPayslip(itemId: string, locale = 'fr'): Promise<void> {
  const res = await apiFetch('/api/v1/payroll/' + itemId + '/payslip?locale=' + locale);
  if (!res.ok) throw new Error('Payslip failed: ' + res.status);
  const blob = await res.blob();
  if (blob.size < 500) throw new Error('Payslip too small');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'payslip-' + itemId.slice(-8) + '.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

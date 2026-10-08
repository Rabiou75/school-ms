import { apiFetch } from './api';

export async function downloadReceipt(paymentId: string, locale: string = 'fr', invoiceNo?: string): Promise<void> {
  const res = await apiFetch('/api/v1/payments/' + paymentId + '/receipt?locale=' + locale);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error('Receipt failed: ' + res.status + ' ' + txt.slice(0, 120));
  }
  const blob = await res.blob();
  if (blob.size < 500) throw new Error('Receipt PDF too small: ' + blob.size + ' bytes');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (invoiceNo ? invoiceNo : 'receipt-' + paymentId.slice(-8)) + '.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

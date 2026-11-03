import type { ReceiptPaper } from '@/stores/preferences';

/**
 * Prints the open .print-area. @page needs two lengths ("80mm auto" is invalid), so an 80 mm page is sized to the rendered receipt. The
 * style goes once printing ends: it would otherwise apply to the next report printed.
 */
export function printReceipt(paper: ReceiptPaper) {
  const receipt = document.querySelector<HTMLElement>('.print-area');
  if (!receipt) return;
  document.getElementById('receipt-page')?.remove();
  if (paper === '80mm') {
    // offsetHeight, not getBoundingClientRect: the dialog opens with a zoom, and a receipt measured mid-zoom would get too short a page.
    const heightMm = Math.ceil((receipt.offsetHeight * 25.4) / 96) + 6;
    const style = document.createElement('style');
    style.id = 'receipt-page';
    style.textContent = `@media print { @page { size: 80mm ${heightMm}mm; margin: 2mm; } }`;
    document.head.appendChild(style);
    window.addEventListener('afterprint', () => style.remove(), { once: true });
  }
  window.print();
}

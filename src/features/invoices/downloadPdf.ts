/** A4 in millimetres, with the same 14 mm margin the printed invoice uses. */
const PAGE = { width: 210, height: 297, margin: 14 };
/** Rendered at twice screen resolution: sharp when printed, still a small file as JPEG. */
const SCALE = 2;
/** An invoice up to this much taller than a page is shrunk onto one page rather than run on to a second for a few lines. */
const FIT_ON_ONE_PAGE = 1.25;

/** "Invoice INV-000010 - Let's Talk Sacco.pdf", without characters Windows refuses in a file name. */
export function invoiceFileName(number: string, customerName?: string | null): string {
  const name = [`Invoice ${number}`, customerName?.trim()].filter(Boolean).join(' - ');
  return `${name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()}.pdf`;
}

/**
 * Where a page may end, in CSS pixels from the top: under a table row, or under one of the invoice's own blocks (header, parties,
 * table, totals). Never inside a block, so no line of text or row is cut in two.
 */
function pageBreaks(root: HTMLElement): number[] {
  const top = root.getBoundingClientRect().top;
  return Array.from(root.querySelectorAll<HTMLElement>(':scope > *, tr'))
    .map((el) => el.getBoundingClientRect().bottom - top)
    .sort((a, b) => a - b);
}

/**
 * Where each page starts and ends, in canvas pixels. A page ends at the last break that fits; a block taller than a page is cut at the
 * page edge, the only choice left.
 */
export function pageSlices(totalHeight: number, pageHeight: number, breaks: number[]): [number, number][] {
  const slices: [number, number][] = [];
  let top = 0;
  while (top < totalHeight - 1) {
    const limit = top + pageHeight;
    let end = totalHeight;
    if (limit < totalHeight) {
      const fits = breaks.filter((b) => b > top + 1 && b <= limit);
      end = fits.length ? fits[fits.length - 1] : limit;
    }
    slices.push([top, end]);
    top = end;
  }
  return slices;
}

/**
 * Saves an element (the A4 invoice) as a PDF the user downloads. The element is copied off screen at its printed width, so the dialog's
 * scrolling and zoom do not change it, and drawn onto A4 pages: shrunk onto one page when it is only a little longer, else run on to
 * more pages, breaking under a row. Anything marked no-print is left out, as when printing. The libraries load only on download.
 */
export async function downloadPdf(element: HTMLElement, fileName: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  const contentWidthMm = PAGE.width - PAGE.margin * 2;
  const contentHeightMm = PAGE.height - PAGE.margin * 2;
  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${contentWidthMm}mm;background:#fff;`;
  const copy = element.cloneNode(true) as HTMLElement;
  // The page has its own margins: drop the on-screen padding, keeping a little room under the last line.
  copy.style.padding = '0 0 6px';
  copy.style.maxWidth = 'none';
  holder.appendChild(copy);
  document.body.appendChild(holder);
  try {
    const breaks = pageBreaks(copy);
    const cssHeight = copy.getBoundingClientRect().height;
    const canvas = await html2canvas(copy, {
      scale: SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      ignoreElements: (el) => el.classList?.contains('no-print') ?? false,
    });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const pxPerMm = canvas.width / contentWidthMm;
    const totalMm = canvas.height / pxPerMm;

    if (totalMm <= contentHeightMm * FIT_ON_ONE_PAGE) {
      const shrink = Math.min(1, contentHeightMm / totalMm);
      const width = contentWidthMm * shrink;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', PAGE.margin + (contentWidthMm - width) / 2, PAGE.margin, width, totalMm * shrink);
    } else {
      const toCanvas = canvas.height / cssHeight;
      const slices = pageSlices(canvas.height, Math.floor(contentHeightMm * pxPerMm), breaks.map((b) => Math.round(b * toCanvas)));
      slices.forEach(([top, end], page) => {
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = end - top;
        const ctx = slice.getContext('2d');
        if (!ctx) throw new Error('This browser cannot draw the invoice.');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, top, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        if (page > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', PAGE.margin, PAGE.margin, contentWidthMm, slice.height / pxPerMm);
      });
    }
    pdf.save(fileName);
  } finally {
    holder.remove();
  }
}

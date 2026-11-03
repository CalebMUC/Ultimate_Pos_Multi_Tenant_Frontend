import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { printReceipt } from './print';

const pageStyle = () => document.getElementById('receipt-page');

beforeEach(() => {
  window.print = vi.fn();
  const receipt = document.createElement('div');
  receipt.className = 'print-area';
  document.body.appendChild(receipt);
});
afterEach(() => {
  document.body.innerHTML = '';
  document.head.querySelectorAll('#receipt-page').forEach((s) => s.remove());
});

describe('printReceipt', () => {
  it('sizes an 80 mm page with two lengths, then prints once', () => {
    printReceipt('80mm');
    expect(pageStyle()?.textContent).toMatch(/@page \{ size: 80mm \d+mm; margin: 2mm; \}/);
    expect(window.print).toHaveBeenCalledOnce();
  });

  it('adds no page style for A4', () => {
    printReceipt('a4');
    expect(pageStyle()).toBeNull();
    expect(window.print).toHaveBeenCalledOnce();
  });

  it('leaves one page style when printed twice', () => {
    printReceipt('80mm');
    printReceipt('80mm');
    expect(document.querySelectorAll('#receipt-page')).toHaveLength(1);
  });

  it('removes the page style once printing ends, so the next report is on normal paper', () => {
    printReceipt('80mm');
    window.dispatchEvent(new Event('afterprint'));
    expect(pageStyle()).toBeNull();
  });

  it('prints nothing when there is no receipt on screen', () => {
    document.body.innerHTML = '';
    printReceipt('80mm');
    expect(window.print).not.toHaveBeenCalled();
    expect(pageStyle()).toBeNull();
  });
});

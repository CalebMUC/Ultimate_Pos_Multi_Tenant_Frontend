import { useRef } from 'react';

/** Radix only returns focus to a DialogTrigger. These dialogs open from a card, so spread this on DialogContent to send it back there. */
export function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => { opener.current = document.activeElement as HTMLElement | null; },
    onCloseAutoFocus: (e: Event) => { e.preventDefault(); opener.current?.focus(); },
  };
}

'use client';

import { QRCodeSVG } from 'qrcode.react';

/** KRA's verification link as a QR code: black on white with a quiet zone, so it survives thermal printing. size is a CSS length. */
export function EtimsQr({ value, size }: { value: string; size: string }) {
  return (
    <QRCodeSVG
      value={value}
      size={256}
      level="M"
      marginSize={2}
      bgColor="#ffffff"
      fgColor="#000000"
      style={{ width: size, height: size }}
      aria-label="KRA verification QR code"
      role="img"
    />
  );
}

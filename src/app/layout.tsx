import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Ultimate POS', template: '%s · Ultimate POS' },
  description: 'Point of sale and back office for Kenyan businesses.',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

// Applies the saved theme before first paint so there is no flash of the wrong theme.
const themeScript = `(function(){try{var p=JSON.parse(localStorage.getItem('upos.preferences')||'{}');var t=(p.state&&p.state.theme)||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fantasy Football Model Dashboard',
  description: 'Fantasy Football analytics dashboard and predictive model starter',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body data-testid="app-root">{children}</body>
    </html>
  );
}

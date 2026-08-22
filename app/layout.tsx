import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sistema Gastronómico Live',
  description: 'Sistema POS y KDS para gastronomía',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sakesu Sushi Delivery | POS & KDS',
  description: 'Sistema integral gastronómico para Sakesu Sushi Delivery',
  manifest: '/manifest.json',
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

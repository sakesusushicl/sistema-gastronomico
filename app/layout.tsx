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
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e293b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  );
}

import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Sakesu Sushi POS',
  description: 'Sistema de Gestión y POS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-neutral-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}

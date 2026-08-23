import React from 'react';

export const metadata = {
  title: 'Sakesu Sushi POS',
  description: 'Sistema Gastronómico y Punto de Venta',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#0a0a0a', color: '#ffffff' }}>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sistema Gastronómico Live',
  description: 'KDS y POS en tiempo real',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#0f172a' }}>
        {children}
      </body>
    </html>
  );
}

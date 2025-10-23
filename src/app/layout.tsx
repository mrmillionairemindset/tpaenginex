import './globals.css';
import { Inter } from 'next/font/google';
import { SessionProvider } from '@/components/session-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'WorkSafe Now Portal',
  description: 'WorkSafe Now Portal - Healthcare screening coordination platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

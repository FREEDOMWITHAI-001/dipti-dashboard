import './globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ToastProvider } from '@/components/shell/toast-region';
import { ThemeProvider } from '@/components/shell/theme-provider';
import { CommandPaletteProvider } from '@/components/shell/command-palette';
import type { Metadata } from 'next';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const mono  = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'DVA Operations',
  description: 'Diamond program — student tracking, EMI, and GHL automation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="overflow-hidden">
        <ThemeProvider>
          <CommandPaletteProvider>
            <ToastProvider>{children}</ToastProvider>
          </CommandPaletteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

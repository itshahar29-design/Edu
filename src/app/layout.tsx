import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { TelegramInit } from '@/components/telegram-init';
import './globals.css';

export const metadata: Metadata = {
  title: 'EduMemory — Davomat',
  description: "O'quv markazi davomat tizimi (Telegram Mini App)",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz">
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <TelegramInit>{children}</TelegramInit>
      </body>
    </html>
  );
}

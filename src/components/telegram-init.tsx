'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { TelegramUser, TelegramWebApp } from '@/types/telegram';

interface TelegramContextValue {
  webApp: TelegramWebApp | null;
  user: TelegramUser | null;
  isReady: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  role: string | null;
}

const TelegramContext = createContext<TelegramContextValue>({
  webApp: null,
  user: null,
  isReady: false,
  isAuthenticating: true,
  authError: null,
  role: null,
});

export function useTelegram(): TelegramContextValue {
  return useContext(TelegramContext);
}

interface TelegramInitProps {
  children: ReactNode;
}

export function TelegramInit({ children }: TelegramInitProps) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const tg = window.Telegram?.WebApp;

      if (!tg) {
        if (!cancelled) {
          setAuthError('Telegram WebApp topilmadi. Iltimos, ilovani Telegram ichida oching.');
          setIsAuthenticating(false);
        }
        return;
      }

      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation();

      if (!cancelled) {
        setWebApp(tg);
        setUser(tg.initDataUnsafe.user ?? null);
        setIsReady(true);
      }

      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: tg.initData }),
        });
        const data = (await response.json()) as {
          ok: boolean;
          error?: string;
          profile?: { role: string };
        };

        if (!cancelled) {
          if (data.ok && data.profile) {
            setRole(data.profile.role);
          } else {
            setAuthError(data.error ?? 'Autentifikatsiya muvaffaqiyatsiz');
          }
          setIsAuthenticating(false);
        }
      } catch {
        if (!cancelled) {
          setAuthError('Serverga ulanib bo\'lmadi');
          setIsAuthenticating(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ webApp, user, isReady, isAuthenticating, authError, role }),
    [webApp, user, isReady, isAuthenticating, authError, role]
  );

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: TelegramWebAppInitData;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  isClosingConfirmationEnabled: boolean;
  isVerticalSwipesEnabled: boolean;
  headerColor: string;
  backgroundColor: string;

  MainButton: TelegramMainButton;
  SecondaryButton: TelegramMainButton;
  BackButton: TelegramBackButton;
  SettingsButton: TelegramSettingsButton;
  HapticFeedback: TelegramHapticFeedback;
  CloudStorage: TelegramCloudStorage;
  BiometricManager: TelegramBiometricManager;

  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  enableVerticalSwipes: () => void;
  disableVerticalSwipes: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;

  onEvent: (eventType: TelegramEventType, eventHandler: () => void) => void;
  offEvent: (eventType: TelegramEventType, eventHandler: () => void) => void;
  sendData: (data: string) => void;
  switchInlineQuery: (query: string, choose_chat_types?: string[]) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void;
  showPopup: (params: TelegramPopupParams, callback?: (buttonId: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showScanQrPopup: (
    params: { text?: string },
    callback?: (text: string) => void
  ) => void;
  closeScanQrPopup: () => void;
  readTextFromClipboard: (callback?: (text: string) => void) => void;
  requestWriteAccess: (callback?: (granted: boolean) => void) => void;
  requestContact: (callback?: (granted: boolean) => void) => void;

  isVersionAtLeast: (version: string) => boolean;
}

export type TelegramEventType =
  | 'themeChanged'
  | 'viewportChanged'
  | 'mainButtonClicked'
  | 'secondaryButtonClicked'
  | 'backButtonClicked'
  | 'settingsButtonClicked'
  | 'invoiceClosed'
  | 'popupClosed'
  | 'qrTextReceived'
  | 'clipboardTextReceived'
  | 'writeAccessRequested'
  | 'contactRequested';

export interface TelegramWebAppInitData {
  query_id?: string;
  user?: TelegramUser;
  receiver?: TelegramUser;
  chat?: TelegramChat;
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date: number;
  hash: string;
}

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title: string;
  username?: string;
  photo_url?: string;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

export interface TelegramMainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText: (text: string) => TelegramMainButton;
  onClick: (callback: () => void) => TelegramMainButton;
  offClick: (callback: () => void) => TelegramMainButton;
  show: () => TelegramMainButton;
  hide: () => TelegramMainButton;
  enable: () => TelegramMainButton;
  disable: () => TelegramMainButton;
  showProgress: (leaveActive?: boolean) => TelegramMainButton;
  hideProgress: () => TelegramMainButton;
  setParams: (params: Partial<{
    text: string;
    color: string;
    text_color: string;
    is_active: boolean;
    is_visible: boolean;
  }>) => TelegramMainButton;
}

export interface TelegramBackButton {
  isVisible: boolean;
  onClick: (callback: () => void) => TelegramBackButton;
  offClick: (callback: () => void) => TelegramBackButton;
  show: () => TelegramBackButton;
  hide: () => TelegramBackButton;
}

export interface TelegramSettingsButton {
  isVisible: boolean;
  onClick: (callback: () => void) => TelegramSettingsButton;
  offClick: (callback: () => void) => TelegramSettingsButton;
  show: () => TelegramSettingsButton;
  hide: () => TelegramSettingsButton;
}

export interface TelegramHapticFeedback {
  impactOccurred: (
    style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
  ) => void;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged: () => void;
}

export interface TelegramCloudStorage {
  setItem: (key: string, value: string, callback?: (error: string | null, success?: boolean) => void) => void;
  getItem: (key: string, callback: (error: string | null, value?: string) => void) => void;
  getItems: (keys: string[], callback: (error: string | null, values?: Record<string, string>) => void) => void;
  removeItem: (key: string, callback?: (error: string | null, success?: boolean) => void) => void;
  removeItems: (keys: string[], callback?: (error: string | null, success?: boolean) => void) => void;
  getKeys: (callback: (error: string | null, keys?: string[]) => void) => void;
}

export interface TelegramBiometricManager {
  isInited: boolean;
  isBiometricAvailable: boolean;
  biometricType: 'finger' | 'face' | 'unknown';
  isAccessRequested: boolean;
  isAccessGranted: boolean;
  isBiometricTokenSaved: boolean;
  deviceId: string;
  init: (callback?: () => void) => void;
  requestAccess: (
    params: { reason?: string },
    callback?: (granted: boolean) => void
  ) => void;
  authenticate: (
    params: { reason?: string },
    callback?: (success: boolean, token?: string) => void
  ) => void;
}

export interface TelegramPopupParams {
  title?: string;
  message: string;
  buttons?: Array<{
    id?: string;
    type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
    text?: string;
  }>;
}

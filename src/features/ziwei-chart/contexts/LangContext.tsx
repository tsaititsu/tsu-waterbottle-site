import { createContext, useContext } from 'react';
import type { Locale } from '../i18n';

export type { Locale };

interface LangCtx {
  locale: Locale;
  showPinyin: boolean;
  setLocale: (l: Locale) => void;
  togglePinyin: () => void;
}

export const LangContext = createContext<LangCtx>({
  locale: 'zh-TW',
  showPinyin: false,
  setLocale: () => {},
  togglePinyin: () => {},
});

export const useLang = () => useContext(LangContext);

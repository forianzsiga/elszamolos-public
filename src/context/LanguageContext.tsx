/**
 * @file Language context, provider, and translation helper.
 *
 * Exposes the active language, a setter, and a `t()` function that
 * resolves keys against modular JSON translation files (en / hu).
 * Also supports a `'debug'` language that returns keys verbatim.
 */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from 'react';

// Import modular translation files
import enCommon from '../locales/en/common.json';
import enDashboard from '../locales/en/dashboard.json';
import enJobs from '../locales/en/jobs.json';
import enTariff from '../locales/en/tariff.json';
import enInvoice from '../locales/en/invoice.json';
import enSync from '../locales/en/sync.json';
import enLogs from '../locales/en/logs.json';

import huCommon from '../locales/hu/common.json';
import huDashboard from '../locales/hu/dashboard.json';
import huJobs from '../locales/hu/jobs.json';
import huTariff from '../locales/hu/tariff.json';
import huInvoice from '../locales/hu/invoice.json';
import huSync from '../locales/hu/sync.json';
import huLogs from '../locales/hu/logs.json';

/** Supported application languages, plus a debug mode that returns raw translation keys. */
export type Language = 'en' | 'hu' | 'debug';

type Translations = Record<string, string>;

const translations: Record<Exclude<Language, 'debug'>, Translations> = {
    en: {
        ...enCommon,
        ...enDashboard,
        ...enJobs,
        ...enTariff,
        ...enInvoice,
        ...enSync,
        ...enLogs
    },
    hu: {
        ...huCommon,
        ...huDashboard,
        ...huJobs,
        ...huTariff,
        ...huInvoice,
        ...huSync,
        ...huLogs
    }
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * React provider that wraps the application tree with language context.
 *
 * @param props             Component props.
 * @param props.children    Child elements that will have access to language state.
 * @returns                 A LanguageContext.Provider element.
 */
export const LanguageProvider = ({ children }: { children: ReactNode }) => {
    const [language, setLanguageState] = useState<Language>(() => {
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem('language');
            return (saved === 'en' || saved === 'hu' || saved === 'debug') ? (saved as Language) : 'en';
        }
        return 'en';
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('language', lang);
        }
    };

    const t = (key: string): string => {
        if (language === 'debug') {
            return key;
        }
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

/**
 * Hook that consumes the LanguageContext.
 *
 * @returns The current language context containing `language`, `setLanguage`, and `t`.
 * @throws  Error if called outside a <LanguageProvider>.
 */
export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { useEffect, useState } from "react";

import en from "@/locales/en.json";
import am from "@/locales/am.json";
import or from "@/locales/or.json";
import sw from "@/locales/sw.json";
import fr from "@/locales/fr.json";
import ar from "@/locales/ar.json";

export type Lang = "en" | "am" | "or" | "sw" | "fr" | "ar";

export const languages: { code: Lang; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "am", label: "አማርኛ", flag: "🇪🇹" },
  { code: "or", label: "Afaan Oromoo", flag: "🇪🇹" },
  { code: "sw", label: "Kiswahili", flag: "🇰🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
];

// Languages that are read Right-to-Left
const RTL_LANGS: Lang[] = ["ar"];

const isLang = (v: string | null): v is Lang =>
  v === "en" ||
  v === "am" ||
  v === "or" ||
  v === "sw" ||
  v === "fr" ||
  v === "ar";

const savedLang =
  typeof window !== "undefined"
    ? window.localStorage.getItem("moybirr_lang")
    : null;

const initialLang: Lang = isLang(savedLang) ? savedLang : "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    am: { translation: am },
    or: { translation: or },
    sw: { translation: sw },
    fr: { translation: fr },
    ar: { translation: ar },
  },
  lng: initialLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Apply RTL/LTR + language code to the <html> tag
function applyDirection(lang: string) {
  if (typeof document === "undefined") return;
  const isRtl = RTL_LANGS.includes(lang as Lang);
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

applyDirection(initialLang);

i18n.on("languageChanged", applyDirection);

export function useLang() {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    const handler = (lng: string) => {
      if (isLang(lng)) setLangState(lng);
    };
    i18n.on("languageChanged", handler);
    return () => {
      i18n.off("languageChanged", handler);
    };
  }, []);

  const setLang = (l: Lang) => {
    i18n.changeLanguage(l);
    window.localStorage.setItem("moybirr_lang", l);
  };

  const t = (key: string, options?: Record<string, unknown>) =>
    i18n.t(key, options) as string;

  return { lang, setLang, t };
}

export function formatETB(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return `${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`;
}
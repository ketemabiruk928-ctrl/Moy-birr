import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "am" | "or" | "fr";

export const languages: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "am", label: "አማርኛ" },
  { code: "or", label: "Afaan Oromoo" },
  { code: "fr", label: "Français" },
];

type Entry = Record<Lang, string>;

const dict: Record<string, Entry> = {
  app_tagline: {
    en: "Ethiopia's hospitality super-app",
    am: "የኢትዮጵያ የእንግዳ ተቀባይነት ሱፐር-አፕ",
    or: "Sooper-aappii keessummeessuu Itoophiyaa",
    fr: "La super-app hôtelière de l'Éthiopie",
  },
  home: { en: "Home", am: "መነሻ", or: "Mana", fr: "Accueil" },
  hotels: { en: "Hotels", am: "ሆቴሎች", or: "Hoteelota", fr: "Hôtels" },
  pay: { en: "Pay", am: "ክፍያ", or: "Kaffali", fr: "Payer" },
  jobs: { en: "Jobs", am: "ስራዎች", or: "Hojiiwwan", fr: "Emplois" },
  profile: { en: "Profile", am: "መገለጫ", or: "Ibsa", fr: "Profil" },
  staff: { en: "Staff", am: "ሰራተኞች", or: "Hojjettoota", fr: "Personnel" },
  dashboard: { en: "Dashboard", am: "ዳሽቦርድ", or: "Daashboordii", fr: "Tableau de bord" },
  balance: { en: "Wallet balance", am: "የቦርሳ ቀሪ ሂሳብ", or: "Hafteen korojoo", fr: "Solde du portefeuille" },
  deposit: { en: "Deposit", am: "ማስገባት", or: "Galchi", fr: "Dépôt" },
  send: { en: "Send", am: "መላክ", or: "Ergi", fr: "Envoyer" },
  withdraw: { en: "Withdraw", am: "ማውጣት", or: "Baasi", fr: "Retirer" },
  scan_pay: { en: "Scan & Pay", am: "ስካን እና ክፍያ", or: "Iskaani & Kaffali", fr: "Scanner & Payer" },
  transactions: { en: "Transactions", am: "ግብይቶች", or: "Daldala", fr: "Transactions" },
  no_transactions: {
    en: "No transactions yet",
    am: "እስካሁን ግብይት የለም",
    or: "Ammaaf daldalli hin jiru",
    fr: "Aucune transaction",
  },
  amount: { en: "Amount (ETB)", am: "መጠን (ብር)", or: "Hamma (ETB)", fr: "Montant (ETB)" },
  phone: { en: "Phone number", am: "የስልክ ቁጥር", or: "Lakkoofsa bilbilaa", fr: "Numéro de téléphone" },
  full_name: { en: "Full name", am: "ሙሉ ስም", or: "Maqaa guutuu", fr: "Nom complet" },
  password: { en: "Password", am: "የመግቢያ ቃል", or: "Jecha icciitii", fr: "Mot de passe" },
  login: { en: "Log in", am: "ግባ", or: "Seeni", fr: "Se connecter" },
  register: { en: "Create account", am: "መዝገብ", or: "Herrega banni", fr: "Créer un compte" },
  logout: { en: "Log out", am: "ውጣ", or: "Ba'i", fr: "Se déconnecter" },
  role: { en: "I am a", am: "እኔ", or: "Ani", fr: "Je suis" },
  guest: { en: "Guest", am: "እንግዳ", or: "Keessummaa", fr: "Client" },
  owner: { en: "Hotel Owner", am: "የሆቴል ባለቤት", or: "Abbaa hoteelaa", fr: "Propriétaire d'hôtel" },
  confirm: { en: "Confirm", am: "አረጋግጥ", or: "Mirkaneessi", fr: "Confirmer" },
  cancel: { en: "Cancel", am: "ሰርዝ", or: "Haqi", fr: "Annuler" },
  book_now: { en: "Book now", am: "አሁን ያዝ", or: "Amma qabadhu", fr: "Réserver" },
  check_in: { en: "Check-in", am: "የመግቢያ ቀን", or: "Guyyaa seenuu", fr: "Arrivée" },
  check_out: { en: "Check-out", am: "የመውጫ ቀን", or: "Guyyaa ba'uu", fr: "Départ" },
  total: { en: "Total", am: "ጠቅላላ", or: "Waliigala", fr: "Total" },
  add_tip: { en: "Add tip", am: "ጉርሻ ጨምር", or: "Badhaasa dabali", fr: "Ajouter un pourboire" },
  service_bill: { en: "Service bill", am: "የአገልግሎት ክፍያ", or: "Kaffaltii tajaajilaa", fr: "Facture de service" },
  rate_staff: { en: "Rate staff", am: "ሰራተኛን ደረጃ ስጥ", or: "Hojjetaa madaali", fr: "Noter le personnel" },
  rate_hotel: { en: "Rate hotel", am: "ሆቴሉን ደረጃ ስጥ", or: "Hoteela madaali", fr: "Noter l'hôtel" },
  my_bookings: { en: "My bookings", am: "የእኔ ቦታ ማስያዝ", or: "Qabiyyee koo", fr: "Mes réservations" },
  apply: { en: "Apply", am: "አመልክት", or: "Iyyadhu", fr: "Postuler" },
  post_job: { en: "Post a job", am: "ስራ አስተዋውቅ", or: "Hojii maxxansi", fr: "Publier une offre" },
  revenue: { en: "Revenue", am: "ገቢ", or: "Galii", fr: "Revenus" },
  language: { en: "Language", am: "ቋንቋ", or: "Afaan", fr: "Langue" },
  search_hotel: {
    en: "Search hotel or restaurant",
    am: "ሆቴል ወይም ሬስቶራንት ፈልግ",
    or: "Hoteela yookaan mana nyaataa barbaadi",
    fr: "Rechercher un hôtel ou restaurant",
  },
  staff_name: {
    en: "Staff / waiter name",
    am: "የሰራተኛ / የአስተናጋጅ ስም",
    or: "Maqaa hojjetaa / waaytarii",
    fr: "Nom du serveur",
  },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };
const LangContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => k });

const isLang = (v: string | null): v is Lang => v === "en" || v === "am" || v === "or" || v === "fr";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("moybirr_lang");
    if (isLang(stored)) setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("moybirr_lang", l);
  };

  const t = (key: string) => dict[key]?.[lang] ?? key;

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

export function formatETB(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

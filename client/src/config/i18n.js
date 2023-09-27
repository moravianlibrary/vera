import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  cz: {
    translation: {
        home: "Domov",
        board: "Záznamy",
        login: "Přihlásit se",
        logout: "Odhlásit se",

        cancel: "Zrušit",
        username: "Uživatelské jméno",
        password: "Heslo",
        login_button: "Přihlásit",
        login_tooltip: "",

        rows_per_page: "Řádků na stránku",
        range_separator: "ze",

        insert_record_manually: "Vytvořit nový záznam ručně",
        insert_record_using_identifier: "Vytvořit nový záznam pomocou identifikátora",
        insert_record_tooltip: "",
        insert_record_apply: "Vytvořit",

        sysno: "Systémové číslo",
        volume_number: "Ročník",
        item_number: "Číslo periodika",
        category: "Kategorie",
        title: "Název",
        pages_count: "Počet stran",
        signature: "Signatura",
        issn: "ISSN",
        isbn: "ISBN",
        barcode: "Čárový kód",
        creator: "Vytvořil",
        created_at: "Vytvořeno",
        extractor: "Extrahoval",
        extracted_at: "Extrahováno"
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'cz',
  fallbackLng: 'cz',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;

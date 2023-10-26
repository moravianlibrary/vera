import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  cz: {
    translation: {
        home: "Domov",
        board: "Záznamy",
        access: "Správa oprávnění",
        login: "Přihlásit se",
        logout: "Odhlásit se",

        cancel: "Zrušit",
        clear: "Vyčistit",
        username: "Uživatelské jméno",
        password: "Heslo",
        login_button: "Přihlásit",
        login_tooltip: "",

        department: "Oddělení",
        role_name: "Role",

        rows_per_page: "Řádků na stránku",
        range_separator: "ze",

        insert_record_title: "Vytvořit nový záznam",
        insert_record_tooltip: "",
        insert_records_from_file: "Vytvořit nové záznamy ze subora",
        select_category_title: "Vyber kategorii",
        record_title: "Záznam",
        insert_record_apply: "Vytvořit",
        fill_insert_title: "Předvyplnit pomocí identifikátora",
        fill_insert_record: "Předvyplnit",
        identifier: "Identifikátor",
        identifier_value: "Identifikátor",
        update_record_apply: "Aktualizovat",
        delete_record_apply: "Vymazat",

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

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  cz: {
    translation: {
        home: "Domov",
        board: "Záznamy",
        categories: "Kategorie",
        access: "Správa oprávnění",
        login: "Přihlásit se",
        logout: "Odhlásit se",

        cancel: "Zrušit",
        clear: "Vyčistit",
        username: "Uživatelské jméno",
        password: "Heslo",
        repeat_password: "Potvrďte heslo",
        login_button: "Přihlásit",
        login_tooltip: "",

        register_action: "Vytvořit nový účet",
        register_button: "Registrovat",
        username_missing: "Vyplňte uživatelské jméno",
        password_invalid_length: "Nesprávná délka hesla (8 - 64 znaků)",
        passwords_does_not_match: "Hesla se neshodují",

        department: "Oddělení",
        role_name: "Role",
        category_name: "Název kategorie",

        rows_per_page: "Řádků na stránku",
        range_separator: "ze",

        insert_record_title: "Vytvořit nový záznam",
        insert_record_tooltip: "",
        insert_records_from_file: "Vytvořit nové záznamy ze subora",
        select_category_title: "Vyberte kategorii",
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
        extracted_at: "Extrahováno",

        users: "Uživatelé",
        departments: "Oddělení",
        roles: "Role",
        department_abbreviation: "Zkratka oddělení",
        department_name: "Název oddělení",
        actions: "Akce",

        read_datatable_none: "zakázano čtení",
        read_datatable_own: "povoleno čtení vlastních záznamů",
        read_datatable_department: "povoleno čtení záznamů oddělení",
        read_datatable_all: "povoleno čtení všech záznamů",
        edit_datatable_none: "zakázaná editace",
        edit_datatable_own: "povolená editace vlastních záznamů",
        edit_datatable_department: "povolená editace záznamů oddělení",
        edit_datatable_all: "povolená editace všech záznamů",
        write_datatable: "povolen zápis",
        comment_on_datatable: "povoleno komentovaní",
        edit_access: "povolena správa oprávnění",
        edit_categories: "povolena správa kategorii",
        extract: "povolena extrakce",

        insufficient_rights_title: "Nedostatečné prava",
        insufficient_rights_body: "K provedení dané akce nemate dostačující prava",
        successful_login_title: "Úspěšné přihlášení",
        successful_login_body: "Byli jste úspěšne přihlášení",
        successful_registration_title: "",
        successful_registration_body: "",
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

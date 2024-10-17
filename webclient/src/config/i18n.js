import i18n from "i18next";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

const resources = {
    cs: {
        translation: {
            department: "Oddělení",
            role_name: "Role",

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
            "Document already exists": "Dokument již přidán",

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
            insufficient_rights_body:
                "K provedení dané akce nemate dostačující prava",
            successful_login_title: "Úspěšné přihlášení",
            successful_login_body: "Byli jste úspěšne přihlášení",
            successful_registration_title: "",
            successful_registration_body: "",

            all_categories: "Všechny kategorie",

            show_all_categories: "Zobraz všechny",

            name: "Název",
            description: "Popis",

            select_quota: "Výběr zaměru",
            active_quota: "Aktivní zaměr",
            set_active_quota: "Nastavit jako aktívni zaměr",

            document_successfuly_created: "Dokument úspěšně přidán",
            unique_document_violation: "Duplicitní dokument",
            invalid_sysno: "Nevalidní systémové číslo",
            document_not_found_in_catalog: "Dokument nenalezen v katalogu",

            "Token validation failed": "Validace tokenu selhala",
            "User does not have an assigned role":
                "Uživatel nemá přiřazenu žádnou roli",
            "User have more than one assigned role":
                "Uživatel má přiřazené více než jednu roli",
            "User have more than one assigned department":
                "Uživatel má přiřazen více než jedno oddělení",
            app_not_available: "Aplikace není dostupna",

            invalid_percentage_distribution: "Neplatné procentuální rozdělení",
            unique_category_name_violation:
                "Porušení jedinečného názvu kategorie",
            unique_category_name_violation_detail:
                "Sourozenecké kategorie by měly mít jedinečné názvy",
            "Category deletion failed": "Smazání kategorie se nezdařilo",
            "Only empty categories can be deleted":
                "Smazat lze pouze prázdné kategorie, s prideleným rozdelením 0%",

            "The quota name must be filled": "Název záměru musí být vyplněn",
            "The quota pages count must be filled":
                "Počet stránek záměru musí být vyplněn",
            "Quota deletion failed": "Smazání záměru se nezdařilo",
            "An active quota cannot be deleted": "Aktivní zaměr nelze smazat",
            "The quota must have a unique name":
                "Zaměr musí mít jedinečný název",
            "Quota creation failed": "Vytvoření zaměru se nezdařilo",
            "Quota update failed": "Aktualizace záměru se nezdařila",
            "The quota has not changed": "Zaměr se nezměnil",
            "The quota was created successfully": "Zaměr byl úspěšně vytvořen",
            "The quota was updated successfully":
                "Zaměr byl úspěšně aktualizovan",
            "The quota was deleted successfully": "Zaměr byl úspěšně smazán",
            "The quota is already active": "Zaměr je již aktivní",
            "The quota has been successfully set as active":
                "Zaměr byl úspěšně nastaven jako aktivní",

            "This setting is propagated downwards":
                "Toto nastavení se propaguje směrem dolů",

            "Apply filter": "Aktivuj filtr",
            "Save filter": "Uložit filtr",
            "Clear filter": "Vyčistit filtr",
            "Add rule": "Přidat pravidlo",
            "Add group": "Přidat skupinu",
            "Match all": "Splňuje všechny",
            "Match any": "Splňuje jakékoli",
            Volume: "Ročník",
            Category: "Kategorie",
            Title: "Název",
            "Choose a category": "Vyber kategorie",

            Role: "Role",
            Operations: "Operace",

            Own: "Vlastní",
            "Department's": "Oddělení",
            All: "Všechny",

            "Allowed to read documents": "Povoleno číst dokumenty",
            "Allowed to edit documents": "Povoleno upravovat dokumenty",
            "Document insertion allowed": "Povoleno vkládat dokumenty",
            "Document creation allowed": "Povoleno vytvářet dokumenty",
            "Commenting on documents allowed": "Povoleno komentovat dokumenty",
            "Planning tasks allowed": "Povoleno plánovat úkoly",
            "Administrating tasks allowed": "Povoleno spravovat úkoly",
            "Allowed to read categories": "Povoleno číst kategorie",
            "Allowed to edit categories": "Povoleno upravovat kategorie",
            "Extraction allowed": "Povoleno extrahovat",
            "Editing access settings allowed":
                "Povoleno upravovat přístupová nastavení",
            "Administrating database allowed": "Povoleno spravovat databázi",

            "Mark documents": "Označit dokumenty",
            "Unmark documents": "Zrušit označení dokumentů",
            "Select quota": "Vybrat zaměr",
            Generate: "Generovat",

            Book: "Monografie",
            ContinuingResource: "Periodikum",
            Map: "Mapa",
            Music: "Hudba",
            Other: "Ostatní",

            "Copied to clipboard": "Zkopírováno do schránky",

            ValueError: "Neplatná hodnota",
            UnknownError: "Neznámá chyba",
            Any: "Jakýkoli",

            "Document is missing a volume year":
                "Dokument neobsahuje rok vydáni",
            "Document is missing a publisher": "Dokument neobsahuje vydávatele",
            "Document is missing a publishing places":
                "Dokument neobsahuje město vydáni",
            "Document is missing language information":
                "Dokument neobsahuje informace o jazyků",

            "Export to file": "Exportovat do souboru",
            "Export to XSLX": "Exportovat do XSLX",
            "Change category": "Změnit kategorii",
            "Predict volumes page counts": "Predikovat počet stránek ročníků",
            "Sync from catalog": "Synchronizovat z katalogu",
            SyncFromCatalog: "Synchronizace z katalogu",
            "Sync from digitization registry":
                "Synchronizovat z registru digitalizace",
            SyncDocumentsWithDigitizationRegistry:
                "Synchronizace z registru digitalizace",

            "pages by intention": "stran pro záměr",
            "Extracted pages count": "Počet extrahováných stránek",
            Fulfilled: "Splněno",
            Unfulfilled: "Nesplněno",
            "You can move to the next category using the Enter key":
                "S použitím klávesy Enter můzete přejít na další kategorii",
            "All categories": "Všechny kategorie",
            "Documents are still included in the categories":
                "Dokumenty jsou stále zařazeny do kategorií",
            "Documents are no longer included in the categories":
                "Dokumenty již nejsou zařazeny do kategorií",
            "Show extraction": "Zobrazit extrakci",

            "Download CSV": "Stáhnout CSV",

            "Documents without pages count": "Dokumenty bez počtu stránek",
            "Set pages count manually": "Nastavit počet stránek ručně",
            "Pages count updated": "Počet stránek aktualizovan",
            "Pages count update failed":
                "Aktualizace počtu stránek se nezdařila",
            "Set pages count": "Nastavit počet stránek",
            "Set pages count and go to next document":
                "Nastavit počet stránek a přejít na další dokument",

            "Generate extractions": "Generovani extrakcí",
            "Create digitization list": "Vytvořit seznam digitalizace",
            "Digitization list creation failed":
                "Vytvoření seznamu digitalizace se nezdařilo",
            "Documents without CNB cannot be extracted":
                "Dokumenty bez CNB nelze extrahovat",
            "Documents without pages count cannot be extracted":
                "Dokumenty bez počtu stránek nelze extrahovat",

            "Start task": "Spustit úkol",
            "Documents actions": "Akce nad dokumenty",

            "Are you sure you want to predict periodical volume pages for {{count}} selected documents?":
                "Opravdu chcete predikovat počet stránek ročníků periodík pro {{count}} vybraných dokumentů?",
            "Are you sure you want to sync {{count}} selected documents with digitization registry?":
                "Opravdu chcete synchronizovat {{count}} vybraných dokumentů s registrom digitalizace?",
            "Are you sure you want to sync {{count}} selected documents with catalog?":
                "Opravdu chcete synchronizovat {{count}} vybraných dokumentů s katalogem?",
            "Are you sure you want to process {{count}} selected documents?":
                "Opravdu chcete zpracovat {{count}} vybraných dokumentů?",
            "Are you sure you want to create digitization list from {{count}} selected documents?":
                "Opravdu chcete vytvořit seznam digitalizace z {{count}} vybraných dokumentů?",
            "Are you sure you want to add {{count}} selected documents to digitization list {{digitizationListId}}?":
                "Opravdu chcete pridat {{count}} vybraných dokumentů do seznamu digitalizace {{digitizationListId}}?",
            "Are you sure you want to remove {{count}} selected documents from digitization list {{digitizationListId}}?":
                "Opravdu chcete odstranit {{count}} vybraných dokumentů ze seznamu digitalizace {{digitizationListId}}?",
            "Digitization list created successfully":
                "Seznam digitalizace úspěšně vytvořen",
            "Task started successfully": "Ukol úspěšně spusten",

            "Please select a category": "Vyberte prosím kategorii",

            "Administrating extractions allowed": "Povoleno spravovat extrakce",
            pages: "stránek",

            "Some documents have already been extracted":
                "Nekteré dokumenty již byly extrahovány",
            "Remove documents from digitization list":
                "Odstranit dokumenty ze seznamu digitalizace",
            "Digitization list update failed":
                "Aktualizace seznamu digitalizace se nezdařila",
            "Digitization list updated successfully":
                "Seznam digitalizace úspěšně aktualizovan",
            "Some documents are not in this extraction":
                "Nekteré dokumenty nejsou v tomto seznamu",
            "Add documents to digitization list":
                "Přidat dokumenty do seznamu digitalizace",

            "Filter by category": "Filtrovat podle kategorie",
            "Filter by digitization list":
                "Filtrovat podle seznamu digitalizace",
            "Filter by generated extraction":
                "Filtrovat podle generovane extrakce",
            "Select field": "Vyber pole",

            "File type not supported": "Týp souboru neni podporován",
            Confirm: "Potvrz",
            "Selected cells": "Vybrané buňky",
            "Select all documents that match the specified search criteria":
                "Vybrat všechny dokumenty podle zadaných kritérií vyhledávání",
            "Cell selection is possible by clicking on individual cells or by dragging across multiple cells":
                "Výběr buněk je možný kliknutím na jednotlivé buňky nebo tažením přes více buněk",

            "Create location": "Vytvořit lokaci",
            "Special characters": "Speciální znaky",
            "Any digit": "Libovolná číslice",
            "Any letter": "Libovolné písmeno",
            "Any letter or digit": "Libovolná číslice nebo písmeno",
            "The library was created successfully":
                "Knihovna byla úspěšně vytvořena",
            "Library creation failed": "Knihovnu se nepodařilo vytvořit",
            "The storage was created successfully":
                "Uložení bylo úspěšně vytvořeno",
            "Storage creation failed": "Uložení se nepodařilo vytvořit",
            "The location was created successfully":
                "Lokace byla úspěšně vytvořena",
            "Location creation failed": "Lokaci se nepodařilo vytvořit",
            "The library was updated successfully":
                "Knihovna byla úspěšně aktualizovana",
            "Library update failed": "Knihovnu se nepodařilo aktualizovat",
            "The storage was updated successfully":
                "Uložení bylo úspěšně aktualizovano",
            "Storage update failed": "Uložení se nepodařilo aktualizovat",
            "The location was updated successfully":
                "Lokace byla úspěšně aktualizovana",
            "Location update failed": "Lokaci se nepodařilo aktualizovat",
            "The library was deleted successfully":
                "Knihovna byla úspěšně smazána",
            "Library deletion failed": "Knihovnu se nepodařilo smazat",
            "The storage was deleted successfully":
                "Uložení bylo úspěšně smazáno",
            "Storage deletion failed": "Uložení se nepodařilo smazat",
            "The location was deleted successfully":
                "Lokace byla úspěšně smazána",
            "Location deletion failed": "Lokaci se nepodařilo smazat",
            "Manage libraries": "Správa knihoven",
            "Manage storages": "Správa uložení",
            "Select library": "Vybrat knihovnu",
            "Select storage": "Vybrat uložení",
            "Library name": "Jméno knihovny",
            "Storage name": "Jméno uložení",
            "The library cannot be deleted because it contains storages":
                "Knihovnu nelze smazat, protože obsahuje uložení",
            "The storage cannot be deleted because it contains locations":
                "Uložení nelze smazat, protože obsahuje lokaci",

            "Include only documents from these categories":
                "Zahrnout pouze dokumenty z těchto kategorií",
            "Include only documents from these locations":
                "Zahrnout pouze dokumenty z těchto lokací",
            "Select location": "Vybrat lokaci",

            "Select operation": "Vybrat operaci",
            "Insert table data here": "Zde vložte tabulkové data",
            "Insert using table data form":
                "Vložit pomocí tabulkového formuláře",
            "Table data form": "Formulář tabulkových dat",
            Required: "Vyžadované",
            Create: "Vytvořit",
            "Assign column labels": "Přiradit označení sloupců",
            "Duplicate column": "Duplikovat sloupec",
            "Delete column": "Smazat sloupec",
            "Assign label": "Přiradit označení",
            "Ignore row": "Ignorovat řádek",

            "Change distribution for category":
                "Změnit distribuci pro kategorií",

            "Document updated successfully":
                "Dokument byl úspěšně aktualizován",
            "Document update failed": "Aktualizace dokumentu se nezdařila",

            "Categories table": "Tabulka kategorií",
            "Categories chart": "Diagram kategorií",

            "Add intention": "Přidat zámer",

            "Intention name must not be empty":
                "Jméno zámeru neměže být prázdne",
            "Intention target page count must be positive":
                "Cílový počet stránek musí být kladný",
            "Intention date range must start today or later":
                "Časové období zámeru musí začínat dnes nebo později",
            "Current intention start date must not be changed":
                "Začáteční datum aktuálního záměru nelze změnit",
            "Intention name must be unique": "Jméno zámeru musí být jedinečný",
            "Intention date range must not overlap":
                "Časové období zámeřů se nesmí překrývat",
            "The intention was successfully created":
                "Zámer byl úspěšně vytvořen",
            "The intention was successfully updated":
                "Zámer byl úspěšně aktualizován",
            "The intention was deleted successfully":
                "Zámer byl úspěšně smazan",
            "Intention creation failed": "Vytvoření zámeru se nezdařilo",
            "Intention update failed": "Aktualizace zámeru se nezdařila",
            "Intention deletion failed": "Odstraneni zámeru se nezdařilo",

            "Digitization forbidden": "Nelze digitalizovat",

            "Is extractable": "Může být extrahovaný",

            "documents.table.no-category": "Bez kategorie",

            Choose: "Vybrat",
            Upload: "Nahrát",
            Filename: "Název souboru",
            Value: "Hodnota",
            Identifier: "Identifikátor",
            "Previous step": "Zpět",
            "Next step": "Další",
            "Previous document": "Předchozý dokument",
            "Next document": "Nasledující dokument",
            "Choose issues": "Výběr vydání",
            Result: "Výsledek",
            Details: "Detaily",
        },
    },
};

i18n.use(HttpBackend)
    .use(initReactI18next)
    .init({
        // resources,
        lng: "cs",
        fallbackLng: "cs",
        ns: [
            "app",
            "navigation",
            "types",
            "documents",
            "elasticsearch",
            "notifications",
            "tasks",
            "types",
            "catalog-records",
            "intentions",
            "extractions",
            "digitization-lists",
            "locations",
        ],
        defaultNS: "navigation",

        backend: {
            loadPath: "/locales/{{lng}}/{{ns}}.json",
        },
        interpolation: {
            escapeValue: false,
        },
        simplifyPluralSuffix: false,
        debug: true,
    });

export default i18n;

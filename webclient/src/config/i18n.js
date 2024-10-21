import i18n from "i18next";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

const resources = {
    cs: {
        translation: {
            insufficient_rights_title: "Nedostatečné prava",
            insufficient_rights_body:
                "K provedení dané akce nemate dostačující prava",
            successful_login_body: "Byli jste úspěšne přihlášení",

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

            unique_category_name_violation:
                "Porušení jedinečného názvu kategorie",
            unique_category_name_violation_detail:
                "Sourozenecké kategorie by měly mít jedinečné názvy",
            "Only empty categories can be deleted":
                "Smazat lze pouze prázdné kategorie, s prideleným rozdelením 0%",

            "This setting is propagated downwards":
                "Toto nastavení se propaguje směrem dolů",

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

            "pages by intention": "stran pro záměr",
            "Extracted pages count": "Počet extrahováných stránek",
            "You can move to the next category using the Enter key":
                "S použitím klávesy Enter můzete přejít na další kategorii",
            "All categories": "Všechny kategorie",
            "Documents are still included in the categories":
                "Dokumenty jsou stále zařazeny do kategorií",
            "Documents are no longer included in the categories":
                "Dokumenty již nejsou zařazeny do kategorií",
            "Show extraction": "Zobrazit extrakci",

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
            "Select all documents that match the specified search criteria":
                "Vybrat všechny dokumenty podle zadaných kritérií vyhledávání",

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
            "The library cannot be deleted because it contains storages":
                "Knihovnu nelze smazat, protože obsahuje uložení",
            "The storage cannot be deleted because it contains locations":
                "Uložení nelze smazat, protože obsahuje lokaci",

            "Change distribution for category":
                "Změnit distribuci pro kategorií",

            "Document updated successfully":
                "Dokument byl úspěšně aktualizován",
            "Document update failed": "Aktualizace dokumentu se nezdařila",

            "Categories table": "Tabulka kategorií",
            "Categories chart": "Diagram kategorií",

            "Add intention": "Přidat zámer",

            "Is extractable": "Může být extrahovaný",
        },
    },
};

i18n.use(HttpBackend)
    .use(initReactI18next)
    .init({
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
            "roles",
            "departments",
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

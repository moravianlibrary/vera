import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
    cz: {
        translation: {
            home: "Domov",
            board: "Dokumenty",
            categories: "Kategorie",
            access: "Správa oprávnění",
            login: "Přihlásit se",
            logout: "Odhlásit se",

            cancel: "Zrušit",
            clear: "Vyčistit",
            username: "Uživatelské jméno",
            login_button: "Přihlásit",

            department: "Oddělení",
            role_name: "Role",
            category_name: "Název kategorie",

            rows_per_page: "Řádků na stránku",
            range_separator: "ze",

            insert_record_title: "Vytvořit nový záznam",
            insert_document: "Přidat dokument",
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
            "Document already exists": "Dokument již přidán",

            sysno: "Systémové číslo",
            volume_number: "Ročník",
            volume: "Ročník",
            item_number: "Číslo periodika",
            category: "Kategorie",
            title: "Název",
            pages_count: "Počet stran",
            signature: "Signatura",
            Signature: "Signatura",
            issn: "ISSN",
            isbn: "ISBN",
            barcode: "Čárový kód",
            Barcode: "Čárový kód",
            creator: "Vytvořil",
            created_at: "Vytvořeno",
            extractor: "Extrahoval",
            extracted_at: "Extrahováno",
            year_issued: "Rok vydání",

            Name: "Název",
            "Pages count": "Počet stran",

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
            category_count_pages: "stran v kategorii",
            category_missing_count_pages: "stran chybí k naplnění",
            category_count_documents_with_pages: "dokumnetů se stranami",
            category_count_documents: "dokumentů v kategorii",

            show_all_categories: "Zobraz všechny",
            insert_mode: "Vkládací mód",
            assignable_category: "Přiřaditelná kategorie",
            use_category_departments: "Umožniť používat pouze oddělením",
            select_departments: "Vyber oddělení",

            name: "Název",
            description: "Popis",

            select_quota: "Výběr zaměru",
            active_quota: "Aktivní zaměr",
            set_active_quota: "Nastavit jako aktívni zaměr",

            next_step: "Dále",
            prev_step: "Zpět",
            insert_settings: "Nastavení vkládání",
            choose_identifier: "Vyber identifikátor",
            choose_category: "Vyber kategorii",
            insert_values: "Výběr hodnot",
            choose_issues: "Výběr vydání",
            insert_result: "Výsledek",
            insert_another: "Vložit další",
            finish: "Skončit",
            details: "Detaily",
            count: "Počet",
            Count: "Počet",

            "Document is already digitized": "Dokument již digitalizován",
            "Document already digitized": "Dokument již digitalizován",
            "Error while parsing catalog response":
                "Chyba při zpracování odpovědi katalogu",
            "Error while connecting to catalog":
                "Chyba při připojování katalogu",
            "Document digitization in progress":
                "Digitalizace dokumentu probíhá",
            "Document digitization planned":
                "Digitalizace dokumentu naplánována",
            "Document is in revision": "Dokument se revizuje",
            "Document not found in catalog": "Dokument nenalezen v katalogu",
            "Invalid catalog document": "Neplatný dokument v katalogu",
            "Invalid document identifier": "Neplatný identifikátor dokumentu",
            "Invalid system number": "Neplatné systémové číslo",
            "Invalid system number base": "Neplatná základna systémového čísla",
            "Document successfuly created": "Dokument byl úspěšně přidán",
            "Unique document violation": "Porušení jedinečnosti dokumentu",

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

            tasks: "Úkoly",
            id: "Id",
            task_type: "Název úkolu",
            owner: "Vlastník",
            task_state: "Stav",
            documents_count: "Počet dokumentů",
            planned: "Naplánováno",
            started: "Spuštěno",
            finished: "Ukončeno",
            duration: "Trvání",

            Planned: "Naplánováno",
            Running: "Běží",
            Finished: "Dokončeno",
            Failed: "Chyba",
            Killed: "Zrušeno",

            PredictVolumePages: "Predikce počtu stran ročníků",

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
            "System number": "Systémove číslo",
            Volume: "Ročník",
            Category: "Kategorie",
            Title: "Název",
            "Choose a category": "Vyber kategorie",

            Role: "Role",
            Actions: "Akce",
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

            Extractions: "Extrakce",
            Extractor: "Extrahoval",
            "Extracted at": "Extrahováno",
            "Target pages count": "Cílový počet stránek",
            "Documents count": "Počet dokumentů",
            "Show in categories": "Zobrazit v kategoriích",
            "Show in documents": "Zobrazit v dokumentech",
            "Mark documents": "Označit dokumenty",
            "Unmark documents": "Zrušit označení dokumentů",
            "Generate extraction": "Generovat extrakci",
            "Target pages threshold": "Cílový počet stránek s rozptylem",
            "Whole categories threshold": "Celé kategorie s rozptylem",
            "Include categories": "Zahrnout kategorie",
            Quota: "Zaměr",
            "Select categories": "Vybrat kategorie",
            "Select quota": "Vybrat zaměr",
            Generate: "Generovat",
            " extracted pages": " extrahováno stránek",
            " extracted documents": " extrahováno dokumentů",

            "Error count": "Počet chyb",

            "Material type": "Typ materialu",
            Year: "Rok",
            Unit: "Vydáni",
            Bundle: "Svazek čísel",
            "Issuance type": "Typ vydáni",
            CNB: "ČNB",
            "Digitization state": "Stav digitalizace",
            "Pages count predicted": "Predikovaný počet stran",
            Size: "Velikost",
            Publisher: "Vydávatel",
            "Publishing place": "Misto vydáni",
            "Publishing year": "Rok vydáni",
            Languages: "Jazyky",
            Frequencies: "Frekvence",
            Creator: "Vytvořil",
            "Creator department": "Oddělení",
            "Created at": "Vytvořeno",
            "Extraction id": "Id extrakce",
            Type: "Typ",
            Description: "Popis",

            Book: "Monografie",
            ContinuingResource: "Periodikum",
            Map: "Mapa",
            Music: "Hudba",
            Other: "Ostatní",

            InProgress: "Probiha",
            NotDigitized: "Nedigitalizováno",

            Cancel: "Zrušit",
            Delete: "Smazat",
            "Delete document": "Smazání dokumentu",
            "Delete documents": "Smazání dokumentů",
            "Are you sure you want to delete this document?":
                "Opravdu chcete smazat tento dokument?",
            "Are you sure you want to delete all selected documents?":
                "Opravdu chcete smazat všechny vybrané dokumenty?",
            "Number of selected documents": "Počet vybraných dokumentů",

            "Copied to clipboard": "Zkopírováno do schránky",

            "Document id": "Id dokumentu",
            Processed: "Zpracováno",
            "Error type": "Typ chyby",
            "Error message": "Zpráva o chybe",
            ValueError: "Neplatná hodnota",
            UnknownError: "Neznámá chyba",
            "Finished with errors": "Ukončeno s chybami",
            Any: "Jakýkoli",
            "Without error": "Bez chyby",

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
            SyncFromDigitizationRegistry:
                "Synchronizace z registru digitalizace",

            "documents without CNB": "dokumentů bez ČNB",
            "Number of found documents": "Počet nalezených dokumentů",
            "Active filtering": "Aktivní filtr",
            "Cancel filtering": "Zrušit filtr",
            "Cancel document selection": "Zrušit výběr dokumentu",
            "Delete selected documents": "Smazat vybrané dokumenty",
            "Other options": "Ostatní možnosti",

            "Edit distribution": "Upravit rozdelení",
            "Category options": "Možnosti kategorie",
            "Edit category": "Upravit kategorii",
            "Delete category": "Smazat kategorii",
            "Add child category": "Přidat podkategorii",

            "Insert another upon successful insertion":
                "Vkládat další po úspěšném vložení",
            "Using value": "Hodnotou",
            "Using files": "Ze souborů",
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

            "from overall percentage": "z celkových procent",
            "pages by intention": "stran pro záměr",
            "Extracted pages count": "Počet extrahováných stránek",
            Fulfilled: "Splněno",
            Unfulfilled: "Nesplněno",
            "You can move to the next category using the Enter key":
                "S použitím klávesy Enter můzete přejít na další kategorii",
            "All categories": "Všechny kategorie",
            "Categories of level": "Kategorie úrovně",
            "Assignable categories": "Přiřaditelné kategorie",
            "Selected category": "Vybrana kategorie",
            "Documents are still included in the categories":
                "Dokumenty jsou stále zařazeny do kategorií",
            "Documents are no longer included in the categories":
                "Dokumenty již nejsou zařazeny do kategorií",
            "Show extraction": "Zobrazit extrakci",
            "extractable pages": "extrahovatelných stránek",
            "extractable documents": "extrahovatelných dokumentů",

            "Download CSV": "Stáhnout CSV",

            "Documents without pages count": "Dokumenty bez počtu stránek",
            "Set pages count manually": "Nastavit počet stránek ručně",
            "Pages count updated": "Počet stránek aktualizovan",
            "Pages count update failed":
                "Aktualizace počtu stránek se nezdařila",
            "Pages count - from catalog": "Počet stránek - z katalogu",
            "Pages count - predicted": "Počet stránek - predikovaný",
            "Pages count - set manually": "Počet stránek - ručně zadán",
            "Set pages count": "Nastavit počet stránek",
            "Set pages count and go to next document":
                "Nastavit počet stránek a přejít na další dokument",
            "from catalog": "z katalogu",
            predicted: "predikovaný",
            "set manually": "ručně zadán",

            "Digitization lists": "Seznamy digitalizace",
            "Generate extractions": "Generovani extrakcí",
            "Created by": "Vytvořil",
            Intention: "Zaměr",
            "Generated by": "Vygeneroval",
            "Generated at": "Vygenerováno",
            "Selected pages count": "Vybrán počet stránek",
            "Create digitization list": "Vytvořit seznam digitalizace",
            "Digitization list creation failed":
                "Vytvoření seznamu digitalizace se nezdařilo",
            "Documents without CNB cannot be extracted":
                "Dokumenty bez CNB nelze extrahovat",
            "Documents without pages count cannot be extracted":
                "Dokumenty bez počtu stránek nelze extrahovat",

            "Start task": "Spustit úkol",
            "Documents actions": "Akce nad dokumenty",

            "Confirm action": "Potvrzení akce",
            Yes: "Ano",
            No: "Ne",
            'Are you sure you want to change category to "{{category}}" for {{count}} selected documents?':
                'Opravdu chcete změnit kategorii na "{{category}}" pro {{count}} vybraných dokumentů?',
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
            "Category changed successfully": "Kategorie byla úspěšně změnena",

            Search: "Vyhledávaní",

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

            "Items per page": "Záznamů na stranu",

            "Filter by category": "Filtrovat podle kategorie",
            "Filter by digitization list":
                "Filtrovat podle seznamu digitalizace",
            "Filter by generated extraction":
                "Filtrovat podle generovane extrakce",
            "Select field": "Vyber pole",

            Equals: "Je rovno",
            StartsWith: "Začína na",
            EndsWith: "Končí na",
            Contains: "Obsahuje",
            NotContains: "Neobsahuje",
            NotEquals: "Není rovno",
            IsNull: "Není nastaveno",
            IsNotNull: "Je nastaveno",
            EqualTo: "Rovná se",
            NotEqualTo: "Nerovná se",
            LessThan: "Meně než",
            MoreThan: "Více než",
            Between: "Mezi",
            IsIn: "Je v",
            IsNotIn: "Není v",
            Is: "Je",
            IsNot: "Není",
            Match: "Odpovídá",
            NotMatch: "Neodpovídá",
            "Add rules group": "Přidat skupinu pravidel",

            "Catalog's pages count": "Počet stránek z katalogu",
            "Manual pages count": "Počet stránek ručně zadán",
            "Predicted pages count": "Počet stránek predikovaný",
            documents: "dokumentů",

            "File type not supported": "Týp souboru neni podporován",
            Confirm: "Potvrz",
            "Selected cells": "Vybrané buňky",
            "Select all documents that match the specified search criteria":
                "Vybrat všechny dokumenty podle zadaných kritérií vyhledávání",
            "Cell selection is possible by clicking on individual cells or by dragging across multiple cells":
                "Výběr buněk je možný kliknutím na jednotlivé buňky nebo tažením přes více buněk",

            Save: "Uložit",
            Edit: "Upravit",

            "Storage locations": "Skladové lokace",
            Library: "Knihovna",
            Storage: "Uložení",
            Location: "Lokace",
            "Location name": "Jméno lokace",
            "Location prefix": "Prefix lokace",
            "Location state": "Stav lokace",
            "Location active": "Doplňuje se",
            "Location closed": "Uzavřeno",
            "Location description": "Popis lokace",
            "Additional information": "Dodatečné informace",
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

            "Category name": "Jméno kategorie",
            Percentage: "Podíl",
            "Overall percentage": "Celkový podíl",
            "Extractable count": "Extrahovatelní počet",
            "Overall count": "Celkový počet",
            "Missing pages to fulfill intention":
                "Chýba stran k naplňení zámeru",
            "Documents without CNB": "Dokumentů bez ČNB",
            Table: "Tabulka",
            Chart: "Diagram",
            Categories: "Kategorie",
            Intentions: "Zámery",
            "pages in": "stránek v",

            Documents: "Dokumenty",
            Tasks: "Ukoly",
            "Access management": "Správa prístupů",
            "Change distribution for category":
                "Změnit distribuci pro kategorií",

            "Document updated successfully":
                "Dokument byl úspěšně aktualizován",
            "Document update failed": "Aktualizace dokumentu se nezdařila",

            "Categories table": "Tabulka kategorií",
            "Categories chart": "Diagram kategorií",

            "Categories display options": "Výběr zobrazení kategorií",
            "Intentions display options": "Výběr zobrazení zámerů",
            "Departments display options": "Výběr zobrazení oddělení",
            "Without intention": "Bez zámerů",
            "Selected intention": "Vybraný zámer",
            "Show only intention categories": "Zobrazit pouze kategorie zámerů",
            "Show all categories": "Zobrazit všechny kategorie",
            "Selected department": "Vybraný oddělení",
            "Select intention": "Vybrat zámer",
            "Select department": "Vybrat oddělení",

            "Add intention": "Přidat zámer",
            "Target page count": "Cílový počet stránek",
            "Date range": "Časové období",
            Classification: "Klasifikace",
            Previous: "Předchozí",
            Current: "Aktuální",
            Upcoming: "Nadcházející",
            "Intention name": "Jméno zámeru",
            Submit: "Potvrdit",

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
            Yes: "Ano",
            No: "Ne",

            "Catalog records": "Katalogové záznamy",

            "digitizationState.Finished": "Dokončeno",
            "digitizationState.InProgress": "Probiha",
            "digitizationState.Planned": "Naplánováno",
            "digitizationState.NotDigitized": "Nedigitalizováno",

            "documents.table.extraction": "Extrakce",
            "document.extractable.isExtractable": "Může být extrahovaný",
            "document.extractable.extracted": "Již extrahovaný",
            "document.extractable.missingCnb": "Chybí ČNB",
            "document.extractable.missingPages": "Chybí počet stran",
            "document.extractable.notExtractable": "Nemůže být extrahovaný",

            "documents.datatable-visual": "Tabulka - příznaky",
            "documents.datatable-data": "Tabulka - data",
            "documents.chart": "Graf",

            "document-type": {
                periodical: "Periodikum",
                "periodical-volume": "Ročník periodika",
                "periodical-bundle": "Svazek čísel periodika",
                volume: "Ročník",
                bundle: "Svazek čísel",
                monograph: "Monografie",
                "monograph-unit": "Jednotka monografie",
                unit: "Jednotka",
                graphic: "Grafika",
                map: "Mapa",
                music: "Zvuk",
                other: "Ostatní",
                invalid: "Neplatná kombinace",
            },

            "document.record.diff-mzk-skc":
                "Zobrazit rozdíl mezi MZK a SKC katalogem",
            "document.record.diff-mzk-cnb":
                "Zobrazit rozdíl mezi MZK a ČNB katalogem",

            "catalog.record.mzk": "MZK katalog záznam",
            "catalog.record.cnb": "ČNB katalog záznam",
            "catalog.record.skc": "SKC katalog záznam",
            "catalog.record.value-differs": "<- rozdílna hodnota ->",
            "catalog.record.cnb-not-found": "Záznam v ČNB katalogu nenalezen",
            "catalog.record.skc-not-found": "Záznam v SKC katalogu nenalezen",

            "documents.table.no-category": "Bez kategorie",

            common: {
                yes: "Ano",
                no: "Ne",
            },

            es: {
                facet: {
                    "show-more": "Zobrazit víc",
                    "show-less": "Zobrazit mín",
                },
            },

            "catalog-records": {
                numFound: "Počet nalezených záznamů",
                "mzk-sysno": "MZK systémové číslo",
                "skc-sysno": "SKC systémové číslo",
                "cnb-sysno": "ČNB systémové číslo",
                cnb: "ČNB",
                language: "Jazyk",
                signature: "Signatura",
                isxn: "ISXN",
                barcodes: "Čárové kódy",
                "has-valid-main-record": "Záznam je validný",
                "has-valid-cnb": "ČNB je validné",
                "skc-validity": "Validita vůči SKC katalogu",
                "cnb-validity": "Validita ČNB",
                "added-at": "Vytvořeno",
                "updated-at": "Aktualizovano",
                "material-type": "Typ materialu",
                title: "Název",
                size: "Velikost",
                "location-uri": "Externí odkaz",
                publisher: "Vydávatel",
                "publishing-place": "Misto vydáni",
                "publishing-year": "Rok vydáni",
                languages: "Jazyky",
                frequencies: "Frekvence",
                "action-approve-difference": "Schválit rozdíl",
                "difference-approved": "Schválil",
                difference: {
                    Equal: "Shoda",
                    DifferentValue: "Rozdílna hodnota",
                    MissingField: "Chybí pole",
                    ExtraField: "Extra pole",
                },
                table: {
                    tags: {
                        "valid-main-record": "Záznam je validný",
                        "not-found-in-skc": "Záznam nenalezen v SKC katalogu",
                        "valid-cnb": "ČNB je validné",
                        "should-not-have-cnb": "Nemá mít ČNB",
                        "not-found-in-cnb": "Záznam nenalezen v ČNB katalogu",
                    },
                },
                facets: {
                    "has-valid-main-record": "Záznam je validný",
                    "has-valid-cnb": "ČNB je validné",
                    language: "Jazyk",
                    "material-type": "Typ materialu",
                    "skc-difference-type": "Typ rozdílu - SKC",
                    "skc-difference-tag": "Rozdílná pole - SKC",
                    "cnb-difference-type": "Typ rozdílu - ČNB",
                    "cnb-difference-tag": "Rozdílná pole - ČNB",
                },
                details: {
                    data: "Detailní informace",
                    "skc-difference": "Rozdíly mezi MZK a SKC katalogem",
                    "cnb-difference": "Rozdíly mezi MZK a ČNB katalogem",
                },
            },

            document: {
                "extraction-priority": {
                    5: "Najvyšší",
                    4: "Vysoká",
                    3: "Strední",
                    2: "Nizká",
                    1: "Najnižší",
                    "?": "Neznámá",
                },
            },
        },
    },
};

i18n.use(initReactI18next).init({
    resources,
    lng: "cz",
    fallbackLng: "cz",
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;

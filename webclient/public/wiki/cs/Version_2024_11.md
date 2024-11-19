# Verze 2024 - Listopad

Změny ve verzi:

- **Dokumenty**:
    - Dokumenty uložené v Elasticsearch indexu → rychlejší načítání.
    - Zjednodušení zobrazení dokumentů → primárně se zobrazují příznaky dokumentů.
    - Vyhledávání v dokumentech pomocí vyhledávacího výrazu s fuzzy logikou.
    - Vyhledávání dokumentů pomocí facet.
    - Podpora různých řazení dokumentů.
    - Podpora editace jednotlivých dokumentů - editace kategorie, priority extrakce, počet stran.
    - Nové akce nad označenými dokumenty: změnit prioritu, reindexovat dokumenty.
    - Změněná akce synchronizace s MZK katalogem → synchronizace s katalogy (MZK, SKC, CNB).
    - Logika přidávání dokumentů přesunuta na server.
    - Vylepšená správa výsledků přidávání dokumentů.

- **Katalogové záznamy**:
    - Nová záložka s katalogovými záznamy.
    - Katalogové záznamy se nyní ukládají v aplikaci. Jsou vždy k dispozici, méně se zatěžují katalogy a v případě potřeby se obnovují z katalogů.
    - Zobrazení podmíněno novým právem *Povoleno číst katalogové záznamy*.
    - Používá se k zobrazení a schvalování rozdílů mezi katalogovými záznamy (MZK x SKC a MZK x CNB).
    - Rozdíly jsou vyhodnocovány pro konkrétní dvojice záznamů (MZK x SKC, MZK x CNB) a konkrétní pole v těchto dvojicích.
    - Podpora podobného filtrování a facetingu jako u dokumentů.
    - Akce nad katalogovými záznamy: reindexace, přepočet rozdílů mezi katalogovými záznamy, synchronizace.
    - Jednotlivé rozdíly lze schvalovat, pokud má uživatel příslušné právo (*Povolena revize katalogových záznamů*).

- **Úkoly**:
    - Přidána možnost spouštění periodických úkolů.
    - Přidán úkol: vytvořit nové indexy.

- **Všeobecné**:
    - Sjednocené pohledy v klientovi.
    - Řada opravených chyb.

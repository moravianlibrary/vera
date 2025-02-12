# Rozvrh Prác

#### 1. Návrh

- [x] Zozbierať zoznam funkcionalít z issues, taigy a zápiskov. 
- [x] Vyvtoriť Use Case diagram.
- [ ] Konzultácia Use Case diagramu a prípadné úpravy.
- [ ] Vytvoriť Activity diagram pre jednotlivé use case-i.
- [ ] Vytvoriť Component diagram.
- [ ] Návrh štruktúry projektu, buildovacích možností a použítých technológií.
- [ ] Konzultácia a prípadné úpravy v nárvhu.
- [ ] Vytvoriť postup implementácie.

#### 2. Refactoring starej code base do novej štruktúry.

- [ ] Refactoring VERA app kódu.
- [ ] Pridanie code base Aleph Z39.50 clienta.
- [ ] Pridanie code base MARC comparator-a.
- [ ] Pridanie code base VERA AI tools.

#### 3. Nastavenie development prostredia a buildovanie

- [ ] Vytvoriť Bash build scripty pre jednotlivé možnosti build (VERA MZK, MARC Comparator, etc.).
- [ ] Vytvoriť mock-ery pre jednotlivé resource VERY (db, index, broker).
- [ ] Vytvoriť prostredie pre testovanie celej aplikácie pomocou scenárií (technológia Locust).
- [ ] Vytvoriť Makefile a ďalšie skratky pre zeefektívnenie vývoja.

#### 4. Implementácia VERA Aplikácie

- [ ] Vytvoriť JSON schemas pre jednotlivé entity aplikácie.
- [ ] V rámci JSON schemas vytvoriť taktiež Elasticsearch schemas pre entity, ktoré budú vyhľadávateľné cez index.
- [ ] Upraviť/Vytvoriť databázové modely podľa návrhu a JSON schemas. Napísať database migration scripts.
- [ ] Testy.

**TODO:** Doplniť po prvej etape.

#### 5. Scenario Testing

- [ ] Napísať scenarios tests pre celú aplikáciu, rozdelené do logických celkov.

#### 6. Implementácia VERA Klienta

- [ ] Refactorizácia s použitím PatternFly knižnice.
- [ ] Re-implementácia Elasticsearch vyhľadávania a filtrovania výsledkov.
- [ ] Implementácia novej funkcionality.
- [ ] Preklad state responses z aplikácie (e.g. 404 message, etc.).
- [ ] Testovanie - zapojiť aj kurátorov.

#### 7. Ďalšie

- [ ] Refactorizácia MARC Comparator klienta.
- [ ] Vytvoriť klienta pre RD Evaluator.

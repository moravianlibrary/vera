# DEC-0021: A record people name has a name in each language

> **Decided** on 2026-11-02.

**Context.** The interface speaks Czech or English
([UI-language](../reference/ui/navigation.md#ui-language)), Czech first in production. The
names of records are data, one string each, so what VERA ships (system watchlists, the
predefined properties and instances, the shipped roles) reads in English in a Czech interface,
and a name an administrator gives reads in one language to everybody.

**Decision.**
- **A name is held per language**, one per language the interface speaks (Czech and English),
  at least one ([UI-names](../reference/ui/navigation.md#ui-names)).
- **Named this way:** watchlists, properties and their enum values, plugin instances, roles,
  custodies, categories, mixes, schedules and repeats. Projects and lists keep one name.
- **An editor** offers the name in the language in use; *Add language* adds the other.
- **A record shows** its name in the viewer's language, or in the other one when it has none.
- **A search** matches any language; **uniqueness**, where a name must be unique, holds within
  each language.
- **What VERA ships** is named in both languages.

**Rejected.**
- *Shipped names as message keys*: an administrator renaming a shipped record would leave the
  key behind, and their own records could not be named in two languages.
- *One name, in Czech*: English-speaking staff would read Czech names everywhere.

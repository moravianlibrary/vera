# Production profile of the old VERA

Aggregates read on 2026-10-29 from the old system's database (`dk-vera/postgres-0`, read-only)
to parameterise the fake engine's probabilistic simulation. No usernames or record contents are
copied here; people are ranks. Times are Europe/Prague. Data covers 2024-02 → 2026-10.

## Volumes

| Thing | Count | Notes |
|---|---:|---|
| Documents (items proposed) | 17 134 | 14 183 distinct catalog records |
| Catalog records | 15 310 | 1 128 have no document |
| Barcodes per record | 1: 8 854 · 2: 3 483 · 3: 1 237 · 4+: ~1 400 | multi-volume works |
| Documents per record | 1: 13 321 · 2: 520 · 3: 120 · 4–11+: ~150 | long tail = periodical volumes |
| Categories | 31 | 6 roots, 23 children, 2 grandchildren; only 1 intention ever |
| Digitization lists | 141 | none created since 2025-09 |
| Users | 16 | 6 ever added more than 300 documents |
| Tasks (runs) | 4 862 | 9 types |

## Arrivals (proposals)

- **Monthly:** 215–1 900, typical 350–650. Spikes: 2024-10 (1 902), 2024-06, 2025-07, 2026-06.
  December dips (59 in 2025-12).
- **Weekday:** Mon 2 632 · **Tue 6 162** · Wed 3 103 · Thu 2 948 · Fri 2 002 · Sat 128 · Sun 138.
  Tuesday is a scanning day.
- **Hour:** starts 7:00, peaks 9–10 (3 186 at 9), lunch dip 11–13, second peak 14:00 (2 463),
  ends 16:00; a thin evening tail (≈ 2 %).
- **Active people per day:** 1 person on 285 days, 2 on 102, 3 on 10, 4 on 1 (398 active
  days). The workload is one or two dominant proposers at a time.
- **Per person per active day:** median 21, p90 66, p99 140, max 1 848 (bulk import).
- **Stream shape:** gap between consecutive adds by one person: p25 2.8 s, median 4 s, p75 9 s,
  p90 90 s. Per minute: median 3, p90 9, max 35. This is barcode-scanner cadence: bursts of
  scans, then pauses.
- **Proposer share (rank: documents, active span):** 1: 6 813 (2024-11 → now) · 2: 3 391 ·
  3: 2 570 · 4: 1 993 (2024-06 → 2024-11, handed over to rank 1) · 5: 1 968 · 6: 321 · the rest
  ≤ 21. Model staff turnover: a heavy proposer leaves and another takes over.

## Documents

- **State:** NotDigitized 14 239 (83 %) · Finished 2 597 (15 %) · InProgress 298 (2 %).
- **Issuance:** unset 11 423 · Unit 5 367 · Bundle 183 · Volume 161.
- **Priority (1–5):** 3 for 17 128; priority is effectively unused.
- **Pages:** p10 36 · median 154 · p90 374 · p99 799. Unit median 157, Volume 226,
  Bundle 271.
- **Page sources:** catalog 12 966 · predicted 813 · manual 1 011. Mean relative error against
  manual: **catalog 22 %, predictor 187 %** (172 documents have both). Treat the old
  predictor as noise.
- **Listed:** 3 292 documents on lists; 2 884 linked to the digitization registry.
- **Category volume:** Dary 4 713 · DNNTO 4 209 · Kontinuita 2 101 · Vázané 1 857 ·
  Rozšiřování sbírek 881 · CDArcha 879 · Požadavky čtenářů 854 · EODopen 330 · Kundera 213 ·
  others < 200. Three empty categories.
- **Language:** cze 94 % · eng 2 % · ger, fre, slo ≈ 1 % each.

## Lists

- 141 lists, 2024-05 → 2025-09; 24/month at the start, then decaying to zero.
- Size: docs p10 4 · median 15 · p90 44; pages p10 728 · median 2 671 · p90 6 574. 6 empty.
- Gap between lists: median 4 h, p90 10 days (made in clusters).

## Tasks

| Type | Runs | Failed | Median / p90 duration |
|---|---:|---:|---|
| ReindexDocuments | 4 056 | 54 | 0.1 s / 0.1 s (failures hang ~8 min) |
| ReindexCatalogRecords | 285 | 0 | < 0.1 s |
| SyncDocumentsWithCatalogs | 271 | 1 | 1.3 s / 2.4 s |
| SyncDocumentsWithDigitizationRegistry | 130 | 2 | 0.2 s / 2 s (failures 1.5–2.6 h) |
| PredictPeriodicalsPageCount | 58 | 6 | 7.5 s / 26 s |
| SyncCatalogRecordsWithCatalogs | 42 | 3 | 4 s / 85 s (failures 20 min – 2 h) |
| RecreateIndexes | 16 | 4 | 4.4 min / 5.4 min |
| ReevaluateCatalogRecordsDifferences | 3 | 0 | 4 min / 29 min |

- 100–400 runs/month; failures come in clusters (2025-02: 16, 2026-02: 15, 2025-11: 10).
- Runs are planned 8–16 h, peak 9–10 h; one nightly schedule (Saturday 01:00 registry sync).
- **Failure modes:** a failure is usually slow (a hang or timeout), not instant.
- **Item errors** (of ~65 k items): schema mismatch on indexing 282 · *missing volume year*
  235 · upstream 500 from knihovny.cz 12 · record not found in the catalog (few records,
  repeatedly) · unknown registry state 15.

## Catalog comparison (validation)

- Compared against SKC (≈ 15 100 records) and CNB (≈ 13 900).
- Differences (non-deleted): SKC DifferentValue 9 635 · MissingField 2 521 · ExtraField 2 427;
  CNB 467 / 466 / 38. About half were approved.
- Per compared record: median 2, p90 4, p99 6 differences; none are clean.
- Fields that differ most: **300** (extent) 5 761 · **260** 4 377 · **264** 2 156 · 008 839 ·
  020 828 · 250 798 · 015 748 · 362 47.

## Public requests (Tlačítko digitalizovat)

Read from the mini app's request table on 2026-10-29 (1 307 requests, 2023-01 → 2026-10).
VERA takes this over.

- **Growth:** ≈ 5–15 a month in 2023–24, 25–50 in 2025, **45–80 a month in 2026** (75 in
  2026-10).
- **Every day of the week:** Mon 169 · Tue 189 · Wed 273 · Thu 187 · Fri 188 · Sat 159 ·
  Sun 142. The public asks on weekends; staff do not work then.
- **Requesters:** 456 distinct; 390 asked once, 50 asked 2–10 times, and a few power users asked
  21–196 times. 95 % give a personal mailbox (gmail, seznam, email.cz, centrum), not a library
  account. 71 requests have no e-mail.
- **Bursts:** a power user files 20+ requests in one day (a reading list).
- **Outcome:** approved 76 % · declined 23 % · undecided 2 %. Digitized and linked 73 %.
  80 approved requests were done without being handed to scanning: a copy already existed.
- **Duplicates:** 52 titles asked for more than once.

## What the simulation should reproduce

1. Proposals arrive as scanner bursts (≈ 4 s apart, 3–35 a minute) from one or two active
   proposers, weekdays 7–16 h with a Tuesday peak and lunch dip, ≈ 20 a day each, with rare bulk
   imports of 500–1 800.
2. Staff turnover: a dominant proposer hands over to another over a few months.
3. 83 % never get digitized within the window; category mix as above.
4. Page counts log-normal around 150 (Volume and Bundle higher); catalog counts off by ~20 %.
5. Runs mostly succeed in seconds; failures are rarer, clustered, and slow.
6. Catalog sources fail transiently (HTTP 500) and some records are permanently not found.
7. Every compared record has 1–6 differences, mostly in 300/260/264.
8. Lists get made in clusters, then usage drops off. The frontend should show that decay
   honestly (empty states, stale lists).
9. Public requests arrive every day including weekends, ≈ 2 a day and growing, mostly one-off
   requesters with a few power users who file 20+ at once; about a quarter are declined and a
   few already have a copy.

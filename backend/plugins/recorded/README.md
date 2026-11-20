# Recorded answers

Real answers from MZK's public services, for the outward plugins' tests (batch B), which never
reach the network. Captured on 2026-11-20 by `capture.sh`.

- `records.psv`: 37 catalog records. 33 picked from the old VERA's documents (identifiers only)
  to cover periodicals with many volumes, volumes, bundles, monographs digitized and not, other
  languages, no catalog page count, registry-linked items, many barcodes and units without a
  year; 4 that Kramerius knows by their sysno (`kramerius-has-sysno`).
- `aleph/<sysno>.xml`: `GetRecord` from `https://aleph.mzk.cz/OAI`, `metadataPrefix=marc21`.
- `kramerius/<sysno>.sysno.json`, `.ccnb.json`, `.barcode.json`: the Kramerius 7 search API's
  answers (`https://api.kramerius.mzk.cz/search/api/client/v7.0/search`) by the record's sysno,
  ČNB and barcodes. Kramerius keeps `id_sysno` for few records (about 2 % of MZK's monographs on
  2026-11-20), lowercased (`mzk01-000148004`) or bare (`000913055`), so a lookup tries the sysno
  and falls back to the ČNB and the barcodes; many lookups find nothing.

A plugin's test reads these files; a change in a service is followed by running `capture.sh`
again and reviewing the diff.

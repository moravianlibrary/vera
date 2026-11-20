# Recorded answers

Real answers from MZK's public services, for the outward plugins' tests (batch B), which never
reach the network. Captured on 2026-11-20 by `capture.sh`.

- `records.psv`: the 33 catalog records, picked from the old VERA's documents (identifiers only)
  to cover periodicals with many volumes, volumes, bundles, monographs digitized and not, other
  languages, no catalog page count, registry-linked items, many barcodes and units without a
  year.
- `aleph/<sysno>.xml`: `GetRecord` from `https://aleph.mzk.cz/OAI`, `metadataPrefix=marc21`.
- `kramerius/<sysno>.ccnb.json`, `<sysno>.barcode.json`: the Kramerius 7 search API's answers
  (`https://api.kramerius.mzk.cz/search/api/client/v7.0/search`) by the record's ČNB and by its
  barcodes. Kramerius knows no Aleph sysno; 21 of these lookups find nothing.

A plugin's test reads these files; a change in a service is followed by running `capture.sh`
again and reviewing the diff.

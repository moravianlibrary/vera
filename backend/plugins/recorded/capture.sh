#!/bin/sh
# Re-captures the recorded answers from the records in records.psv: each record's MARCXML from
# MZK Aleph's OAI, and Kramerius's search answers by its ČNB and by its barcodes. Read-only and
# public; run by hand when the fixtures must follow a change in a service, never by a build.
set -eu
cd "$(dirname "$0")"
mkdir -p aleph kramerius
fields="pid,model,title.search,id_ccnb,id_barcode,id_urnnbn,root.pid,date.str,part.number.str,accessibility"
search() {
  curl -fsS -m 30 -G "https://api.kramerius.mzk.cz/search/api/client/v7.0/search" \
    --data-urlencode "q=$1" --data-urlencode "fl=$fields" --data-urlencode "rows=50" -o "$2"
}
grep -v '^#' records.psv | while IFS='|' read -r sysno cnb isxn barcodes why; do
  curl -fsS -m 30 -o "aleph/$sysno.xml" \
    "https://aleph.mzk.cz/OAI?verb=GetRecord&identifier=oai:aleph.mzk.cz:$sysno&metadataPrefix=marc21"
  sleep 0.4
  if [ -n "$cnb" ]; then search "id_ccnb:$cnb" "kramerius/$sysno.ccnb.json"; sleep 0.4; fi
  if [ -n "$barcodes" ]; then
    search "id_barcode:($(echo "$barcodes" | sed 's/,/ OR /g'))" "kramerius/$sysno.barcode.json"
    sleep 0.4
  fi
done

#!/bin/sh
# Re-captures the recorded answers from the records in records.psv: each record's MARCXML from
# MZK Aleph's OAI, and Kramerius's search answers by its ČNB and by its barcodes. Read-only and
# public; run by hand when the fixtures must follow a change in a service, never by a build.
set -eu
cd "$(dirname "$0")"
mkdir -p aleph kramerius
fields="pid,model,title.search,id_ccnb,id_barcode,id_urnnbn,id_sysno,root.pid,date.str,part.number.str,accessibility"
search() {
  curl -fsS -m 30 -G "https://api.kramerius.mzk.cz/search/api/client/v7.0/search" \
    --data-urlencode "q=$1" --data-urlencode "fl=$fields" --data-urlencode "rows=50" -o "$2"
}
grep -v '^#' records.psv | while IFS='|' read -r sysno cnb isxn barcodes why; do
  curl -fsS -m 30 -o "aleph/$sysno.xml" \
    "https://aleph.mzk.cz/OAI?verb=GetRecord&identifier=oai:aleph.mzk.cz:$sysno&metadataPrefix=marc21"
  sleep 0.4
  # Kramerius keeps a sysno for few records, lowercased or bare: try both forms.
  lower=$(echo "$sysno" | tr 'A-Z' 'a-z')
  search "id_sysno:(\"$lower\" OR \"${sysno#*-}\")" "kramerius/$sysno.sysno.json"
  sleep 0.4
  if [ -n "$cnb" ]; then search "id_ccnb:$cnb" "kramerius/$sysno.ccnb.json"; sleep 0.4; fi
  if [ -n "$barcodes" ]; then
    search "id_barcode:($(echo "$barcodes" | sed 's/,/ OR /g'))" "kramerius/$sysno.barcode.json"
    sleep 0.4
  fi
done
# Mirror sync (PLG-api-mirror): the first two ListRecords pages of MZK03's full set, and a page of
# MZK01's changes from a fixed day.
mkdir -p aleph-sync
oai="https://aleph.mzk.cz/OAI"
curl -fsS -m 60 -o aleph-sync/MZK03-VDK.1.xml "$oai?verb=ListRecords&metadataPrefix=marc21&set=MZK03-VDK"
token=$(grep -o '<resumptionToken[^>]*>[^<]*' aleph-sync/MZK03-VDK.1.xml | sed 's/.*>//')
sleep 0.4
curl -fsS -m 60 -G -o aleph-sync/MZK03-VDK.2.xml "$oai" --data-urlencode "verb=ListRecords" \
  --data-urlencode "resumptionToken=$token"
sleep 0.4
curl -fsS -m 60 -o aleph-sync/MZK01-VDK.from.xml \
  "$oai?verb=ListRecords&metadataPrefix=marc21&set=MZK01-VDK&from=2026-11-24T00:00:00Z"

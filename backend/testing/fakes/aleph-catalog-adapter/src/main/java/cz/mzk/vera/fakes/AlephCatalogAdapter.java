package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.catalog.CatalogAdapter;
import cz.mzk.vera.plugin.catalog.CatalogAdapterRefusal;
import cz.mzk.vera.plugin.catalog.CatalogAdapterRefused;
import cz.mzk.vera.plugin.catalog.LinkReader;
import cz.mzk.vera.plugin.catalog.ReadAnswer;
import cz.mzk.vera.plugin.catalog.ReadInput;
import cz.mzk.vera.plugin.catalog.ReadLinkAnswer;
import cz.mzk.vera.plugin.catalog.ReadLinkInput;
import cz.mzk.vera.plugin.catalog.SearchAnswer;
import cz.mzk.vera.plugin.catalog.SearchInput;
import cz.mzk.vera.plugin.catalog.SearchableCatalog;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

// BK3d; PLG-api-kinds: Catalog adapter.
public final class AlephCatalogAdapter implements CatalogAdapter, LinkReader, SearchableCatalog {
    @Override
    public ReadAnswer read(PluginContext context, ReadInput input) {
        Map<String, List<String>> fields = Wire.fields();
        Wire.put(fields, "catalogId", input.catalogId());
        Map<String, List<String>> answer = Wire.send(context, context.configuration().get("base_url"), "read", fields);
        refusal(answer);
        Map<String, Object> recordFields = new HashMap<>();
        recordFields.put("title", Wire.first(answer, "title"));
        recordFields.put("identifiers", Wire.all(answer, "identifiers"));
        recordFields.put("shelfMarks", pairs(Wire.all(answer, "shelfMark")));
        recordFields.put("barcodes", pairs(Wire.all(answer, "barcode")));
        List<String> units = "true".equals(Wire.first(answer, "unitsNull"))
                ? null : Wire.all(answer, "units");
        return new ReadAnswer(input.catalogId(), Map.copyOf(recordFields), units,
                Wire.first(answer, "issuanceType"), context.clock().instant());
    }

    @Override
    public ReadLinkAnswer readLink(PluginContext context, ReadLinkInput input) {
        Map<String, List<String>> fields = Wire.fields();
        Wire.put(fields, "pasted", input.pasted());
        Map<String, List<String>> answer = Wire.send(context, context.configuration().get("base_url"),
                "readLink", fields);
        refusal(answer);
        return new ReadLinkAnswer(Wire.first(answer, "catalogId"));
    }

    @Override
    public SearchAnswer search(PluginContext context, SearchInput input) {
        Map<String, List<String>> fields = Wire.fields();
        Wire.put(fields, "query", input.query());
        Map<String, List<String>> answer = Wire.send(context, context.configuration().get("base_url"),
                "search", fields);
        List<String> ids = Wire.all(answer, "catalogId");
        List<String> titles = Wire.all(answer, "title");
        List<String> values = Wire.all(answer, "hitUnits");
        List<String> nulls = Wire.all(answer, "hitUnitsNull");
        ArrayList<SearchAnswer.Hit> hits = new ArrayList<>();
        for (int index = 0; index < ids.size(); index++) {
            List<String> units = "true".equals(nulls.get(index)) ? null
                    : values.get(index).isEmpty() ? List.of() : List.of(values.get(index).split("\\u001f", -1));
            hits.add(new SearchAnswer.Hit(ids.get(index), titles.get(index), units));
        }
        return new SearchAnswer(List.copyOf(hits));
    }

    private void refusal(Map<String, List<String>> answer) {
        String code = Wire.first(answer, "refusal");
        if (code == null) {
            return;
        }
        CatalogAdapterRefusal refusal = CatalogAdapterRefusal.of(code);
        throw new CatalogAdapterRefused(refusal);
    }

    private Map<String, String> pairs(List<String> values) {
        Map<String, String> result = new HashMap<>();
        for (String value : values) {
            String[] parts = value.split("\\u001f", 2);
            result.put(parts[0], "\u0000".equals(parts[1]) ? null : parts[1]);
        }
        return result;
    }
}

package cz.mzk.vera.plugins.aleph_oai_catalog_adapter;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.plugin.catalog.CatalogAdapter;
import cz.mzk.vera.plugin.catalog.CatalogAdapterRefusal;
import cz.mzk.vera.plugin.catalog.CatalogAdapterRefused;
import cz.mzk.vera.plugin.catalog.ChangeFeed;
import cz.mzk.vera.plugin.catalog.ChangesAnswer;
import cz.mzk.vera.plugin.catalog.ChangesInput;
import cz.mzk.vera.plugin.catalog.LinkReader;
import cz.mzk.vera.plugin.catalog.ReadAnswer;
import cz.mzk.vera.plugin.catalog.ReadInput;
import cz.mzk.vera.plugin.catalog.ReadLinkAnswer;
import cz.mzk.vera.plugin.catalog.ReadLinkInput;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

// Reads MZK's public OAI-PMH records and holdings.
public final class AlephOaiCatalogAdapter implements CatalogAdapter, LinkReader, ChangeFeed {
    private static final String OAI_NS = "http://www.openarchives.org/OAI/2.0/";
    private static final String MARC_NS = "http://www.loc.gov/MARC21/slim";
    private static final Pattern DOC_NUMBER = Pattern.compile("(?:^|[?&])doc_number=([^&#]+)", Pattern.CASE_INSENSITIVE);

    @Override
    public ReadAnswer read(PluginContext context, ReadInput input) {
        String base = config(context, "base");
        String catalogId = input.catalogId();
        if (!catalogId.startsWith(base + "-")) {
            throw refused(CatalogAdapterRefusal.NOT_THIS_CATALOG);
        }
        String host = URI.create(config(context, "oai_url")).getHost();
        String identifier = "oai:" + host + ":" + catalogId;
        URI uri = query(config(context, "oai_url"), Map.of("verb", "GetRecord", "metadataPrefix", "marc21", "identifier", identifier));
        Document document = parse(send(context, uri));
        Element error = first(document.root, OAI_NS, "error");
        if (error != null && "idDoesNotExist".equals(error.getAttribute("code"))) {
            throw refused(CatalogAdapterRefusal.NOT_FOUND);
        }
        Element header = first(document.root, OAI_NS, "header");
        if (header == null || "deleted".equals(header.getAttribute("status"))) {
            throw refused(CatalogAdapterRefusal.NOT_FOUND);
        }
        Element record = first(document.root, MARC_NS, "record");
        if (record == null) throw refused(CatalogAdapterRefusal.MALFORMED);
        return answer(context, catalogId, record);
    }

    private ReadAnswer answer(PluginContext context, String catalogId, Element record) {
        Map<String, Object> fields = new LinkedHashMap<>();
        String title = joined(record, "245", List.of("a", "b", "n", "p"));
        fields.put("title", title);
        fields.put("identifiers", identifiers(record));
        Map<String, String> shelfMarks = new LinkedHashMap<>();
        String mainShelf = subfield(record, "910", "b");
        if (mainShelf != null) shelfMarks.put(mainShelf, null);
        List<Element> holdings = fields(record, "996");
        for (Element holding : holdings) {
            String shelf = subfield(holding, "c");
            if (shelf != null) shelfMarks.putIfAbsent(shelf, null);
        }
        fields.put("shelfMarks", shelfMarks);
        Map<String, String> barcodes = new LinkedHashMap<>();
        List<String> units = new ArrayList<>();
        Set<String> volumes = new LinkedHashSet<>();
        for (Element holding : holdings) {
            String volume = subfield(holding, "v");
            String year = subfield(holding, "y");
            String description = subfield(holding, "d");
            String unit = joinUnit(volume, year, description);
            if (unit != null && volume != null && volumes.add(volume)) units.add(unit);
            String barcode = subfield(holding, "b");
            String shelf = subfield(holding, "c");
            if (shelf != null) shelfMarks.put(shelf, unit);
            if (barcode != null) barcodes.put(barcode, unit);
        }
        fields.put("barcodes", barcodes);
        add(fields, "materialType", materialType(record));
        add(fields, "shelfMark", mainShelf == null && !shelfMarks.isEmpty() ? shelfMarks.keySet().iterator().next() : mainShelf);
        add(fields, "pageCount", pageCount(record));
        add(fields, "cnb", subfield(record, "015", "a"));
        add(fields, "isbn", subfield(record, "020", "a"));
        add(fields, "issn", subfield(record, "022", "a"));
        String control008 = control(record, "008");
        add(fields, "language", slice(control008, 35, 38));
        add(fields, "years", slice(control008, 7, 15));
        String issuance = "s".equals(slice(control(record, "leader"), 7, 8)) && !units.isEmpty()
                ? "Unit" : materialType(record);
        return new ReadAnswer(catalogId, Map.copyOf(fields), units.isEmpty() ? null : List.copyOf(units), issuance,
                context.clock().instant());
    }

    @Override
    public ReadLinkAnswer readLink(PluginContext context, ReadLinkInput input) {
        String text = input.pasted() == null ? "" : input.pasted().trim();
        String base = config(context, "base");
        String opacBase = context.configuration().getOrDefault("opac_url", "https://vufind.mzk.cz/Record/");
        String id = null;
        try {
            URI pasted = URI.create(text);
            if (pasted.getHost() != null && pasted.getPath() != null
                    && pasted.getPath().startsWith(URI.create(opacBase).getPath())) {
                String tail = pasted.getPath().substring(URI.create(opacBase).getPath().length());
                id = tail.split("/", 2)[0];
            }
        } catch (IllegalArgumentException ignored) {
            // Bare ids are handled below.
        }
        Matcher matcher = DOC_NUMBER.matcher(text);
        if (id == null && matcher.find()) id = decode(matcher.group(1));
        if (id == null && text.matches("[A-Za-z0-9-]+")) id = text;
        if (id != null && id.matches("\\d{9}")) id = base + "-" + id;
        if (id != null && id.matches(Pattern.quote(base) + "-\\d{9}")) return new ReadLinkAnswer(id);
        throw refused(CatalogAdapterRefusal.NOT_THIS_CATALOG);
    }

    @Override
    public ChangesAnswer changes(PluginContext context, ChangesInput input) {
        String cursor = input.cursor() == null || input.cursor().isBlank()
                ? context.clock().instant().minus(1, ChronoUnit.DAYS).toString() : input.cursor();
        String set = context.configuration().getOrDefault("set", "MZKALL");
        List<String> ids = new ArrayList<>();
        String newest = null;
        String token = null;
        for (int page = 0; page < 10; page++) {
            Map<String, String> params = token == null
                    ? Map.of("verb", "ListIdentifiers", "metadataPrefix", "marc21", "from", cursor, "set", set)
                    : Map.of("verb", "ListIdentifiers", "resumptionToken", token);
            Document pageDoc = parse(send(context, query(config(context, "oai_url"), params)));
            NodeList headers = pageDoc.root.getElementsByTagNameNS(OAI_NS, "header");
            for (int i = 0; i < headers.getLength(); i++) {
                Element header = (Element) headers.item(i);
                String identifier = text(first(header, OAI_NS, "identifier"));
                String datestamp = text(first(header, OAI_NS, "datestamp"));
                String catalogId = identifier == null ? null : identifier.substring(identifier.lastIndexOf(':') + 1);
                if (catalogId != null) ids.add(catalogId);
                if (datestamp != null && (newest == null || datestamp.compareTo(newest) > 0)) newest = datestamp;
            }
            Element resume = first(pageDoc.root, OAI_NS, "resumptionToken");
            token = resume == null || text(resume) == null || text(resume).isBlank() ? null : text(resume);
            if (token == null) break;
        }
        return new ChangesAnswer(List.copyOf(ids), newest == null ? cursor : newest);
    }

    private PluginHttp.Response send(PluginContext context, URI uri) {
        PluginHttp.Response response = context.http().send(new PluginHttp.Request("GET", uri, Map.of(), new byte[0]));
        if (response == null || response.status() >= 500) throw new PluginUnavailable("Aleph OAI is unavailable");
        if (response.status() < 200 || response.status() >= 300) throw new PluginUnavailable("Aleph OAI returned HTTP " + response.status());
        return response;
    }

    private Document parse(PluginHttp.Response response) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            org.w3c.dom.Document doc = factory.newDocumentBuilder().parse(new InputSource(new ByteArrayInputStream(response.body())));
            Element root = doc.getDocumentElement();
            if (!"OAI-PMH".equals(root.getLocalName()) || !OAI_NS.equals(root.getNamespaceURI())) throw new IllegalArgumentException("Not OAI-PMH");
            return new Document(root);
        } catch (Exception exception) {
            throw new CatalogAdapterRefused(CatalogAdapterRefusal.MALFORMED, "Malformed OAI-PMH response");
        }
    }

    private URI query(String endpoint, Map<String, String> parameters) {
        StringBuilder value = new StringBuilder(endpoint);
        value.append(endpoint.contains("?") ? '&' : '?');
        parameters.forEach((key, item) -> value.append(URLEncoder.encode(key, StandardCharsets.UTF_8))
                .append('=').append(URLEncoder.encode(item, StandardCharsets.UTF_8)).append('&'));
        value.setLength(value.length() - 1);
        return URI.create(value.toString());
    }

    private String config(PluginContext context, String key) {
        String value = context.configuration().get(key);
        if (value == null || value.isBlank()) throw new PluginUnavailable("Missing plugin configuration: " + key);
        return value;
    }

    private List<String> identifiers(Element record) {
        List<String> result = new ArrayList<>();
        for (String tag : List.of("015", "020", "022")) {
            for (Element field : fields(record, tag)) {
                for (Element subfield : subfields(field, "a")) {
                    String value = text(subfield);
                    if (value != null) result.add(value);
                }
            }
        }
        return List.copyOf(result);
    }

    private String materialType(Element record) {
        String leader = control(record, "leader");
        String type = slice(leader, 6, 7);
        String level = slice(leader, 7, 8);
        if ("s".equals(level)) return "Periodical";
        if ("c".equals(type)) return "Notated music";
        if ("e".equals(type) || "f".equals(type)) return "Map";
        if ("g".equals(type)) return "Projected medium";
        if ("i".equals(type) || "j".equals(type)) return "Sound recording";
        if ("m".equals(type)) return "Computer file";
        if ("k".equals(type)) return "Graphic";
        if ("t".equals(type)) return "Manuscript";
        return "Monograph";
    }

    private String pageCount(Element record) {
        String extent = subfield(record, "300", "a");
        if (extent == null) return null;
        Matcher matcher = Pattern.compile("(?:^|\\D)(\\d+)\\s*(?:s\\.|p\\.)", Pattern.CASE_INSENSITIVE).matcher(extent);
        return matcher.find() ? matcher.group(1) : null;
    }

    private String joinUnit(String volume, String year, String description) {
        List<String> parts = new ArrayList<>();
        if (volume != null) parts.add(volume);
        if (year != null) parts.add(year);
        if (description != null && !description.equals(volume) && !description.equals(year)) parts.add(description);
        return parts.isEmpty() ? null : String.join(" ", new LinkedHashSet<>(parts));
    }

    private List<Element> fields(Element record, String tag) {
        List<Element> result = new ArrayList<>();
        NodeList nodes = record.getElementsByTagNameNS(MARC_NS, "datafield");
        for (int i = 0; i < nodes.getLength(); i++) {
            Element field = (Element) nodes.item(i);
            if (tag.equals(field.getAttribute("tag"))) result.add(field);
        }
        return result;
    }

    private String subfield(Element record, String tag, String code) {
        List<Element> matching = fields(record, tag);
        for (Element field : matching) {
            String value = subfield(field, code);
            if (value != null) return value;
        }
        return null;
    }

    private String subfield(Element field, String code) {
        List<Element> values = subfields(field, code);
        return values.isEmpty() ? null : text(values.get(0));
    }

    private List<Element> subfields(Element field, String code) {
        List<Element> result = new ArrayList<>();
        NodeList nodes = field.getElementsByTagNameNS(MARC_NS, "subfield");
        for (int i = 0; i < nodes.getLength(); i++) {
            Element item = (Element) nodes.item(i);
            if (code.equals(item.getAttribute("code"))) result.add(item);
        }
        return result;
    }

    private String joined(Element record, String tag, List<String> codes) {
        List<String> values = new ArrayList<>();
        for (Element field : fields(record, tag)) for (String code : codes) {
            for (Element item : subfields(field, code)) if (text(item) != null) values.add(text(item));
        }
        return values.isEmpty() ? null : String.join(" ", values);
    }

    private String control(Element record, String tag) {
        NodeList nodes = record.getElementsByTagNameNS(MARC_NS, "controlfield");
        if ("leader".equals(tag)) {
            NodeList leaders = record.getElementsByTagNameNS(MARC_NS, "leader");
            return leaders.getLength() == 0 ? null : text((Element) leaders.item(0));
        }
        for (int i = 0; i < nodes.getLength(); i++) {
            Element item = (Element) nodes.item(i);
            if (tag.equals(item.getAttribute("tag"))) return text(item);
        }
        return null;
    }

    private String slice(String value, int from, int to) {
        return value == null || value.length() < to ? null : value.substring(from, to).trim();
    }

    private void add(Map<String, Object> fields, String key, String value) { if (value != null) fields.put(key, value); }
    private Element first(Element parent, String namespace, String name) {
        NodeList nodes = parent.getElementsByTagNameNS(namespace, name);
        return nodes.getLength() == 0 ? null : (Element) nodes.item(0);
    }
    private String text(Element element) { return element == null ? null : element.getTextContent().trim(); }
    private String decode(String value) { return java.net.URLDecoder.decode(value, StandardCharsets.UTF_8); }
    private CatalogAdapterRefused refused(CatalogAdapterRefusal refusal) { return new CatalogAdapterRefused(refusal); }
    private record Document(Element root) {}
}

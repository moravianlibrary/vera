package cz.mzk.vera.testing.seeds;

import com.networknt.schema.Error;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

@Component
public class SeedReader {
    private static final Pattern NAME = Pattern.compile("^[a-z0-9-]+$");
    private static final List<String> CHANGELOG_FILES = List.of(
            "db/changelog/db.changelog-master.yaml",
            "db/changelog/0001-people.sql",
            "db/changelog/0002-plugins.sql",
            "db/changelog/0003-sessions.sql",
            "db/changelog/0004-test-clock.sql",
            "db/changelog/0005-plugin-descriptor.sql");
    private final ObjectMapper mapper = new ObjectMapper();
    private final Path seedDir;
    private final Path contractDir;

    @Autowired
    public SeedReader(@Value("${VERA_SEEDS_DIR}") String seedsDirectory,
            @Value("${VERA_CONTRACT_DIR}") String contractDirectory) {
        this(Path.of(seedsDirectory), Path.of(contractDirectory));
    }

    SeedReader(Path seedDir, Path contractDir) {
        this.seedDir = seedDir;
        this.contractDir = contractDir;
    }

    public JsonNode read(String name) {
        return read(name, new ArrayList<>());
    }

    public String contentHash(String name) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            hashSeed(name, new ArrayList<>(), digest);
            for (String resource : CHANGELOG_FILES) {
                digest.update(resource.getBytes(StandardCharsets.UTF_8));
                try (InputStream changelog = SeedReader.class.getClassLoader().getResourceAsStream(resource)) {
                    if (changelog == null) {
                        throw new IOException("Missing changelog resource " + resource);
                    }
                    digest.update(changelog.readAllBytes());
                }
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (IOException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Could not hash seed inputs.", exception);
        }
    }

    private void hashSeed(String name, List<String> seen, MessageDigest digest) throws IOException {
        if (seen.contains(name)) {
            return;
        }
        Path file = seedDir.resolve(name + ".json");
        digest.update(file.getFileName().toString().getBytes(StandardCharsets.UTF_8));
        digest.update(Files.readAllBytes(file));
        JsonNode patch = mapper.readTree(Files.readString(file));
        seen.add(name);
        if (patch.path("extends").isString()) {
            hashSeed(patch.path("extends").asString(), seen, digest);
        }
    }

    private JsonNode read(String name, List<String> chain) {
        if (chain.contains(name)) {
            List<String> path = new ArrayList<>(chain);
            path.add(name);
            throw new IllegalArgumentException("seed " + name + " extends itself through " + String.join(" -> ", path));
        }
        Path file = seedDir.resolve(name + ".json");
        if (!NAME.matcher(name).matches() || !Files.isRegularFile(file)) {
            throw new SeedNotFoundException(name);
        }
        JsonNode patch = parse(file);
        validate(patch, "seed-patch.schema.json");
        JsonNode result = patch;
        JsonNode parentName = patch.get("extends");
        if (parentName != null && parentName.isString()) {
            List<String> next = new ArrayList<>(chain);
            next.add(name);
            result = extend(read(parentName.asString(), next), patch);
        }
        validate(result, "seed.schema.json");
        return result;
    }

    private JsonNode parse(Path file) {
        try {
            return mapper.readTree(Files.readString(file));
        } catch (IOException exception) {
            throw new IllegalArgumentException("Could not read seed " + file.getFileName() + ".", exception);
        }
    }

    private void validate(JsonNode value, String schemaName) {
        try {
            List<Error> errors;
            try (var schemaFile = Files.newInputStream(contractDir.resolve("seed").resolve(schemaName))) {
                Schema schema = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12)
                        .getSchema(schemaFile);
                errors = schema.validate(value);
            }
            if (!errors.isEmpty()) {
                throw new IllegalArgumentException("Seed schema validation failed: " + errors);
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Could not read " + schemaName, exception);
        }
    }

    // Seed extension semantics are shared with contract/src/seed-extends.ts.
    private JsonNode extend(JsonNode parent, JsonNode child) {
        ObjectNode base = (ObjectNode) parent.deepCopy();
        base.remove("extends");
        ObjectNode own = (ObjectNode) child.deepCopy();
        own.remove("extends");
        ObjectNode merged = base.deepCopy();
        own.properties().forEach(entry -> {
            String key = entry.getKey();
            if (key.equals("collections") && entry.getValue().isObject()) {
                merged.set(key, mergeCollections(base.get(key), entry.getValue()));
            } else if (key.equals("fakes") && entry.getValue().isObject()) {
                merged.set(key, mergeObjects(base.get(key), entry.getValue()));
            } else {
                merged.set(key, entry.getValue());
            }
        });
        if (!own.has("collections")) {
            merged.set("collections", base.path("collections"));
        }
        if (!own.has("fakes")) {
            merged.set("fakes", base.path("fakes"));
        }
        return merged;
    }

    private ObjectNode mergeCollections(JsonNode parent, JsonNode child) {
        ObjectNode out = parent != null && parent.isObject()
                ? (ObjectNode) parent.deepCopy()
                : mapper.createObjectNode();
        child.properties().forEach(entry -> {
            JsonNode value = out.has(entry.getKey())
                    ? mergeValue(out.get(entry.getKey()), entry.getValue())
                    : entry.getValue();
            out.set(entry.getKey(), value);
        });
        return out;
    }

    private ObjectNode mergeObjects(JsonNode parent, JsonNode child) {
        ObjectNode out = parent != null && parent.isObject()
                ? (ObjectNode) parent.deepCopy()
                : mapper.createObjectNode();
        child.properties().forEach(entry -> out.set(entry.getKey(), entry.getValue()));
        return out;
    }

    private JsonNode mergeValue(JsonNode parent, JsonNode child) {
        if (parent.isArray() && child.isArray()) {
            ArrayNode out = mapper.createArrayNode();
            Map<String, Integer> indexes = new LinkedHashMap<>();
            for (JsonNode item : parent) {
                String id = id(item);
                if (id != null && !indexes.containsKey(id)) {
                    indexes.put(id, out.size());
                }
                out.add(item);
            }
            for (JsonNode item : child) {
                String id = id(item);
                Integer index = id == null ? null : indexes.get(id);
                if (index == null) {
                    if (id != null) {
                        indexes.put(id, out.size());
                    }
                    out.add(item);
                } else {
                    out.set(index, item);
                }
            }
            return out;
        }
        if (parent.isObject() && child.isObject()) return mergeObjects(parent, child);
        return child;
    }

    private String id(JsonNode value) {
        return value.isObject() && value.path("id").isString() ? value.path("id").asString() : null;
    }

    public static final class SeedNotFoundException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        public SeedNotFoundException(String name) {
            super("There is no seed named " + name + ".");
        }
    }
}

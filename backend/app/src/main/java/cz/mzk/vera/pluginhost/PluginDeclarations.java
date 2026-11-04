package cz.mzk.vera.pluginhost;

import com.networknt.schema.Error;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.jar.JarEntry;
import java.util.jar.JarInputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// PLG-declares; PLG-contract.
@Component
public class PluginDeclarations {
    private static final String DECLARATION = "META-INF/vera-plugin.json";

    private final Schema schema;
    private final ObjectMapper mapper = new ObjectMapper();

    public PluginDeclarations(@Value("${VERA_CONTRACT_DIR}") String contractDir) {
        Path schemaFile = Path.of(contractDir).resolve("plugin/vera-plugin.schema.json");
        try (var schemaStream = Files.newInputStream(schemaFile)) {
            schema = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12)
                    .getSchema(schemaStream);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not read vera-plugin.schema.json.", exception);
        }
    }

    public JsonNode read(byte[] jar) {
        try (JarInputStream archive = new JarInputStream(new ByteArrayInputStream(jar))) {
            JarEntry entry;
            while ((entry = archive.getNextJarEntry()) != null) {
                if (DECLARATION.equals(entry.getName())) {
                    JsonNode declaration = mapper.readTree(archive.readAllBytes());
                    validate(declaration);
                    return declaration;
                }
            }
            throw new IllegalArgumentException("Plugin JAR has no " + DECLARATION + ".");
        } catch (IOException exception) {
            throw new IllegalArgumentException("Could not read plugin declarations.", exception);
        }
    }

    private void validate(JsonNode declaration) {
        List<Error> errors = schema.validate(declaration);
        if (!errors.isEmpty()) {
            throw new IllegalArgumentException("Plugin declarations do not match the schema: " + errors);
        }
    }
}

package cz.mzk.vera.plugins;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.pluginhost.PluginSignatures;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

// PLG-upload; PLG-upgrade; B6 Signed; PLG-api-capabilities.
@org.springframework.boot.test.context.SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class PluginPackageTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;

    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();
    private String adminCookie;

    @BeforeEach
    void resetBase() {
        client.post().uri("/_engine/reset").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("seed", "base", "frozen", true)).exchange().expectStatus().isOk();
        String cookie = client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", "u3")).exchange().expectStatus().isOk()
                .expectBody().returnResult().getResponseHeaders().getFirst("Set-Cookie");
        adminCookie = cookie.substring(0, cookie.indexOf(';'));
    }

    @Test
    void uploadsInstallsAndMovesAnInstanceToTheSignedVersion() throws Exception {
        JsonNode expected = recordingUploadAnswer();
        JsonNode uploaded = json(client.post().uri("/api/plugin-implementations/uploads")
                .header("Cookie", adminCookie).contentType(MediaType.parseMediaType(
                        "multipart/form-data; boundary=vera-upload-boundary"))
                .body(multipart("catalog-validity-3.2.0.jar", packageBytes("catalog-validity-3.2.0.jar"), "pt6"))
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
        ((ObjectNode) expected.path("version"))
                .put("signer", "VERA test plugin");
        assertThat(uploaded).isEqualTo(expected);
        client.post().uri("/api/plugin-implementations/uploads/up1/install").header("Cookie", adminCookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.versions[0].version").isEqualTo("3.2.0");
        client.get().uri("/api/plugins").header("Cookie", adminCookie).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.implementations[?(@.id == 'pt6')].versions[0].version")
                .isEqualTo("3.2.0");
        JsonNode preview = json(client.get().uri("/api/plugin-instances/pi9/upgrade").header("Cookie", adminCookie)
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
        assertThat(preview).isEqualTo(recordingCall("GET", "/api/plugin-instances/pi9/upgrade", 200));
        JsonNode moved = json(client.post().uri("/api/plugin-instances/pi9/upgrade").header("Cookie", adminCookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody());
        assertThat(moved).isEqualTo(recordingCall("POST", "/api/plugin-instances/pi9/upgrade", 200));
        List<String> auditCodes = new java.util.ArrayList<>();
        for (String record : jdbc.queryForList("SELECT record::text FROM audit_outbox ORDER BY id", String.class)) {
            auditCodes.add(mapper.readTree(record).path("code").asString());
        }
        assertThat(auditCodes).contains("plugin.uploaded", "plugin_instance.upgraded");
    }

    @Test
    void signedUploadNamesItsCertificateAndTheInstalledVersionKeepsIt() throws Exception {
        JsonNode uploaded = json(client.post().uri("/api/plugin-implementations/uploads")
                .header("Cookie", adminCookie).contentType(MediaType.parseMediaType(
                        "multipart/form-data; boundary=vera-upload-boundary"))
                .body(multipart("catalog-validity-3.2.0.jar", packageBytes("catalog-validity-3.2.0.jar"), "pt6"))
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
        assertThat(uploaded.path("version").path("signer").asString()).isEqualTo("VERA test plugin");
        client.post().uri("/api/plugin-implementations/uploads/up1/install").header("Cookie", adminCookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isOk();
        client.get().uri("/api/plugins").header("Cookie", adminCookie).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.implementations[?(@.id == 'pt6')].versions[0].signer")
                .isEqualTo("VERA test plugin");
    }

    @Test
    void seededVersionNamesItsSeedSigner() {
        client.get().uri("/api/plugins").header("Cookie", adminCookie).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.implementations[?(@.id == 'pt6')].versions[0].signer")
                .isEqualTo("VERA test plugin");
    }

    @Test
    void refusesANonJarPackageWithTheMockCode() throws Exception {
        JsonNode answer = json(upload("notes.txt", new byte[] {0, 0}, "pt6"));
        assertThat(answer.path("code").asString()).isEqualTo("plugin.not_a_package");
    }

    @Test
    void refusesAnUnknownSignedJarWithoutTheDescriptor() throws Exception {
        JsonNode answer = json(upload("unknown-plugin.jar", packageBytes("unknown-plugin.jar"), null));
        assertThat(answer.path("code").asString()).isEqualTo("plugin.no_descriptor");
    }

    @Test
    void refusesAnAlreadyInstalledPackageVersion() throws Exception {
        JsonNode answer = json(upload("catalog-validity-3.1.0.jar",
                packageBytes("catalog-validity-3.1.0.jar"), "pt6"));
        assertThat(answer.path("code").asString()).isEqualTo("plugin.version_installed");
    }

    @Test
    void refusesAValidPackageForAnotherImplementation() throws Exception {
        JsonNode answer = json(upload("catalog-validity-3.2.0.jar",
                packageBytes("catalog-validity-3.2.0.jar"), "pt1"));
        assertThat(answer.path("code").asString()).isEqualTo("plugin.other_implementation");
    }

    @Test
    void refusesAnUnsignedJar() throws Exception {
        JsonNode answer = json(upload("unsigned.jar", new byte[] {0, 0}, "pt6"));
        assertThat(answer.path("code").asString()).isEqualTo("plugin.package_missing");
    }

    @Test
    void refusesAnUploadWithoutAFile() throws Exception {
        JsonNode answer = json(client.post().uri("/api/plugin-implementations/uploads")
                .header("Cookie", adminCookie)
                .contentType(MediaType.parseMediaType("multipart/form-data; boundary=vera-upload-boundary"))
                .body("--vera-upload-boundary--\r\n".getBytes(java.nio.charset.StandardCharsets.UTF_8))
                .exchange());
        assertThat(answer.path("code").asString()).isEqualTo("plugin.package_missing");
    }

    @Test
    void emptyTrustStoreRefusesASignedPackage() throws Exception {
        PluginSignatures signatures = new PluginSignatures("");
        assertThatThrownBy(() -> signatures.verify(packageBytes("catalog-validity-3.2.0.jar")))
                .isInstanceOf(SecurityException.class);
    }

    private RestTestClient.ResponseSpec upload(String fileName, byte[] bytes, String implementationId) {
        return client.post().uri("/api/plugin-implementations/uploads").header("Cookie", adminCookie)
                .contentType(MediaType.parseMediaType("multipart/form-data; boundary=vera-upload-boundary"))
                .body(multipart(fileName, bytes, implementationId)).exchange();
    }

    private byte[] packageBytes(String name) throws Exception {
        return Files.readAllBytes(Path.of("build/plugin-packages", name));
    }

    private byte[] multipart(String fileName, byte[] bytes, String implementationId) {
        String boundary = "vera-upload-boundary";
        java.io.ByteArrayOutputStream body = new java.io.ByteArrayOutputStream();
        try {
            body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"implementationId\""
                    + "\r\n\r\n" + (implementationId == null ? "" : implementationId) + "\r\n")
                    .getBytes(java.nio.charset.StandardCharsets.UTF_8));
            body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\""
                    + fileName + "\"\r\nContent-Type: application/java-archive\r\n\r\n")
                    .getBytes(java.nio.charset.StandardCharsets.UTF_8));
            body.write(bytes);
            body.write(("\r\n--" + boundary + "--\r\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (java.io.IOException exception) {
            throw new IllegalStateException(exception);
        }
        return body.toByteArray();
    }

    private JsonNode json(RestTestClient.ResponseSpec response) throws Exception {
        var result = response.expectBody(String.class).returnResult();
        assertThat(result.getStatus().value()).isIn(409, 422);
        return mapper.readTree(result.getResponseBody());
    }

    private JsonNode json(String body) throws Exception {
        return mapper.readTree(body);
    }

    private JsonNode recordingUploadAnswer() throws Exception {
        return recordingCall("POST", "/api/plugin-implementations/uploads", 200);
    }

    private JsonNode recordingCall(String method, String path, int status) throws Exception {
        JsonNode scenario = recordingScenario();
        for (JsonNode call : scenario.path("calls")) {
            if (call.path("method").asString().equals(method) && call.path("path").asString().equals(path)
                    && call.path("status").asInt() == status) {
                return call.path("body");
            }
        }
        throw new IllegalStateException("The recording has no " + method + " " + path + " answer " + status + ".");
    }

    private JsonNode recordingScenario() throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-plugins.json").toFile());
        for (JsonNode scenario : recording.path("scenarios")) {
            if (scenario.path("name").asString().equals("upload-install-and-upgrade")) {
                return scenario;
            }
        }
        throw new IllegalStateException("The recording has no upload-install-and-upgrade scenario.");
    }
}

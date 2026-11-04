package cz.mzk.vera.testing.control;

import cz.mzk.vera.testing.VeraTestingApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "vera.test.invalid-response=true")
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class ContractResponseTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;

    @Test
    void reportsAnAnswerOutsideTheResponseSchemaAsContractResponse() {
        String body = client.get().uri("/api/batches").exchange().expectStatus().is5xxServerError()
                .expectBody(String.class).returnResult().getResponseBody();
        assertThat(body).contains("\"code\":\"contract.response\"");
    }
}

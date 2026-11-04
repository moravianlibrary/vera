package cz.mzk.vera.testing;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "cz.mzk.vera")
public class VeraTestingApplication {
    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(VeraTestingApplication.class);
        application.setAdditionalProfiles("test");
        application.run(args);
    }
}

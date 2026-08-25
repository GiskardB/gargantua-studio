package ai.gargantua.studio.common;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * Cross-cutting beans: a system {@link Clock} (so time is injectable and tests can
 * pin it), the Jackson 2 mapper used for YAML emission and draft persistence, and the
 * {@link RestClient} the Control Plane gateway calls.
 */
@Configuration
public class AppConfig {

    /** Injectable clock; overridden with a fixed clock in unit tests. */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    /**
     * A dedicated Jackson 2 mapper for persistence and manifest emission. Kept separate
     * from Spring Boot 4's HTTP mapper (Jackson 3): Java-time as ISO strings, and unknown
     * properties ignored so a stored draft survives an additive schema change.
     */
    @Bean
    public ObjectMapper documentObjectMapper() {
        return JsonMapper.builder()
                .addModule(new JavaTimeModule())
                .build()
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    }

    /**
     * Client for the Control Plane API. The base URL points at the Control Plane the
     * Studio serves; in Cave the two run side by side, so it defaults to localhost.
     */
    @Bean
    public RestClient controlPlaneRestClient(
            @Value("${gargantua.control-plane.base-url:http://localhost:8080}") String baseUrl) {
        return RestClient.builder().baseUrl(baseUrl).build();
    }
}

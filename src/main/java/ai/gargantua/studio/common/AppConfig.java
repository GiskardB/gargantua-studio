package ai.gargantua.studio.common;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
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
     * Client for the Control Plane API. No base URL baked in on purpose: Studio can be
     * pointed at more than one Control Plane (see {@code ControlPlaneRegistry}), switchable
     * at runtime, so {@code ControlPlaneClient} resolves the full URL itself on every call
     * against whichever one is currently active.
     */
    @Bean
    public RestClient controlPlaneRestClient() {
        return RestClient.builder().build();
    }

    @Bean
    public WebMvcConfigurer staticResources() {
        return new WebMvcConfigurer() {
            @Override
            public void addResourceHandlers(ResourceHandlerRegistry registry) {
                registry.addResourceHandler("/**")
                        .addResourceLocations("classpath:/static/")
                        .resourceChain(true);
            }
        };
    }

}

package ai.gargantua.studio;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Gargantua Studio backend — the backend-for-frontend behind Gargantua Studio.
 *
 * <p>It does three things: builds and validates {@code gargantua.ai/v1} manifests from
 * the shared agent-core domain model, gateways the Control Plane API to the UI so the
 * designer shows real platform state, and persists agent drafts. It owns no desired
 * state of its own — the Control Plane remains the source of truth (ADR-004).
 */
@SpringBootApplication
public class StudioBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(StudioBackendApplication.class, args);
    }
}

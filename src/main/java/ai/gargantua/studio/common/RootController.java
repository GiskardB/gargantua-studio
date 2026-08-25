package ai.gargantua.studio.common;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * A tiny index of what this backend exposes, handy for a smoke test at {@code GET /api}.
 * ({@code /} itself serves the bundled Studio SPA — this image ships frontend + backend.)
 */
@RestController
public class RootController {

    @GetMapping("/api")
    public Map<String, Object> index() {
        return Map.of(
                "service", "gargantua-studio-backend",
                "schema", "gargantua.ai/v1",
                "endpoints", Map.of(
                        "manifest", "/api/studio/manifest/{build,validate}",
                        "skill", "/api/studio/skill/{build,validate}",
                        "drafts", "/api/studio/drafts",
                        "platform", "/api/studio/{workloads,capabilities,policies,deployments}",
                        "publish", "/api/studio/publish",
                        "health", "/actuator/health"));
    }
}

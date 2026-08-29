package ai.gargantua.studio.launch;

import ai.gargantua.studio.launch.LaunchService.LaunchResult;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Launch use cases: read/update the command template that starts an agent, and run it for
 * a given published bundle. See {@link LaunchService} for the security note — this runs a
 * configured command with the backend's privileges and is intended for local/dev use.
 */
@RestController
@RequestMapping("/api/studio")
public class LaunchController {

    private final LaunchService launch;

    public LaunchController(LaunchService launch) {
        this.launch = launch;
    }

    /** The current launch command template (with {@code {name}}/{@code {version}} placeholders). */
    @GetMapping("/launch-command")
    public Map<String, String> commandTemplate() {
        return Map.of("template", launch.commandTemplate());
    }

    @PutMapping("/launch-command")
    public Map<String, String> updateCommandTemplate(@RequestBody Map<String, String> body) {
        String template = body.getOrDefault("template", "");
        launch.updateCommandTemplate(template);
        return Map.of("template", launch.commandTemplate());
    }

    /**
     * Launch (or relaunch) the runtime for a published bundle. {@code env} is optional,
     * user-supplied {@code -e KEY=VALUE} overrides inserted into the command template
     * wherever it has a {@code {env}} placeholder — see {@link LaunchService}. 400 if
     * name/version/an env key are unsafe.
     */
    @PostMapping("/launch")
    public ResponseEntity<?> launch(@RequestBody LaunchRequest request) {
        try {
            LaunchResult result = launch.launch(request.name(), request.version(), request.env());
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    public record LaunchRequest(String name, String version, Map<String, String> env) {
        public LaunchRequest {
            env = env == null ? Map.of() : env;
        }
    }
}

package ai.gargantua.studio.launch;

import ai.gargantua.studio.controlplane.ControlPlaneClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

/**
 * Runs the (admin-configurable) command that starts a published agent — today a
 * {@code docker compose} invocation, but the template is deliberately generic so it can
 * become {@code kubectl} or anything else without a code change.
 *
 * <p>The runtime cannot hot-swap which agent it serves (ADR-001: one process, one agent,
 * config bound at startup), so "launch" means (re)starting the runtime container pointed
 * at the freshly published bundle. The Control Plane does not execute the launch itself
 * (ADR-004), which is why this lives here rather than there — but Studio, as the executor,
 * reports the observed outcome back to the Control Plane's Deployment record so the rest
 * of the platform (e.g. the Playground) can tell which agent is actually running.
 *
 * <p>Security: {@code name}/{@code version} are substituted into a shell command, so they
 * are validated against a strict allow-list first. This endpoint executes arbitrary
 * configured commands with the backend's privileges — it is for local/dev use, never for
 * an exposed deployment.
 */
@Service
public class LaunchService {

    private static final Logger log = LoggerFactory.getLogger(LaunchService.class);

    static final String TEMPLATE_KEY = "launch.command-template";

    /** Names/versions come from user-editable form fields — keep them shell-safe. */
    private static final Pattern SAFE = Pattern.compile("^[A-Za-z0-9._-]+$");
    private static final int MAX_OUTPUT_CHARS = 8000;
    private static final long TIMEOUT_MINUTES = 5;

    private final SettingsStore settings;
    private final String defaultTemplate;
    private final String workdir;
    private final ControlPlaneClient controlPlane;
    private final ObjectMapper mapper;
    private final String healthUrl;
    private final Duration healthTimeout;
    private final Duration healthPollInterval;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

    public LaunchService(
            SettingsStore settings,
            @Value("${gargantua.launch.command-template}") String defaultTemplate,
            @Value("${gargantua.launch.workdir}") String workdir,
            ControlPlaneClient controlPlane,
            ObjectMapper mapper,
            @Value("${gargantua.launch.health-url:http://gargantua-runtime:8080/actuator/health}") String healthUrl,
            @Value("${gargantua.launch.health-timeout-seconds:90}") long healthTimeoutSeconds,
            @Value("${gargantua.launch.health-poll-interval-ms:2000}") long healthPollIntervalMs) {
        this.settings = settings;
        this.defaultTemplate = defaultTemplate;
        this.workdir = workdir;
        this.controlPlane = controlPlane;
        this.mapper = mapper;
        this.healthUrl = healthUrl;
        this.healthTimeout = Duration.ofSeconds(healthTimeoutSeconds);
        this.healthPollInterval = Duration.ofMillis(healthPollIntervalMs);
    }

    public String commandTemplate() {
        return settings.get(TEMPLATE_KEY).orElse(defaultTemplate);
    }

    public void updateCommandTemplate(String template) {
        settings.put(TEMPLATE_KEY, template);
    }

    /** Result of a launch attempt. Non-zero {@code exitCode} means the command failed. */
    public record LaunchResult(int exitCode, String command, String output) {
    }

    public LaunchResult launch(String name, String version) {
        if (name == null || !SAFE.matcher(name).matches()) {
            throw new IllegalArgumentException("invalid agent name: " + name);
        }
        if (version == null || !SAFE.matcher(version).matches()) {
            throw new IllegalArgumentException("invalid agent version: " + version);
        }
        String deploymentId = registerDeployment(name, version);
        String command = commandTemplate()
                .replace("{name}", name)
                .replace("{version}", version);
        LaunchResult result = run(command);
        // `docker run -d` returns as soon as the container starts, not once the agent inside
        // is actually ready — the app can take tens of seconds (slow MCP servers, model
        // warm-up). Reporting HEALTHY off the docker exit code alone would let the Playground
        // (and anyone else reading the Control Plane) treat a still-booting agent as reachable.
        if (result.exitCode() == 0 && !awaitHealthy()) {
            result = new LaunchResult(-1, result.command(), result.output()
                    + "\n[runtime did not report healthy within " + healthTimeout.toSeconds() + "s]");
        }
        reportDeploymentState(deploymentId, result.exitCode() == 0 ? "HEALTHY" : "FAILED");
        return result;
    }

    private boolean awaitHealthy() {
        HttpRequest request;
        try {
            request = HttpRequest.newBuilder(URI.create(healthUrl)).timeout(Duration.ofSeconds(3)).GET().build();
        } catch (Exception e) {
            log.debug("Invalid health-check URL '{}': {}", healthUrl, e.getMessage());
            return false;
        }
        Instant deadline = Instant.now().plus(healthTimeout);
        while (Instant.now().isBefore(deadline)) {
            try {
                HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
                if (response.statusCode() == 200) {
                    return true;
                }
            } catch (Exception e) {
                // Not up yet (connection refused, reset while Tomcat starts, ...) — keep polling.
            }
            try {
                Thread.sleep(healthPollInterval.toMillis());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return false;
    }

    private LaunchResult run(String command) {
        try {
            Process process = new ProcessBuilder("sh", "-c", command)
                    .directory(new java.io.File(workdir))
                    .redirectErrorStream(true)
                    .start();
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            boolean finished = process.waitFor(TIMEOUT_MINUTES, TimeUnit.MINUTES);
            if (!finished) {
                process.destroyForcibly();
                return new LaunchResult(-1, command, cap(output) + "\n[timed out after " + TIMEOUT_MINUTES + "m]");
            }
            return new LaunchResult(process.exitValue(), command, cap(output));
        } catch (IOException e) {
            return new LaunchResult(-1, command, "failed to start command: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new LaunchResult(-1, command, "launch interrupted");
        }
    }

    /**
     * Best-effort: records a PENDING deployment with the Control Plane so the launch's
     * outcome can be reported. A launch must still work standalone (no Control Plane, or
     * the bundle only exists locally), so any failure here just means nobody will see this
     * agent as "active" — it does not block the actual launch.
     */
    private String registerDeployment(String name, String version) {
        try {
            ResponseEntity<String> res = controlPlane.createDeployment(name, version);
            if (!res.getStatusCode().is2xxSuccessful() || res.getBody() == null) {
                return null;
            }
            return mapper.readTree(res.getBody()).path("id").asText(null);
        } catch (Exception e) {
            log.debug("Could not register deployment for {}@{} with the Control Plane", name, version, e);
            return null;
        }
    }

    private void reportDeploymentState(String deploymentId, String state) {
        if (deploymentId == null) {
            return;
        }
        try {
            controlPlane.updateDeploymentState(deploymentId, state);
        } catch (Exception e) {
            log.debug("Could not report deployment {} state {} to the Control Plane", deploymentId, state, e);
        }
    }

    private static String cap(String s) {
        return s.length() <= MAX_OUTPUT_CHARS ? s : s.substring(s.length() - MAX_OUTPUT_CHARS);
    }
}

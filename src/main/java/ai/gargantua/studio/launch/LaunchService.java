package ai.gargantua.studio.launch;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Runs the (admin-configurable) command that starts a published agent — today a
 * {@code docker compose} invocation, but the template is deliberately generic so it can
 * become {@code kubectl} or anything else without a code change.
 *
 * <p>The runtime cannot hot-swap which agent it serves (ADR-001: one process, one agent,
 * config bound at startup), so "launch" means (re)starting the runtime container pointed
 * at the freshly published bundle. The Control Plane does not track runtime instances
 * (ADR-004), which is why this lives here rather than there.
 *
 * <p>Security: {@code name}/{@code version} are substituted into a shell command, so they
 * are validated against a strict allow-list first. This endpoint executes arbitrary
 * configured commands with the backend's privileges — it is for local/dev use, never for
 * an exposed deployment.
 */
@Service
public class LaunchService {

    static final String TEMPLATE_KEY = "launch.command-template";

    /** Names/versions come from user-editable form fields — keep them shell-safe. */
    private static final Pattern SAFE = Pattern.compile("^[A-Za-z0-9._-]+$");
    private static final int MAX_OUTPUT_CHARS = 8000;
    private static final long TIMEOUT_MINUTES = 5;

    private final SettingsStore settings;
    private final String defaultTemplate;
    private final String workdir;

    public LaunchService(
            SettingsStore settings,
            @Value("${gargantua.launch.command-template}") String defaultTemplate,
            @Value("${gargantua.launch.workdir}") String workdir) {
        this.settings = settings;
        this.defaultTemplate = defaultTemplate;
        this.workdir = workdir;
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
        String command = commandTemplate()
                .replace("{name}", name)
                .replace("{version}", version);
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

    private static String cap(String s) {
        return s.length() <= MAX_OUTPUT_CHARS ? s : s.substring(s.length() - MAX_OUTPUT_CHARS);
    }
}

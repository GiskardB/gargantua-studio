package ai.gargantua.studio.controlplane;

import ai.gargantua.studio.common.NotFoundException;
import ai.gargantua.studio.launch.SettingsStore;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Studio can point at more than one Control Plane — think "one config per deploy
 * environment" (a local one, a shared dev one, a customer's own). This is the registry
 * of them: a list persisted via {@link SettingsStore} (same table the launch command
 * template and port allocations live in) plus which one is "active" right now.
 * {@link ControlPlaneClient} resolves every call against whichever is active — so
 * switching is instant, no restart, and every existing read/publish/launch path is
 * automatically multi-Control-Plane-aware without itself knowing it.
 *
 * <p>First run seeds one config from the {@code gargantua.control-plane.base-url}
 * property, so a Studio that was already pointed at a single Control Plane keeps working
 * unchanged — this registry is additive, not a breaking migration.
 */
@Service
public class ControlPlaneRegistry {

    private static final Logger log = LoggerFactory.getLogger(ControlPlaneRegistry.class);
    private static final String CONFIGS_KEY = "control-plane.configs";
    private static final String ACTIVE_KEY = "control-plane.active-id";

    private final SettingsStore settings;
    private final ObjectMapper mapper;
    private final String bootstrapBaseUrl;

    public ControlPlaneRegistry(
            SettingsStore settings,
            ObjectMapper mapper,
            @Value("${gargantua.control-plane.base-url:http://localhost:8080}") String bootstrapBaseUrl) {
        this.settings = settings;
        this.mapper = mapper;
        this.bootstrapBaseUrl = bootstrapBaseUrl;
    }

    public record Config(String id, String name, String baseUrl) {
    }

    public synchronized List<Config> list() {
        return List.copyOf(loadState().configs);
    }

    public synchronized Config create(String name, String baseUrl) {
        State state = loadState();
        Config config = new Config(UUID.randomUUID().toString(), name, normalize(baseUrl));
        state.configs.add(config);
        if (state.activeId == null) {
            state.activeId = config.id();
        }
        save(state);
        return config;
    }

    public synchronized Config update(String id, String name, String baseUrl) {
        State state = loadState();
        find(state, id);
        Config updated = new Config(id, name, normalize(baseUrl));
        state.configs.replaceAll(c -> c.id().equals(id) ? updated : c);
        save(state);
        return updated;
    }

    /** Deleting the active config falls back to whatever is left, or disconnects entirely. */
    public synchronized void delete(String id) {
        State state = loadState();
        find(state, id);
        state.configs.removeIf(c -> c.id().equals(id));
        if (id.equals(state.activeId)) {
            state.activeId = state.configs.isEmpty() ? null : state.configs.get(0).id();
        }
        save(state);
    }

    public synchronized Config activate(String id) {
        State state = loadState();
        Config config = find(state, id);
        state.activeId = id;
        save(state);
        return config;
    }

    /**
     * Explicit "disconnect" — unlike {@link #delete}, the configs stay on record, just
     * none of them is active. Callers of {@link ControlPlaneClient} must not silently
     * fall back to some default here: no active Control Plane means exactly that.
     */
    public synchronized void deactivate() {
        State state = loadState();
        state.activeId = null;
        save(state);
    }

    public synchronized Optional<Config> active() {
        State state = loadState();
        return state.configs.stream().filter(c -> c.id().equals(state.activeId)).findFirst();
    }

    public synchronized String activeId() {
        return loadState().activeId;
    }

    /** Empty when nothing is connected (explicitly disconnected, or none configured yet). */
    public Optional<String> activeBaseUrl() {
        return active().map(Config::baseUrl);
    }

    private static Config find(State state, String id) {
        return state.configs.stream().filter(c -> c.id().equals(id)).findFirst()
                .orElseThrow(() -> new NotFoundException("control plane config '" + id + "' not found"));
    }

    private static String normalize(String url) {
        return url == null ? "" : url.strip().replaceAll("/+$", "");
    }

    private State loadState() {
        Optional<String> configsJson = settings.get(CONFIGS_KEY);
        if (configsJson.isEmpty()) {
            return seedDefault();
        }
        try {
            List<Config> configs = new ArrayList<>(
                    mapper.readValue(configsJson.get(), new TypeReference<List<Config>>() { }));
            // Stored as "" for "explicitly disconnected" (SettingsStore has no delete —
            // see #save); read back as null so `active()` treats it the same as unset.
            return new State(configs, settings.get(ACTIVE_KEY).filter(s -> !s.isBlank()).orElse(null));
        } catch (Exception e) {
            log.warn("Corrupt control-plane configuration, resetting to the bootstrap default: {}", e.getMessage());
            return seedDefault();
        }
    }

    private State seedDefault() {
        Config seeded = new Config(UUID.randomUUID().toString(), "default", bootstrapBaseUrl);
        State state = new State(new ArrayList<>(List.of(seeded)), seeded.id());
        save(state);
        return state;
    }

    private void save(State state) {
        try {
            settings.put(CONFIGS_KEY, mapper.writeValueAsString(state.configs));
            settings.put(ACTIVE_KEY, state.activeId == null ? "" : state.activeId);
        } catch (Exception e) {
            log.warn("Could not persist control-plane configuration", e);
        }
    }

    private static final class State {
        final List<Config> configs;
        String activeId;

        State(List<Config> configs, String activeId) {
            this.configs = configs;
            this.activeId = activeId;
        }
    }
}

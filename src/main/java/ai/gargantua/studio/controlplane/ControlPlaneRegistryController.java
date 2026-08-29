package ai.gargantua.studio.controlplane;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * CRUD + "connect" for the Control Planes this Studio knows about (see
 * {@link ControlPlaneRegistry}). Every other {@code /api/studio/*} endpoint that talks
 * to a Control Plane goes through whichever one {@link #activate} last selected —
 * there's no per-request "which one" parameter anywhere else, switching here is global.
 */
@RestController
@RequestMapping("/api/studio/control-planes")
public class ControlPlaneRegistryController {

    private final ControlPlaneRegistry registry;

    public ControlPlaneRegistryController(ControlPlaneRegistry registry) {
        this.registry = registry;
    }

    public record ConfigRequest(String name, String baseUrl) {
    }

    public record ConfigView(String id, String name, String baseUrl, boolean active) {
    }

    @GetMapping
    public List<ConfigView> list() {
        String activeId = registry.activeId();
        return registry.list().stream().map(c -> toView(c, activeId)).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ConfigView create(@RequestBody ConfigRequest request) {
        return toView(registry.create(request.name(), request.baseUrl()), registry.activeId());
    }

    @PutMapping("/{id}")
    public ConfigView update(@PathVariable String id, @RequestBody ConfigRequest request) {
        return toView(registry.update(id, request.name(), request.baseUrl()), registry.activeId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        registry.delete(id);
    }

    /** Makes this the Control Plane every other Studio call resolves against, from now on. */
    @PostMapping("/{id}/activate")
    public ConfigView activate(@PathVariable String id) {
        return toView(registry.activate(id), id);
    }

    /** Explicit disconnect — configs stay on record, but no Studio call has anywhere to go. */
    @PostMapping("/deactivate")
    public void deactivate() {
        registry.deactivate();
    }

    private static ConfigView toView(ControlPlaneRegistry.Config config, String activeId) {
        return new ConfigView(config.id(), config.name(), config.baseUrl(), config.id().equals(activeId));
    }
}

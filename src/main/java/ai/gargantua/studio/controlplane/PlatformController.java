package ai.gargantua.studio.controlplane;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-through view of real platform state for the Studio UI: bundles/workloads,
 * capabilities, policies and deployments as the Control Plane reports them. Each
 * endpoint relays the Control Plane's JSON so the designer shows what is actually
 * published, not a mock. If the Control Plane is down these return 502 and the UI
 * falls back to an offline view.
 */
@RestController
@RequestMapping(value = "/api/studio", produces = MediaType.APPLICATION_JSON_VALUE)
public class PlatformController {

    private final ControlPlaneClient controlPlane;

    public PlatformController(ControlPlaneClient controlPlane) {
        this.controlPlane = controlPlane;
    }

    @GetMapping("/workloads")
    public ResponseEntity<String> workloads() {
        return controlPlane.get("/api/v1/registry/bundles");
    }

    @GetMapping("/capabilities")
    public ResponseEntity<String> capabilities() {
        return controlPlane.get("/api/v1/catalog/capabilities");
    }

    @GetMapping("/policies")
    public ResponseEntity<String> policies() {
        return controlPlane.get("/api/v1/policies");
    }

    @GetMapping("/deployments")
    public ResponseEntity<String> deployments() {
        return controlPlane.get("/api/v1/deployments");
    }

    /** Control Plane's own liveness, relayed so the UI can tell it apart from the Studio backend. */
    @GetMapping("/control-plane/health")
    public ResponseEntity<String> controlPlaneHealth() {
        return controlPlane.get("/actuator/health");
    }

    /** Delete a published workload version. 409 if the Control Plane still has it deployed. */
    @DeleteMapping("/workloads/{name}/{version}")
    public ResponseEntity<String> deleteWorkload(@PathVariable String name, @PathVariable String version) {
        return controlPlane.delete("/api/v1/registry/bundles/" + name + "/" + version);
    }

    /** Clears a deployment record, unblocking a workload delete that 409'd on "still deployed". */
    @DeleteMapping("/deployments/{id}")
    public ResponseEntity<String> deleteDeployment(@PathVariable String id) {
        return controlPlane.delete("/api/v1/deployments/" + id);
    }
}

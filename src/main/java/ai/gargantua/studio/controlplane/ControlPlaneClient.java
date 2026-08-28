package ai.gargantua.studio.controlplane;

import ai.gargantua.studio.common.UpstreamException;
import java.util.Map;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/**
 * Thin client for the Control Plane API. It relays the Control Plane's own responses —
 * body and status — back to the Studio UI, and only translates a genuine connectivity
 * failure into an {@link UpstreamException} (502). The Studio never owns platform state;
 * it reads it here (ADR-004).
 */
@Component
public class ControlPlaneClient {

    private final RestClient client;

    public ControlPlaneClient(RestClient controlPlaneRestClient) {
        this.client = controlPlaneRestClient;
    }

    /** GET a Control Plane resource and relay its JSON response verbatim. */
    public ResponseEntity<String> get(String path) {
        try {
            return client.get()
                    .uri(path)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> { })
                    .toEntity(String.class);
        } catch (ResourceAccessException e) {
            throw new UpstreamException("Control Plane unreachable for GET " + path, e);
        }
    }

    /** GET a non-JSON Control Plane resource (e.g. the raw manifest YAML) as text. */
    public ResponseEntity<String> getText(String path) {
        try {
            return client.get()
                    .uri(path)
                    .accept(MediaType.ALL)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> { })
                    .toEntity(String.class);
        } catch (ResourceAccessException e) {
            throw new UpstreamException("Control Plane unreachable for GET " + path, e);
        }
    }

    /** DELETE a Control Plane resource and relay its status (204, 404, or 409 if still deployed). */
    public ResponseEntity<String> delete(String path) {
        try {
            return client.delete()
                    .uri(path)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> { })
                    .toEntity(String.class);
        } catch (ResourceAccessException e) {
            throw new UpstreamException("Control Plane unreachable for DELETE " + path, e);
        }
    }

    /** Publish a manifest to the Registry, relaying the Control Plane's status and body. */
    public ResponseEntity<String> publishManifest(String manifestYaml) {
        return publishManifest(manifestYaml, Map.of(), Map.of());
    }

    /** Publish a manifest plus the raw {@code SKILL.md} content per skill name. */
    public ResponseEntity<String> publishManifest(String manifestYaml, Map<String, String> skillFiles) {
        return publishManifest(manifestYaml, skillFiles, Map.of());
    }

    /**
     * Publish a manifest plus the raw {@code SKILL.md} content per skill name and, per
     * skill, any text reference files (filename -> content) — the Control Plane writes
     * these to {@code skills/<name>/references/<filename>} in the {@code .gbundle} it
     * assembles, which is what the Runtime's FilesystemSkillRegistry reads at load time.
     */
    public ResponseEntity<String> publishManifest(
            String manifestYaml, Map<String, String> skillFiles, Map<String, Map<String, String>> skillReferenceFiles) {
        try {
            return client.post()
                    .uri("/api/v1/registry/bundles")
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "manifest", manifestYaml,
                            "skillFiles", skillFiles,
                            "skillReferenceFiles", skillReferenceFiles))
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> { })
                    .toEntity(String.class);
        } catch (ResourceAccessException e) {
            throw new UpstreamException("Control Plane unreachable for publish", e);
        }
    }
}

package ai.gargantua.studio.manifest;

import ai.gargantua.studio.controlplane.ControlPlaneClient;
import ai.gargantua.studio.manifest.ManifestBuilder.BuildResult;
import ai.gargantua.studio.skill.SkillBuilder;
import ai.gargantua.studio.skill.SkillDraftRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Manifest use cases for the Studio: build the canonical YAML from a form draft,
 * validate a draft, and publish a valid draft to the Control Plane Registry. All three
 * run the draft through {@link ManifestBuilder}, so the shared domain model is the one
 * authority on what a valid agent is.
 */
@RestController
@RequestMapping("/api/studio")
public class ManifestController {

    private final ManifestBuilder builder;
    private final SkillBuilder skillBuilder;
    private final ControlPlaneClient controlPlane;

    public ManifestController(ManifestBuilder builder, SkillBuilder skillBuilder,
                              ControlPlaneClient controlPlane) {
        this.builder = builder;
        this.skillBuilder = skillBuilder;
        this.controlPlane = controlPlane;
    }

    /** Build the manifest. Always 200: the body says whether it is valid and, if so, the YAML. */
    @PostMapping("/manifest/build")
    public BuildResult build(@RequestBody AgentDraftRequest draft) {
        return builder.build(draft);
    }

    /** Validate only — same result, used by the UI to surface problems as the user types. */
    @PostMapping("/manifest/validate")
    public BuildResult validate(@RequestBody AgentDraftRequest draft) {
        return builder.build(draft);
    }

    /**
     * Build then publish to the Control Plane Registry. Returns 400 with the validation
     * errors if the draft is invalid; otherwise relays the Registry's response (201 on
     * success, 409 if that {@code name@version} is already published).
     */
    @PostMapping("/publish")
    public ResponseEntity<?> publish(@RequestBody AgentDraftRequest draft) {
        BuildResult result = builder.build(draft);
        if (!result.valid()) {
            return ResponseEntity.badRequest().body(result);
        }
        BuildResult skillErrors = renderSkills(draft);
        if (skillErrors != null) {
            return ResponseEntity.badRequest().body(skillErrors);
        }
        Map<String, String> skillFiles = renderedSkillFiles(draft);
        ResponseEntity<String> cp = controlPlane.publishManifest(result.yaml(), skillFiles);
        return ResponseEntity.status(cp.getStatusCode())
                .contentType(MediaType.APPLICATION_JSON)
                .body(cp.getBody());
    }

    /** Render each skill draft to SKILL.md; returns null if all valid, else the first failure. */
    private BuildResult renderSkills(AgentDraftRequest draft) {
        for (SkillDraftRequest skill : draft.skills()) {
            SkillBuilder.BuildResult r = skillBuilder.build(skill);
            if (!r.valid()) {
                return new BuildResult(false, null, r.errors());
            }
        }
        return null;
    }

    private Map<String, String> renderedSkillFiles(AgentDraftRequest draft) {
        Map<String, String> files = new LinkedHashMap<>();
        for (SkillDraftRequest skill : draft.skills()) {
            files.put(skill.name(), skillBuilder.build(skill).markdown());
        }
        return files;
    }
}

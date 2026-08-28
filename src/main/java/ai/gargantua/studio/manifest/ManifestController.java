package ai.gargantua.studio.manifest;

import ai.gargantua.bundle.ManifestParser;
import ai.gargantua.core.workload.WorkloadManifest;
import ai.gargantua.studio.common.NotFoundException;
import ai.gargantua.studio.controlplane.ControlPlaneClient;
import ai.gargantua.studio.manifest.ManifestBuilder.BuildResult;
import ai.gargantua.studio.skill.SkillBuilder;
import ai.gargantua.studio.skill.SkillDraftRequest;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
    private final BundleZipBuilder bundleZipBuilder;

    public ManifestController(ManifestBuilder builder, SkillBuilder skillBuilder,
                              ControlPlaneClient controlPlane, BundleZipBuilder bundleZipBuilder) {
        this.builder = builder;
        this.skillBuilder = skillBuilder;
        this.controlPlane = controlPlane;
        this.bundleZipBuilder = bundleZipBuilder;
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
        Map<String, Map<String, String>> skillReferenceFiles = referenceFiles(draft);
        ResponseEntity<String> cp = controlPlane.publishManifest(result.yaml(), skillFiles, skillReferenceFiles);
        return ResponseEntity.status(cp.getStatusCode())
                .contentType(MediaType.APPLICATION_JSON)
                .body(cp.getBody());
    }

    /**
     * Build the exact {@code .gbundle} the Control Plane would assemble on publish, and
     * stream it back for direct download — entirely locally, no Control Plane involved.
     * Lets the Studio be used standalone: inspect or hand the bundle to a Runtime
     * yourself without any other Gargantua service running. 400 with the same
     * validation-error shape as {@code /publish} if the draft (or a skill) is invalid.
     */
    @PostMapping("/bundle")
    public ResponseEntity<?> bundle(@RequestBody AgentDraftRequest draft) {
        BuildResult result = builder.build(draft);
        if (!result.valid()) {
            return ResponseEntity.badRequest().body(result);
        }
        BuildResult skillErrors = renderSkills(draft);
        if (skillErrors != null) {
            return ResponseEntity.badRequest().body(skillErrors);
        }
        byte[] zip = bundleZipBuilder.build(result.yaml(), renderedSkillFiles(draft), referenceFiles(draft));
        String name = draft.metadata() != null && draft.metadata().name() != null
                ? draft.metadata().name() : "agent";
        String version = draft.metadata() != null && draft.metadata().version() != null
                ? draft.metadata().version() : "0.0.0";
        String filename = name + "-" + version + ".gbundle";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build().toString())
                .body(zip);
    }

    /**
     * Fetch a published workload's manifest from the Control Plane and turn it back into
     * a form draft, so the Agent Designer can open an existing workload for editing
     * instead of just showing its name. 404 if the version isn't published.
     */
    @GetMapping("/workloads/{name}/{version}/draft")
    public AgentDraftRequest workloadDraft(@PathVariable String name, @PathVariable String version) {
        ResponseEntity<String> cp = controlPlane.getText(
                "/api/v1/registry/bundles/" + name + "/" + version + "/manifest");
        if (cp.getStatusCode().value() == HttpStatus.NOT_FOUND.value()) {
            throw new NotFoundException("workload " + name + "@" + version + " not found");
        }
        if (!cp.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException("Control Plane returned " + cp.getStatusCode() + " for the manifest");
        }
        WorkloadManifest manifest = ManifestParser.parse(cp.getBody());
        return builder.toDraft(manifest);
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

    /** Per skill name, filename -> content — destined for skills/<name>/references/ in the zip. */
    private Map<String, Map<String, String>> referenceFiles(AgentDraftRequest draft) {
        Map<String, Map<String, String>> out = new LinkedHashMap<>();
        for (SkillDraftRequest skill : draft.skills()) {
            if (skill.referenceFiles().isEmpty()) {
                continue;
            }
            Map<String, String> files = new LinkedHashMap<>();
            for (SkillDraftRequest.ReferenceFile file : skill.referenceFiles()) {
                files.put(file.name(), file.content());
            }
            out.put(skill.name(), files);
        }
        return out;
    }
}

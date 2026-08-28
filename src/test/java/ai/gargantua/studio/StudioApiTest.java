package ai.gargantua.studio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.gargantua.studio.controlplane.ControlPlaneClient;
import ai.gargantua.studio.manifest.AgentDraftRequest;
import ai.gargantua.studio.manifest.AgentDraftRequest.Metadata;
import ai.gargantua.studio.skill.SkillDraftRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * End-to-end HTTP tests through the real context: manifest build/validate, publishing
 * (with the Control Plane mocked, since it runs as a separate service), platform
 * read-through, and draft persistence against the in-memory H2.
 */
@SpringBootTest
@AutoConfigureMockMvc
class StudioApiTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private ControlPlaneClient controlPlane;

    private final ObjectMapper json = new ObjectMapper();

    private AgentDraftRequest validDraft() {
        return new AgentDraftRequest(
                new Metadata("translator", "2.1.0", "Translates text", "platform", ""),
                null, null, List.of(), List.of(), List.of(), "", "", List.of(), null, null);
    }

    private AgentDraftRequest invalidDraft() {
        return new AgentDraftRequest(
                new Metadata("", "", "", "", ""),
                null, null, List.of(), List.of(), List.of(), "", "", List.of(), null, null);
    }

    @Test
    void buildReturnsValidYamlForAGoodDraft() throws Exception {
        mvc.perform(post("/api/studio/manifest/build")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(validDraft())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.yaml").isNotEmpty());
    }

    @Test
    void buildReportsErrorsForABadDraft() throws Exception {
        mvc.perform(post("/api/studio/manifest/build")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(invalidDraft())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.errors").isNotEmpty());
    }

    @Test
    void publishForwardsToControlPlaneWhenValid() throws Exception {
        when(controlPlane.publishManifest(anyString(), anyMap(), anyMap()))
                .thenReturn(ResponseEntity.status(201).body("{\"descriptor\":{\"name\":\"translator\"}}"));

        mvc.perform(post("/api/studio/publish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(validDraft())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.descriptor.name").value("translator"));
    }

    @Test
    void publishForwardsSkillReferenceFilesToControlPlane() throws Exception {
        when(controlPlane.publishManifest(anyString(), anyMap(), anyMap()))
                .thenReturn(ResponseEntity.status(201).body("{\"descriptor\":{\"name\":\"translator\"}}"));

        SkillDraftRequest.ReferenceFile refFile =
                new SkillDraftRequest.ReferenceFile("api-notes.md", "The API returns JSON.");
        SkillDraftRequest skill = new SkillDraftRequest(
                "translate-skill", "desc", "1.0.0", "", "", "", true, "", "", "", "",
                "", "", "", "", "", List.of(), "Translate the input.", List.of(refFile));
        AgentDraftRequest draft = new AgentDraftRequest(
                new Metadata("translator", "2.1.0", "Translates text", "platform", ""),
                null, null, List.of(), List.of(), List.of(), "", "", List.of(), null, null, List.of(skill));

        mvc.perform(post("/api/studio/publish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(draft)))
                .andExpect(status().isCreated());

        org.mockito.ArgumentCaptor<Map<String, Map<String, String>>> captor =
                org.mockito.ArgumentCaptor.forClass(Map.class);
        org.mockito.Mockito.verify(controlPlane).publishManifest(anyString(), anyMap(), captor.capture());
        assertThat(captor.getValue())
                .containsEntry("translate-skill", Map.of("api-notes.md", "The API returns JSON."));
    }

    @Test
    void publishRejectsAnInvalidDraftWithoutCallingControlPlane() throws Exception {
        mvc.perform(post("/api/studio/publish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(invalidDraft())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.valid").value(false));
    }

    @Test
    void bundleDownloadBuildsAZipWithoutTouchingControlPlane() throws Exception {
        SkillDraftRequest.ReferenceFile refFile =
                new SkillDraftRequest.ReferenceFile("api-notes.md", "The API returns JSON.");
        SkillDraftRequest skill = new SkillDraftRequest(
                "translate-skill", "desc", "1.0.0", "", "", "", true, "", "", "", "",
                "", "", "", "", "", List.of(), "Translate the input.", List.of(refFile));
        AgentDraftRequest draft = new AgentDraftRequest(
                new Metadata("translator", "2.1.0", "Translates text", "platform", ""),
                null, null, List.of(), List.of(), List.of(), "", "", List.of(), null, null, List.of(skill));

        byte[] zipBytes = mvc.perform(post("/api/studio/bundle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(draft)))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Content-Disposition", org.hamcrest.Matchers.containsString("translator-2.1.0.gbundle")))
                .andReturn().getResponse().getContentAsByteArray();

        Map<String, String> entries = new java.util.HashMap<>();
        try (var zin = new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(zipBytes))) {
            java.util.zip.ZipEntry e;
            while ((e = zin.getNextEntry()) != null) {
                entries.put(e.getName(), new String(zin.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
            }
        }
        assertThat(entries).containsKeys(
                "manifest.yaml", "skills/translate-skill/SKILL.md",
                "skills/translate-skill/references/api-notes.md");
        assertThat(entries.get("skills/translate-skill/references/api-notes.md"))
                .isEqualTo("The API returns JSON.");
        org.mockito.Mockito.verifyNoInteractions(controlPlane);
    }

    @Test
    void bundleDownloadRejectsAnInvalidDraft() throws Exception {
        mvc.perform(post("/api/studio/bundle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(invalidDraft())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.valid").value(false));
    }

    @Test
    void capabilitiesRelayTheControlPlaneResponse() throws Exception {
        when(controlPlane.get("/api/v1/catalog/capabilities"))
                .thenReturn(ResponseEntity.ok("[{\"name\":\"translate-text\"}]"));

        mvc.perform(get("/api/studio/capabilities"))
                .andExpect(status().isOk())
                .andExpect(content().json("[{\"name\":\"translate-text\"}]"));
    }

    @Test
    void deleteWorkloadRelaysToControlPlane() throws Exception {
        when(controlPlane.delete("/api/v1/registry/bundles/translator/2.1.0"))
                .thenReturn(ResponseEntity.noContent().build());

        mvc.perform(delete("/api/studio/workloads/translator/2.1.0"))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteWorkloadRelaysConflictWhenStillDeployed() throws Exception {
        when(controlPlane.delete("/api/v1/registry/bundles/translator/2.1.0"))
                .thenReturn(ResponseEntity.status(409).body("{\"message\":\"still deployed\"}"));

        mvc.perform(delete("/api/studio/workloads/translator/2.1.0"))
                .andExpect(status().isConflict());
    }

    @Test
    void workloadDraftParsesTheControlPlanesManifestIntoAForm() throws Exception {
        String manifest = """
                apiVersion: gargantua.ai/v1
                kind: Agent
                metadata:
                  name: translator
                  version: 2.1.0
                  owner: platform
                spec:
                  capabilities:
                    - name: translate-text
                      description: Translates text
                      version: 1.0.0
                """;
        when(controlPlane.getText("/api/v1/registry/bundles/translator/2.1.0/manifest"))
                .thenReturn(ResponseEntity.ok(manifest));

        mvc.perform(get("/api/studio/workloads/translator/2.1.0/draft"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metadata.name").value("translator"))
                .andExpect(jsonPath("$.metadata.version").value("2.1.0"))
                .andExpect(jsonPath("$.metadata.owner").value("platform"))
                .andExpect(jsonPath("$.capabilities[0].name").value("translate-text"));
    }

    @Test
    void workloadDraftIsNotFoundWhenControlPlaneHasNoSuchVersion() throws Exception {
        when(controlPlane.getText("/api/v1/registry/bundles/translator/9.9.9/manifest"))
                .thenReturn(ResponseEntity.status(404).body("{\"message\":\"not found\"}"));

        mvc.perform(get("/api/studio/workloads/translator/9.9.9/draft"))
                .andExpect(status().isNotFound());
    }

    @Test
    void skillsCanBeCreatedListedAndDuplicated() throws Exception {
        SkillDraftRequest skill = new SkillDraftRequest(
                "greeter-skill", "Greets the user", "1.0.0", "", "", "", true, "", "", "", "",
                "", "", "", "", "", List.of(), "Say hello.");

        String createResponse = mvc.perform(post("/api/studio/skills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(skill)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("greeter-skill"))
                .andReturn().getResponse().getContentAsString();
        String id = json.readTree(createResponse).get("id").asText();

        mvc.perform(get("/api/studio/skills"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("greeter-skill"));

        mvc.perform(post("/api/studio/skills/" + id + "/duplicate"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("greeter-skill-copy"));

        mvc.perform(get("/api/studio/skills"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void draftsCanBeCreatedThenListed() throws Exception {
        mvc.perform(post("/api/studio/drafts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(validDraft())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.name").value("translator"));

        mvc.perform(get("/api/studio/drafts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("translator"));
    }
}

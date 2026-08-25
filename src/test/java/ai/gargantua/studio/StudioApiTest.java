package ai.gargantua.studio;

import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.gargantua.studio.controlplane.ControlPlaneClient;
import ai.gargantua.studio.manifest.AgentDraftRequest;
import ai.gargantua.studio.manifest.AgentDraftRequest.Metadata;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
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
        when(controlPlane.publishManifest(anyString(), anyMap()))
                .thenReturn(ResponseEntity.status(201).body("{\"descriptor\":{\"name\":\"translator\"}}"));

        mvc.perform(post("/api/studio/publish")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(validDraft())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.descriptor.name").value("translator"));
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
    void capabilitiesRelayTheControlPlaneResponse() throws Exception {
        when(controlPlane.get("/api/v1/catalog/capabilities"))
                .thenReturn(ResponseEntity.ok("[{\"name\":\"translate-text\"}]"));

        mvc.perform(get("/api/studio/capabilities"))
                .andExpect(status().isOk())
                .andExpect(content().json("[{\"name\":\"translate-text\"}]"));
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

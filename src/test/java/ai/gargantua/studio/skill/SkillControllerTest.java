package ai.gargantua.studio.skill;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.gargantua.studio.controlplane.ControlPlaneClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class SkillControllerTest {

    @Autowired
    private MockMvc mvc;

    // Unused here, but the context wires ControlPlaneClient; mock it out like the other web tests.
    @MockitoBean
    private ControlPlaneClient controlPlane;

    private final ObjectMapper json = new ObjectMapper();

    @Test
    void buildReturnsSkillMdForAGoodDraft() throws Exception {
        SkillDraftRequest draft = new SkillDraftRequest(
                "clean-skill", "A well-formed skill.", "1.0.0", "some-tool",
                "", "", true, "", "", "", "", "", "", "", "", "",
                List.of(), "Body text.");

        mvc.perform(post("/api/studio/skill/build")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(draft)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.markdown").isNotEmpty());
    }

    @Test
    void buildReportsErrorsForABadDraft() throws Exception {
        SkillDraftRequest draft = new SkillDraftRequest(
                "", "", "", "", "", "", true, "", "", "", "", "", "", "", "", "",
                List.of(), "");

        mvc.perform(post("/api/studio/skill/build")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(draft)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.errors").isNotEmpty());
    }
}

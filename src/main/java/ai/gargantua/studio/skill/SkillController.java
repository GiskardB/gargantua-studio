package ai.gargantua.studio.skill;

import ai.gargantua.studio.skill.SkillBuilder.BuildResult;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Skill use cases: build the canonical {@code SKILL.md} from a form draft, and
 * validate a draft. Unlike the manifest, a skill is not published to the Control
 * Plane Registry — it is bundle content the Runtime loads from {@code skills/<name>/}.
 */
@RestController
@RequestMapping("/api/studio/skill")
public class SkillController {

    private final SkillBuilder builder;

    public SkillController(SkillBuilder builder) {
        this.builder = builder;
    }

    /** Build the SKILL.md. Always 200: the body says whether it is valid and, if so, the markdown. */
    @PostMapping("/build")
    public BuildResult build(@RequestBody SkillDraftRequest draft) {
        return builder.build(draft);
    }

    @PostMapping("/validate")
    public BuildResult validate(@RequestBody SkillDraftRequest draft) {
        return builder.build(draft);
    }
}

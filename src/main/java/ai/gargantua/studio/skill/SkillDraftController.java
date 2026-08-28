package ai.gargantua.studio.skill;

import ai.gargantua.studio.skill.model.SavedSkill;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * CRUD over Skill Designer drafts, so authored skills survive a reload and can be
 * duplicated — mirrors {@link ai.gargantua.studio.drafts.DraftController}. A skill is
 * still not published to the Registry; this is durable editing state only.
 */
@RestController
@RequestMapping("/api/studio/skills")
public class SkillDraftController {

    private final SkillService skills;

    public SkillDraftController(SkillService skills) {
        this.skills = skills;
    }

    @GetMapping
    public List<SavedSkill> list() {
        return skills.list();
    }

    @GetMapping("/{id}")
    public SavedSkill get(@PathVariable String id) {
        return skills.get(id);
    }

    @PostMapping
    public ResponseEntity<SavedSkill> create(@RequestBody SkillDraftRequest draft) {
        return ResponseEntity.status(HttpStatus.CREATED).body(skills.create(draft));
    }

    @PutMapping("/{id}")
    public SavedSkill update(@PathVariable String id, @RequestBody SkillDraftRequest draft) {
        return skills.update(id, draft);
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<SavedSkill> duplicate(@PathVariable String id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(skills.duplicate(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        skills.delete(id);
        return ResponseEntity.noContent().build();
    }
}

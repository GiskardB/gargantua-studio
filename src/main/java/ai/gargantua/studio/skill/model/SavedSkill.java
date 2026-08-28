package ai.gargantua.studio.skill.model;

import ai.gargantua.studio.skill.SkillDraftRequest;
import java.time.Instant;

/**
 * A persisted Skill Designer draft: the raw form the user was editing, plus enough
 * identity to list and reopen it. Mirrors {@link ai.gargantua.studio.drafts.model.SavedDraft}
 * — a skill is not published to the Registry, but it is still worth keeping across a
 * reload, and "duplicate" is just another save under a new id.
 *
 * @param id        server-assigned identifier
 * @param name      skill name at save time, for listing
 * @param version   skill version at save time, for listing
 * @param updatedAt when this skill was last saved
 * @param draft     the form contents
 */
public record SavedSkill(
        String id,
        String name,
        String version,
        Instant updatedAt,
        SkillDraftRequest draft) {
}

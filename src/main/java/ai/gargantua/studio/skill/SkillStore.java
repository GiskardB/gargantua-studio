package ai.gargantua.studio.skill;

import ai.gargantua.studio.skill.model.SavedSkill;
import java.util.List;
import java.util.Optional;

/**
 * Persistence port for Skill Designer drafts. The default adapter is durable
 * ({@link JdbcSkillStore} over H2/Postgres); {@link InMemorySkillStore} is the test
 * double. Mirrors {@link ai.gargantua.studio.drafts.DraftStore} exactly.
 */
public interface SkillStore {

    SavedSkill save(SavedSkill skill);

    Optional<SavedSkill> findById(String id);

    List<SavedSkill> findAll();

    boolean delete(String id);
}

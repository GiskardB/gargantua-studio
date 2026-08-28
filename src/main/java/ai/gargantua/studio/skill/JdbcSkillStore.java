package ai.gargantua.studio.skill;

import ai.gargantua.studio.skill.model.SavedSkill;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * Durable {@link SkillStore} that keeps each skill as one JSON row in
 * {@code studio_skill}. Mirrors {@link ai.gargantua.studio.drafts.JdbcDraftStore}.
 */
@Repository
public class JdbcSkillStore implements SkillStore {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public JdbcSkillStore(JdbcTemplate jdbc, ObjectMapper documentObjectMapper) {
        this.jdbc = jdbc;
        this.mapper = documentObjectMapper;
    }

    @Override
    @Transactional
    public SavedSkill save(SavedSkill skill) {
        String doc = serialize(skill);
        int updated = jdbc.update("UPDATE studio_skill SET doc = ? WHERE id = ?", doc, skill.id());
        if (updated == 0) {
            jdbc.update("INSERT INTO studio_skill (id, doc) VALUES (?, ?)", skill.id(), doc);
        }
        return skill;
    }

    @Override
    public Optional<SavedSkill> findById(String id) {
        List<SavedSkill> found = jdbc.query(
                "SELECT doc FROM studio_skill WHERE id = ?",
                (rs, n) -> deserialize(rs.getString(1)),
                id);
        return found.stream().findFirst();
    }

    @Override
    public List<SavedSkill> findAll() {
        return jdbc.query("SELECT doc FROM studio_skill", (rs, n) -> deserialize(rs.getString(1)))
                .stream()
                .sorted(Comparator.comparing(SavedSkill::updatedAt).reversed())
                .toList();
    }

    @Override
    public boolean delete(String id) {
        return jdbc.update("DELETE FROM studio_skill WHERE id = ?", id) > 0;
    }

    private String serialize(SavedSkill skill) {
        try {
            return mapper.writeValueAsString(skill);
        } catch (Exception e) {
            throw new IllegalStateException("cannot serialize skill " + skill.id(), e);
        }
    }

    private SavedSkill deserialize(String doc) {
        try {
            return mapper.readValue(doc, SavedSkill.class);
        } catch (Exception e) {
            throw new IllegalStateException("cannot deserialize skill", e);
        }
    }
}

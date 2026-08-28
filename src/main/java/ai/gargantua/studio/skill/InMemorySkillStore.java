package ai.gargantua.studio.skill;

import ai.gargantua.studio.skill.model.SavedSkill;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory {@link SkillStore} used as a test double. Not a Spring bean — the durable
 * {@link JdbcSkillStore} is the wired adapter.
 */
public class InMemorySkillStore implements SkillStore {

    private final Map<String, SavedSkill> store = new ConcurrentHashMap<>();

    @Override
    public SavedSkill save(SavedSkill skill) {
        store.put(skill.id(), skill);
        return skill;
    }

    @Override
    public Optional<SavedSkill> findById(String id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public List<SavedSkill> findAll() {
        return store.values().stream()
                .sorted(Comparator.comparing(SavedSkill::updatedAt).reversed())
                .toList();
    }

    @Override
    public boolean delete(String id) {
        return store.remove(id) != null;
    }
}

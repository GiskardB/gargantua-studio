package ai.gargantua.studio.drafts;

import ai.gargantua.studio.drafts.model.SavedDraft;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

/**
 * In-memory {@link DraftStore} used as a test double. Not a Spring bean — the durable
 * {@link JdbcDraftStore} is the wired adapter.
 */
public class InMemoryDraftStore implements DraftStore {

    private final Map<String, SavedDraft> store = new ConcurrentHashMap<>();

    @Override
    public SavedDraft save(SavedDraft draft) {
        store.put(draft.id(), draft);
        return draft;
    }

    @Override
    public Optional<SavedDraft> findById(String id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public List<SavedDraft> findAll() {
        return store.values().stream()
                .sorted(Comparator.comparing(SavedDraft::updatedAt).reversed())
                .toList();
    }

    @Override
    public boolean delete(String id) {
        return store.remove(id) != null;
    }
}

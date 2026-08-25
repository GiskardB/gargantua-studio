package ai.gargantua.studio.drafts;

import ai.gargantua.studio.drafts.model.SavedDraft;
import java.util.List;
import java.util.Optional;

/**
 * Persistence port for Agent Designer drafts. The default adapter is durable
 * ({@link JdbcDraftStore} over H2/Postgres); {@link InMemoryDraftStore} is the test
 * double. Callers never know which is wired.
 */
public interface DraftStore {

    SavedDraft save(SavedDraft draft);

    Optional<SavedDraft> findById(String id);

    List<SavedDraft> findAll();

    boolean delete(String id);
}

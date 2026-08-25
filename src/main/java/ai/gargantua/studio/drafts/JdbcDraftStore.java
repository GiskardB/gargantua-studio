package ai.gargantua.studio.drafts;

import ai.gargantua.studio.drafts.model.SavedDraft;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * Durable {@link DraftStore} that keeps each draft as one JSON row in {@code studio_draft}.
 * The document-store shape (id + JSON blob) is portable across H2 (default) and Postgres
 * without a schema change, matching how the Control Plane persists its aggregates.
 */
@Repository
public class JdbcDraftStore implements DraftStore {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public JdbcDraftStore(JdbcTemplate jdbc, ObjectMapper documentObjectMapper) {
        this.jdbc = jdbc;
        this.mapper = documentObjectMapper;
    }

    @Override
    @Transactional
    public SavedDraft save(SavedDraft draft) {
        String doc = serialize(draft);
        int updated = jdbc.update("UPDATE studio_draft SET doc = ? WHERE id = ?", doc, draft.id());
        if (updated == 0) {
            jdbc.update("INSERT INTO studio_draft (id, doc) VALUES (?, ?)", draft.id(), doc);
        }
        return draft;
    }

    @Override
    public Optional<SavedDraft> findById(String id) {
        List<SavedDraft> found = jdbc.query(
                "SELECT doc FROM studio_draft WHERE id = ?",
                (rs, n) -> deserialize(rs.getString(1)),
                id);
        return found.stream().findFirst();
    }

    @Override
    public List<SavedDraft> findAll() {
        return jdbc.query("SELECT doc FROM studio_draft", (rs, n) -> deserialize(rs.getString(1)))
                .stream()
                .sorted(Comparator.comparing(SavedDraft::updatedAt).reversed())
                .toList();
    }

    @Override
    public boolean delete(String id) {
        return jdbc.update("DELETE FROM studio_draft WHERE id = ?", id) > 0;
    }

    private String serialize(SavedDraft draft) {
        try {
            return mapper.writeValueAsString(draft);
        } catch (Exception e) {
            throw new IllegalStateException("cannot serialize draft " + draft.id(), e);
        }
    }

    private SavedDraft deserialize(String doc) {
        try {
            return mapper.readValue(doc, SavedDraft.class);
        } catch (Exception e) {
            throw new IllegalStateException("cannot deserialize draft", e);
        }
    }
}

package ai.gargantua.studio.drafts;

import ai.gargantua.studio.common.NotFoundException;
import ai.gargantua.studio.drafts.model.SavedDraft;
import ai.gargantua.studio.manifest.AgentDraftRequest;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Draft use cases: create, list, reopen, update and delete Agent Designer drafts. The
 * server assigns the id and stamps {@code updatedAt}; the name/version are copied from
 * the draft metadata so a listing is legible without parsing every stored form.
 */
@Service
public class DraftService {

    private final DraftStore store;
    private final Clock clock;

    public DraftService(DraftStore store, Clock clock) {
        this.store = store;
        this.clock = clock;
    }

    public SavedDraft create(AgentDraftRequest draft) {
        return store.save(snapshot(UUID.randomUUID().toString(), draft));
    }

    public SavedDraft update(String id, AgentDraftRequest draft) {
        if (store.findById(id).isEmpty()) {
            throw new NotFoundException("no draft with id '" + id + "'");
        }
        return store.save(snapshot(id, draft));
    }

    public List<SavedDraft> list() {
        return store.findAll();
    }

    public SavedDraft get(String id) {
        return store.findById(id)
                .orElseThrow(() -> new NotFoundException("no draft with id '" + id + "'"));
    }

    public void delete(String id) {
        if (!store.delete(id)) {
            throw new NotFoundException("no draft with id '" + id + "'");
        }
    }

    private SavedDraft snapshot(String id, AgentDraftRequest draft) {
        String name = draft.metadata() == null ? null : draft.metadata().name();
        String version = draft.metadata() == null ? null : draft.metadata().version();
        return new SavedDraft(id, name, version, clock.instant(), draft);
    }
}

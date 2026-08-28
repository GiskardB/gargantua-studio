package ai.gargantua.studio.skill;

import ai.gargantua.studio.common.NotFoundException;
import ai.gargantua.studio.skill.model.SavedSkill;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Skill draft use cases: create, list, reopen, update, duplicate and delete. Mirrors
 * {@link ai.gargantua.studio.drafts.DraftService} — the server assigns the id and
 * stamps {@code updatedAt}; duplicate is a save under a fresh id.
 */
@Service
public class SkillService {

    private final SkillStore store;
    private final Clock clock;

    public SkillService(SkillStore store, Clock clock) {
        this.store = store;
        this.clock = clock;
    }

    public SavedSkill create(SkillDraftRequest draft) {
        return store.save(snapshot(UUID.randomUUID().toString(), draft));
    }

    public SavedSkill update(String id, SkillDraftRequest draft) {
        if (store.findById(id).isEmpty()) {
            throw new NotFoundException("no skill with id '" + id + "'");
        }
        return store.save(snapshot(id, draft));
    }

    /** Copies a skill under a new id, with "-copy" appended so duplicates are distinguishable. */
    public SavedSkill duplicate(String id) {
        SkillDraftRequest original = get(id).draft();
        String copyName = original.name() == null || original.name().isBlank()
                ? original.name() : original.name() + "-copy";
        return create(new SkillDraftRequest(
                copyName, original.description(), original.version(), original.allowedToolsText(),
                original.referencesText(), original.examplesText(), original.active(), original.domain(),
                original.outputSchema(), original.maxTokens(), original.temperature(),
                original.preferredModel(), original.knowledgeBase(), original.ragMaxResults(),
                original.ragMinScore(), original.allowedRolesText(), original.memoryLayers(),
                original.systemPrompt(), original.referenceFiles()));
    }

    public List<SavedSkill> list() {
        return store.findAll();
    }

    public SavedSkill get(String id) {
        return store.findById(id)
                .orElseThrow(() -> new NotFoundException("no skill with id '" + id + "'"));
    }

    public void delete(String id) {
        if (!store.delete(id)) {
            throw new NotFoundException("no skill with id '" + id + "'");
        }
    }

    private SavedSkill snapshot(String id, SkillDraftRequest draft) {
        String name = draft == null ? null : draft.name();
        String version = draft == null ? null : draft.version();
        return new SavedSkill(id, name, version, clock.instant(), draft);
    }
}

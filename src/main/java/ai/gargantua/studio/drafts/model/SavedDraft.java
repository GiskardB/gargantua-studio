package ai.gargantua.studio.drafts.model;

import ai.gargantua.studio.manifest.AgentDraftRequest;
import java.time.Instant;

/**
 * A persisted Agent Designer draft: the raw form the user was editing, plus enough
 * identity to list and reopen it. The draft is stored as-is (stringly form fields) so
 * reopening restores the exact editing state; the manifest is derived on demand.
 *
 * @param id        server-assigned identifier
 * @param name      workload name at save time, for listing
 * @param version   workload version at save time, for listing
 * @param updatedAt when this draft was last saved
 * @param draft     the form contents
 */
public record SavedDraft(
        String id,
        String name,
        String version,
        Instant updatedAt,
        AgentDraftRequest draft) {
}

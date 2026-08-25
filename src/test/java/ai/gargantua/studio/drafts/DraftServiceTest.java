package ai.gargantua.studio.drafts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ai.gargantua.studio.common.NotFoundException;
import ai.gargantua.studio.drafts.model.SavedDraft;
import ai.gargantua.studio.manifest.AgentDraftRequest;
import ai.gargantua.studio.manifest.AgentDraftRequest.Metadata;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DraftServiceTest {

    private DraftService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        service = new DraftService(new InMemoryDraftStore(), clock);
    }

    private AgentDraftRequest draft(String name, String version) {
        return new AgentDraftRequest(
                new Metadata(name, version, "", "", ""),
                null, null, List.of(), List.of(), List.of(), "", "", List.of(), null, null);
    }

    @Test
    void createAssignsIdAndCopiesNameForListing() {
        SavedDraft saved = service.create(draft("agent-a", "1.0.0"));
        assertThat(saved.id()).isNotBlank();
        assertThat(saved.name()).isEqualTo("agent-a");
        assertThat(saved.version()).isEqualTo("1.0.0");
        assertThat(saved.updatedAt()).isEqualTo(Instant.parse("2026-01-01T00:00:00Z"));
    }

    @Test
    void getReturnsWhatWasSaved() {
        SavedDraft saved = service.create(draft("agent-a", "1.0.0"));
        assertThat(service.get(saved.id()).draft().metadata().name()).isEqualTo("agent-a");
    }

    @Test
    void updatePreservesIdAndReplacesContent() {
        SavedDraft saved = service.create(draft("agent-a", "1.0.0"));
        SavedDraft updated = service.update(saved.id(), draft("agent-a", "2.0.0"));
        assertThat(updated.id()).isEqualTo(saved.id());
        assertThat(updated.version()).isEqualTo("2.0.0");
    }

    @Test
    void updatingAnUnknownDraftIsNotFound() {
        assertThatThrownBy(() -> service.update("ghost", draft("x", "1.0.0")))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void deleteRemovesItAndIsNotFoundAfterwards() {
        SavedDraft saved = service.create(draft("agent-a", "1.0.0"));
        service.delete(saved.id());
        assertThatThrownBy(() -> service.get(saved.id())).isInstanceOf(NotFoundException.class);
    }

    @Test
    void deletingAnUnknownDraftIsNotFound() {
        assertThatThrownBy(() -> service.delete("ghost")).isInstanceOf(NotFoundException.class);
    }
}

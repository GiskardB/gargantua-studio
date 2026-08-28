package ai.gargantua.studio.skill;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ai.gargantua.studio.common.NotFoundException;
import ai.gargantua.studio.skill.model.SavedSkill;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SkillServiceTest {

    private SkillService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        service = new SkillService(new InMemorySkillStore(), clock);
    }

    private SkillDraftRequest draft(String name, String version) {
        return new SkillDraftRequest(name, "desc", version, "", "", "", true, "", "", "", "",
                "", "", "", "", "", List.of(), "Do the thing.");
    }

    @Test
    void createAssignsIdAndCopiesNameForListing() {
        SavedSkill saved = service.create(draft("greeter-skill", "1.0.0"));
        assertThat(saved.id()).isNotBlank();
        assertThat(saved.name()).isEqualTo("greeter-skill");
        assertThat(saved.version()).isEqualTo("1.0.0");
        assertThat(saved.updatedAt()).isEqualTo(Instant.parse("2026-01-01T00:00:00Z"));
    }

    @Test
    void getReturnsWhatWasSaved() {
        SavedSkill saved = service.create(draft("greeter-skill", "1.0.0"));
        assertThat(service.get(saved.id()).draft().name()).isEqualTo("greeter-skill");
    }

    @Test
    void updatePreservesIdAndReplacesContent() {
        SavedSkill saved = service.create(draft("greeter-skill", "1.0.0"));
        SavedSkill updated = service.update(saved.id(), draft("greeter-skill", "2.0.0"));
        assertThat(updated.id()).isEqualTo(saved.id());
        assertThat(updated.version()).isEqualTo("2.0.0");
    }

    @Test
    void updatingAnUnknownSkillIsNotFound() {
        assertThatThrownBy(() -> service.update("ghost", draft("x", "1.0.0")))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void duplicateCreatesASecondSkillWithACopySuffix() {
        SavedSkill original = service.create(draft("greeter-skill", "1.0.0"));
        SavedSkill copy = service.duplicate(original.id());

        assertThat(copy.id()).isNotEqualTo(original.id());
        assertThat(copy.name()).isEqualTo("greeter-skill-copy");
        assertThat(copy.draft().systemPrompt()).isEqualTo(original.draft().systemPrompt());
        assertThat(service.list()).hasSize(2);
    }

    @Test
    void referenceFilesRoundTripThroughSaveAndDuplicate() {
        SkillDraftRequest.ReferenceFile file =
                new SkillDraftRequest.ReferenceFile("api-notes.md", "The API returns JSON.");
        SkillDraftRequest withFile = new SkillDraftRequest(
                "greeter-skill", "desc", "1.0.0", "", "", "", true, "", "", "", "",
                "", "", "", "", "", List.of(), "Do the thing.", List.of(file));

        SavedSkill saved = service.create(withFile);
        assertThat(saved.draft().referenceFiles()).containsExactly(file);

        SavedSkill copy = service.duplicate(saved.id());
        assertThat(copy.draft().referenceFiles()).containsExactly(file);
    }

    @Test
    void deleteRemovesItAndIsNotFoundAfterwards() {
        SavedSkill saved = service.create(draft("greeter-skill", "1.0.0"));
        service.delete(saved.id());
        assertThatThrownBy(() -> service.get(saved.id())).isInstanceOf(NotFoundException.class);
    }

    @Test
    void deletingAnUnknownSkillIsNotFound() {
        assertThatThrownBy(() -> service.delete("ghost")).isInstanceOf(NotFoundException.class);
    }
}

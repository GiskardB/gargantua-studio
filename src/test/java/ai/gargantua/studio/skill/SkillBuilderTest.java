package ai.gargantua.studio.skill;

import static org.assertj.core.api.Assertions.assertThat;

import ai.gargantua.studio.skill.SkillBuilder.BuildResult;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The interesting cases are that the emitted SKILL.md matches the exact frontmatter
 * keys the Runtime's SkillMdParser expects (docs/skills-and-routing.md), and that a
 * skill missing what the parser treats as required is rejected before it ever reaches
 * a bundle.
 */
class SkillBuilderTest {

    private final SkillBuilder builder = new SkillBuilder();

    private SkillDraftRequest full() {
        return new SkillDraftRequest(
                "weather-skill",
                "Answers weather-related questions using real-time data.",
                "1.2.0",
                "getWeather\ngetWeatherForecast",
                "ref1.txt\nref2.txt",
                "What's the weather in Rome?",
                true,
                "weather",
                "assets/schema.json",
                "1024",
                "0.2",
                "claude-sonnet-4-20250514",
                "weather-kb",
                "",
                "",
                "financial-advisor, super-admin",
                List.of("WORKING", "EPISODIC"),
                "You are a weather assistant. Always include the temperature unit.");
    }

    private SkillDraftRequest minimal() {
        return new SkillDraftRequest(
                "clean-skill", "A well-formed skill.", "1.0.0", "some-tool",
                "", "", true, "", "", "", "", "", "", "", "", "",
                List.of(), "Body text.");
    }

    @Test
    void buildsCanonicalSkillMdFromAFullDraft() {
        BuildResult result = builder.build(full());

        assertThat(result.valid()).isTrue();
        assertThat(result.errors()).isEmpty();
        String md = result.markdown();
        assertThat(md).startsWith("---\n");
        assertThat(md).contains("name: weather-skill");
        assertThat(md).contains("description: Answers weather-related questions using real-time data.");
        assertThat(md).contains("version: 1.2.0");
        assertThat(md).contains("allowed-tools:");
        assertThat(md).contains("- getWeather");
        assertThat(md).contains("metadata:");
        assertThat(md).contains("active: true");
        assertThat(md).contains("domain: weather");
        assertThat(md).contains("output-schema: assets/schema.json");
        assertThat(md).contains("max-tokens: 1024");
        assertThat(md).contains("temperature: 0.2");
        assertThat(md).contains("preferred-model: claude-sonnet-4-20250514");
        assertThat(md).contains("knowledge-base: weather-kb");
        assertThat(md).contains("rag-max-results: 5"); // RagConfig default
        assertThat(md).contains("rag-min-score: 0.3"); // RagConfig default
        assertThat(md).contains("allowed-roles:");
        assertThat(md).contains("memory-layers:");
        // frontmatter closes and the body follows verbatim as the system prompt.
        assertThat(md).endsWith("You are a weather assistant. Always include the temperature unit.\n");
        assertThat(md.split("---\n").length).isEqualTo(3); // opening, frontmatter body, then '---\n\n<prompt>'
    }

    @Test
    void minimalDraftProducesAValidSkill() {
        BuildResult result = builder.build(minimal());
        assertThat(result.valid()).isTrue();
        assertThat(result.markdown()).contains("name: clean-skill").contains("Body text.");
    }

    @Test
    void missingNameDescriptionVersionAreReportedTogether() {
        SkillDraftRequest bad = new SkillDraftRequest(
                "", "", "", "tool", "", "", true, "", "", "", "", "", "", "", "", "",
                List.of(), "body");
        BuildResult result = builder.build(bad);
        assertThat(result.valid()).isFalse();
        assertThat(result.errors())
                .anyMatch(e -> e.contains("name"))
                .anyMatch(e -> e.contains("description"))
                .anyMatch(e -> e.contains("version"));
    }

    @Test
    void aToolLessSkillIsValidAndEmitsEmptyAllowedTools() {
        // A skill with no tools is legitimate (the demo greeter-skill answers from the LLM
        // alone). It must build, emitting an explicit empty allowed-tools list.
        SkillDraftRequest noTools = new SkillDraftRequest(
                "s", "d", "1.0.0", "", "", "", true, "", "", "", "", "", "", "", "", "",
                List.of(), "body");
        BuildResult result = builder.build(noTools);
        assertThat(result.valid()).isTrue();
        assertThat(result.markdown()).contains("allowed-tools: []");
    }

    @Test
    void missingSystemPromptIsRejected() {
        SkillDraftRequest bad = new SkillDraftRequest(
                "s", "d", "1.0.0", "tool", "", "", true, "", "", "", "", "", "", "", "", "",
                List.of(), "");
        BuildResult result = builder.build(bad);
        assertThat(result.valid()).isFalse();
        assertThat(result.errors()).anyMatch(e -> e.contains("system prompt"));
    }

    @Test
    void nonNumericTemperatureIsRejected() {
        SkillDraftRequest bad = new SkillDraftRequest(
                "s", "d", "1.0.0", "tool", "", "", true, "", "", "", "hot", "", "", "", "", "",
                List.of(), "body");
        BuildResult result = builder.build(bad);
        assertThat(result.valid()).isFalse();
        assertThat(result.errors()).anyMatch(e -> e.contains("temperature"));
    }

    @Test
    void unknownMemoryLayerIsRejected() {
        SkillDraftRequest bad = new SkillDraftRequest(
                "s", "d", "1.0.0", "tool", "", "", true, "", "", "", "", "", "", "", "", "",
                List.of("NOT_A_LAYER"), "body");
        BuildResult result = builder.build(bad);
        assertThat(result.valid()).isFalse();
        assertThat(result.errors()).anyMatch(e -> e.contains("memory layer"));
    }
}

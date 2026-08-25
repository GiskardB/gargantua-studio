package ai.gargantua.studio.skill;

import java.util.List;

/**
 * The form-friendly draft the Skill Designer edits. Field names mirror the exact
 * {@code SKILL.md} frontmatter keys the Runtime's {@code SkillMdParser} reads (see
 * {@code docs/skills-and-routing.md} in the Runtime repo), so {@link SkillBuilder} can
 * emit a file the Runtime loads unmodified — this is the Anthropic Agent Skills format
 * (YAML frontmatter + markdown body), not a Gargantua invention.
 *
 * <p>Numbers and lists arrive as strings/comma-separated text, same convention as
 * {@link ai.gargantua.studio.manifest.AgentDraftRequest}: an input can be empty
 * mid-edit, and parsing happens only at build time.
 */
public record SkillDraftRequest(
        String name,
        String description,
        String version,
        String allowedToolsText,
        String referencesText,
        String examplesText,
        boolean active,
        String domain,
        String outputSchema,
        String maxTokens,
        String temperature,
        String preferredModel,
        String knowledgeBase,
        String ragMaxResults,
        String ragMinScore,
        String allowedRolesText,
        List<String> memoryLayers,
        String systemPrompt) {

    public SkillDraftRequest {
        memoryLayers = memoryLayers == null ? List.of() : memoryLayers;
    }
}

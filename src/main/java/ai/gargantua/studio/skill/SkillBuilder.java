package ai.gargantua.studio.skill;

import ai.gargantua.core.memory.MemoryLayer;
import ai.gargantua.core.rag.RagConfig;
import ai.gargantua.core.skill.SkillCard;
import ai.gargantua.core.skill.SkillMeta;
import ai.gargantua.core.skill.SkillSource;
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Turns a form {@link SkillDraftRequest} into a validated {@code SKILL.md} file: YAML
 * frontmatter (matching the Runtime's {@code SkillMdParser} field names exactly) plus
 * the markdown body as the system prompt. This is the Anthropic Agent Skills format —
 * a directory with a {@code SKILL.md} — not a Gargantua-specific one; the shared
 * agent-core records ({@link SkillMeta}, {@link SkillCard}) are what the Runtime
 * actually loads, so building against them keeps the Studio and the Runtime in lockstep.
 *
 * <p>A skill is bundle content, not a manifest field: it does not get published to the
 * Registry the way an agent manifest does. Once written, {@code SKILL.md} goes in the
 * bundle's {@code skills/<name>/} folder; a {@link ai.gargantua.core.capability.Capability}
 * in the manifest may then reference it by name via {@code implementedBy}.
 */
@Component
public class SkillBuilder {

    private final YAMLMapper yaml = YAMLMapper.builder()
            .disable(YAMLGenerator.Feature.WRITE_DOC_START_MARKER)
            .enable(YAMLGenerator.Feature.MINIMIZE_QUOTES)
            .build();

    /** Outcome of a build: either a valid SKILL.md, or the list of problems found. */
    public record BuildResult(boolean valid, String markdown, List<String> errors) {
        static BuildResult ok(String markdown) {
            return new BuildResult(true, markdown, List.of());
        }

        static BuildResult invalid(List<String> errors) {
            return new BuildResult(false, null, List.copyOf(errors));
        }
    }

    public BuildResult build(SkillDraftRequest draft) {
        List<String> errors = precheck(draft);
        if (!errors.isEmpty()) {
            return BuildResult.invalid(errors);
        }
        try {
            SkillCard card = toSkillCard(draft);
            return BuildResult.ok(toMarkdown(card));
        } catch (IllegalArgumentException e) {
            return BuildResult.invalid(List.of(e.getMessage()));
        }
    }

    // ---- validation -------------------------------------------------------------

    private List<String> precheck(SkillDraftRequest draft) {
        List<String> errors = new ArrayList<>();
        if (isBlank(draft.name())) {
            errors.add("name is required");
        }
        if (isBlank(draft.description())) {
            errors.add("description is required");
        }
        if (isBlank(draft.version())) {
            errors.add("version is required");
        }
        // A skill with no tools is valid: the Runtime loads it and answers from the LLM
        // alone (the demo greeter-skill does exactly this). Empty allowed-tools → [].
        if (isBlank(draft.systemPrompt())) {
            errors.add("the system prompt (markdown body) is required");
        }
        if (!isBlank(draft.maxTokens()) && parseInt(draft.maxTokens()) == null) {
            errors.add("max-tokens must be an integer");
        }
        if (!isBlank(draft.temperature()) && parseDouble(draft.temperature()) == null) {
            errors.add("temperature must be a number");
        }
        if (!isBlank(draft.ragMaxResults()) && parseInt(draft.ragMaxResults()) == null) {
            errors.add("rag-max-results must be an integer");
        }
        if (!isBlank(draft.ragMinScore()) && parseDouble(draft.ragMinScore()) == null) {
            errors.add("rag-min-score must be a number");
        }
        for (String layer : draft.memoryLayers()) {
            if (parseMemoryLayer(layer) == null) {
                errors.add("unknown memory layer '" + layer + "'");
            }
        }
        return errors;
    }

    // ---- draft -> records ---------------------------------------------------------

    private SkillCard toSkillCard(SkillDraftRequest draft) {
        SkillMeta meta = new SkillMeta(
                draft.name().trim(),
                draft.description().trim(),
                draft.version().trim(),
                draft.active(),
                !isBlank(draft.outputSchema()),
                isBlank(draft.domain()) ? "general" : draft.domain().trim(),
                SkillSource.FILESYSTEM,
                new LinkedHashSet<>(parseCsv(draft.allowedRolesText())));

        RagConfig rag = isBlank(draft.knowledgeBase())
                ? null
                : new RagConfig(
                        draft.knowledgeBase().trim(),
                        draft.ragMaxResults() == null || isBlank(draft.ragMaxResults())
                                ? 5 : parseInt(draft.ragMaxResults()),
                        draft.ragMinScore() == null || isBlank(draft.ragMinScore())
                                ? 0.3 : parseDouble(draft.ragMinScore()));

        return new SkillCard(
                meta,
                draft.systemPrompt().trim(),
                parseTools(draft.allowedToolsText()),
                trimToNull(draft.outputSchema()),
                parseLines(draft.referencesText()),
                parseInt(draft.maxTokens()),
                parseDouble(draft.temperature()),
                trimToNull(draft.preferredModel()),
                rag,
                memoryLayers(draft.memoryLayers()),
                parseLines(draft.examplesText()));
    }

    private Set<MemoryLayer> memoryLayers(List<String> layers) {
        Set<MemoryLayer> out = new LinkedHashSet<>();
        for (String l : layers) {
            MemoryLayer parsed = parseMemoryLayer(l);
            if (parsed != null) {
                out.add(parsed);
            }
        }
        return out;
    }

    // ---- records -> canonical SKILL.md --------------------------------------------

    private String toMarkdown(SkillCard card) {
        SkillMeta meta = card.meta();
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("name", meta.name());
        root.put("description", meta.description());
        root.put("version", meta.version());
        // Always emitted, [] when the skill declares no tools — matches the format the
        // Runtime's SkillMdParser reads for a tool-less skill.
        root.put("allowed-tools", new ArrayList<>(card.allowedTools()));
        if (!card.references().isEmpty()) {
            root.put("references", new ArrayList<>(card.references()));
        }
        if (!card.examples().isEmpty()) {
            root.put("examples", new ArrayList<>(card.examples()));
        }

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("active", meta.active());
        metadata.put("domain", meta.domain());
        putIfPresent(metadata, "output-schema", card.outputSchema());
        putIfPresent(metadata, "max-tokens", card.maxTokens());
        putIfPresent(metadata, "temperature", card.temperature());
        putIfPresent(metadata, "preferred-model", card.preferredModel());
        if (card.ragConfig() != null) {
            metadata.put("knowledge-base", card.ragConfig().knowledgeBase());
            metadata.put("rag-max-results", card.ragConfig().maxResults());
            metadata.put("rag-min-score", card.ragConfig().minScore());
        }
        if (!meta.allowedRoles().isEmpty()) {
            metadata.put("allowed-roles", new ArrayList<>(meta.allowedRoles()));
        }
        if (card.enabledMemoryLayers() != null && !card.enabledMemoryLayers().isEmpty()) {
            List<String> layers = new ArrayList<>();
            card.enabledMemoryLayers().forEach(l -> layers.add(l.name().toLowerCase()));
            metadata.put("memory-layers", layers);
        }
        root.put("metadata", metadata);

        String frontmatter;
        try {
            frontmatter = yaml.writeValueAsString(root).stripTrailing();
        } catch (Exception e) {
            throw new IllegalStateException("cannot serialize SKILL.md frontmatter", e);
        }

        return "---\n" + frontmatter + "\n---\n\n" + card.systemPrompt() + "\n";
    }

    private static void putIfPresent(Map<String, Object> map, String key, Object value) {
        if (value != null && !(value instanceof String s && s.isBlank())) {
            map.put(key, value);
        }
    }

    // ---- parsing helpers ----------------------------------------------------------

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static Double parseDouble(String s) {
        if (isBlank(s)) {
            return null;
        }
        try {
            return Double.valueOf(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer parseInt(String s) {
        if (isBlank(s)) {
            return null;
        }
        try {
            return Integer.valueOf(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Comma-separated list → trimmed, non-empty items in order. */
    private static List<String> parseCsv(String csv) {
        List<String> out = new ArrayList<>();
        if (isBlank(csv)) {
            return out;
        }
        for (String part : csv.split(",")) {
            String t = part.trim();
            if (!t.isEmpty()) {
                out.add(t);
            }
        }
        return out;
    }

    /** One item per line, matching how the parser accepts a whitespace/line list of tools. */
    private static List<String> parseTools(String text) {
        List<String> out = new ArrayList<>();
        if (isBlank(text)) {
            return out;
        }
        for (String line : text.split("[\\r\\n,]+")) {
            String t = line.trim();
            if (!t.isEmpty()) {
                out.add(t);
            }
        }
        return out;
    }

    private static List<String> parseLines(String text) {
        List<String> out = new ArrayList<>();
        if (isBlank(text)) {
            return out;
        }
        for (String line : text.split("\\r?\\n")) {
            String t = line.trim();
            if (!t.isEmpty()) {
                out.add(t);
            }
        }
        return out;
    }

    private static MemoryLayer parseMemoryLayer(String s) {
        if (isBlank(s)) {
            return null;
        }
        try {
            return MemoryLayer.valueOf(s.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}

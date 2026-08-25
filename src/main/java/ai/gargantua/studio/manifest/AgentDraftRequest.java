package ai.gargantua.studio.manifest;

import ai.gargantua.studio.skill.SkillDraftRequest;
import java.util.List;

/**
 * The form-friendly draft the Studio's Agent Designer edits, sent verbatim to the
 * backend. Fields are deliberately stringly: numbers arrive as strings (an input can
 * be empty mid-edit), and a few areas are free text that the {@link ManifestBuilder}
 * parses only at build time (labels, env, tags, args). This is the same shape the
 * frontend used to turn into YAML locally — now the backend owns that logic, against
 * the shared domain model.
 *
 * <p>Every collection defaults to empty so a partially-filled draft never NPEs.
 */
public record AgentDraftRequest(
        Metadata metadata,
        Runtime runtime,
        Model model,
        List<Capability> capabilities,
        List<McpServer> mcpServers,
        List<String> memoryLayers,
        String defaultSkill,
        String allowedRolesText,
        List<Guardrail> guardrails,
        Loadout loadout,
        Governance governance,
        List<SkillDraftRequest> skills) {

    public AgentDraftRequest {
        capabilities = capabilities == null ? List.of() : capabilities;
        mcpServers = mcpServers == null ? List.of() : mcpServers;
        memoryLayers = memoryLayers == null ? List.of() : memoryLayers;
        guardrails = guardrails == null ? List.of() : guardrails;
        loadout = loadout == null ? Loadout.empty() : loadout;
        governance = governance == null ? Governance.empty() : governance;
        skills = skills == null ? List.of() : skills;
    }

    /** Back-compat overload for callers that predate the {@code skills} field. */
    public AgentDraftRequest(
            Metadata metadata,
            Runtime runtime,
            Model model,
            List<Capability> capabilities,
            List<McpServer> mcpServers,
            List<String> memoryLayers,
            String defaultSkill,
            String allowedRolesText,
            List<Guardrail> guardrails,
            Loadout loadout,
            Governance governance) {
        this(metadata, runtime, model, capabilities, mcpServers, memoryLayers,
                defaultSkill, allowedRolesText, guardrails, loadout, governance, List.of());
    }

    public record Metadata(
            String name,
            String version,
            String description,
            String owner,
            String labelsText) {
    }

    public record Runtime(String image, String minVersion) {
    }

    public record Model(
            String primary,
            String fallback,
            String routing,
            String temperature,
            String maxTokens) {
    }

    public record Capability(
            String name,
            String description,
            String version,
            String implementedBy,
            String inputSchema,
            String outputSchema,
            String tags) {
    }

    public record McpServer(
            String name,
            String transport,
            String command,
            String args,
            String envText,
            String url,
            String authType,
            String authValue,
            String authHeaderName,
            String allowedTools,
            Boolean enabled) {
    }

    public record Guardrail(String name, String settingsJson) {
    }

    /**
     * The agent's loadout, form-friendly: knowledge bases and resources are structured
     * lists; memory scopes and skills are comma-separated free text. Everything defaults
     * to empty so a partially-filled draft never NPEs.
     */
    public record Loadout(
            List<KnowledgeRef> knowledge,
            String memoryScopesText,
            String skillsText,
            List<ResourceRef> resources) {

        public Loadout {
            knowledge = knowledge == null ? List.of() : knowledge;
            resources = resources == null ? List.of() : resources;
        }

        public static Loadout empty() {
            return new Loadout(List.of(), "", "", List.of());
        }
    }

    /** A knowledge base reference; {@code maxResults}/{@code minScore} are stringly (empty = inherit). */
    public record KnowledgeRef(
            String name,
            String description,
            String maxResults,
            String minScore) {
    }

    public record ResourceRef(String name, String type, String uri) {
    }

    /**
     * Cross-cutting governance for the workload, form-friendly: {@code visibility} is one of
     * private/internal/public (case-insensitive; blank = private), {@code access} is a
     * comma-separated ACL. Timestamps are Control-Plane-assigned and not authored here.
     */
    public record Governance(
            String tenant,
            String visibility,
            String status,
            String accessText) {

        public static Governance empty() {
            return new Governance("", "", "", "");
        }
    }
}

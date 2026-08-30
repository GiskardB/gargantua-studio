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
        List<SkillDraftRequest> skills,
        Cognition cognition,
        Contract contract,
        List<InterfaceEndpoint> interfaces) {

    public AgentDraftRequest {
        capabilities = capabilities == null ? List.of() : capabilities;
        mcpServers = mcpServers == null ? List.of() : mcpServers;
        memoryLayers = memoryLayers == null ? List.of() : memoryLayers;
        guardrails = guardrails == null ? List.of() : guardrails;
        loadout = loadout == null ? Loadout.empty() : loadout;
        governance = governance == null ? Governance.empty() : governance;
        skills = skills == null ? List.of() : skills;
        cognition = cognition == null ? Cognition.empty() : cognition;
        contract = contract == null ? Contract.empty() : contract;
        interfaces = interfaces == null ? List.of() : interfaces;
    }

    /** Back-compat overload for callers that predate the PACT Core fields (cognition/contract/interfaces). */
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
            Governance governance,
            List<SkillDraftRequest> skills) {
        this(metadata, runtime, model, capabilities, mcpServers, memoryLayers, defaultSkill,
                allowedRolesText, guardrails, loadout, governance, skills,
                Cognition.empty(), Contract.empty(), List.of());
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

    /**
     * PACT Core's "Cognition" pillar, form-friendly: open-vocabulary lists are
     * comma-separated text, same convention as {@code Capability.tags}. Declarative only
     * — see {@code core.pact.Cognition} in the shared domain model.
     */
    public record Cognition(
            String modalitiesText,
            String capabilitiesText,
            ModelDescriptor primaryModel,
            ModelDescriptor fallbackModel,
            String requiredModalitiesText,
            String requiredCapabilitiesText,
            String contextWindowMinimum) {

        public Cognition {
            primaryModel = primaryModel == null ? ModelDescriptor.empty() : primaryModel;
            fallbackModel = fallbackModel == null ? ModelDescriptor.empty() : fallbackModel;
        }

        public static Cognition empty() {
            return new Cognition("", "", ModelDescriptor.empty(), ModelDescriptor.empty(), "", "", "");
        }
    }

    /** A semantic (not operational) model family reference — see {@code core.pact.ModelDescriptor}. */
    public record ModelDescriptor(String provider, String family, String name) {

        public static ModelDescriptor empty() {
            return new ModelDescriptor("", "", "");
        }
    }

    /**
     * PACT Core's "Contract" pillar, form-friendly. {@code autonomyLevel} is the plain
     * {@code 0}-{@code 4} wire value (blank = undeclared); {@code permissionsText} is
     * comma-separated, no controlled vocabulary — see {@code core.pact.Contract}.
     */
    public record Contract(String autonomyLevel, String permissionsText) {

        public static Contract empty() {
            return new Contract("", "");
        }
    }

    /**
     * PACT Core's "Interfaces" pillar: how another system may reach this agent — see
     * {@code core.pact.InterfaceEndpoint}.
     */
    public record InterfaceEndpoint(String protocol, String endpoint, String version) {
    }
}

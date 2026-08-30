package ai.gargantua.studio.manifest;

import ai.gargantua.core.capability.Capability;
import ai.gargantua.core.governance.GovernanceEnvelope;
import ai.gargantua.core.governance.Visibility;
import ai.gargantua.core.mcp.McpAuth;
import ai.gargantua.core.mcp.McpServerSpec;
import ai.gargantua.core.mcp.McpTransport;
import ai.gargantua.core.memory.MemoryLayer;
import ai.gargantua.core.pact.Autonomy;
import ai.gargantua.core.pact.Cognition;
import ai.gargantua.core.pact.CognitionModels;
import ai.gargantua.core.pact.CognitionRequirements;
import ai.gargantua.core.pact.Contract;
import ai.gargantua.core.pact.InterfaceEndpoint;
import ai.gargantua.core.pact.ModelDescriptor;
import ai.gargantua.core.workload.AgentSpec;
import ai.gargantua.core.workload.KnowledgeRef;
import ai.gargantua.core.workload.Loadout;
import ai.gargantua.core.workload.ModelSpec;
import ai.gargantua.core.workload.ResourceRef;
import ai.gargantua.core.workload.RuntimeSpec;
import ai.gargantua.core.workload.WorkloadManifest;
import ai.gargantua.core.workload.WorkloadMetadata;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Turns a form {@link AgentDraftRequest} into a validated {@code gargantua.ai/v1}
 * manifest, both as agent-core records (so every domain invariant is enforced — no
 * duplicate capability names, temperature within range, stdio needs a command…) and as
 * the canonical YAML document the Control Plane and Runtime consume.
 *
 * <p>This logic used to live in the frontend. Moving it here makes the shared domain
 * model the single authority for what a valid agent is: the Studio now validates against
 * the very records the Runtime executes.
 */
@Component
public class ManifestBuilder {

    private final ObjectMapper json;
    private final YAMLMapper yaml;

    public ManifestBuilder(ObjectMapper documentObjectMapper) {
        this.json = documentObjectMapper;
        this.yaml = YAMLMapper.builder()
                .disable(YAMLGenerator.Feature.WRITE_DOC_START_MARKER)
                .enable(YAMLGenerator.Feature.MINIMIZE_QUOTES)
                .build();
    }

    /** Outcome of a build: either valid YAML, or the list of problems found. */
    public record BuildResult(boolean valid, String yaml, List<String> errors) {
        static BuildResult ok(String yaml) {
            return new BuildResult(true, yaml, List.of());
        }

        static BuildResult invalid(List<String> errors) {
            return new BuildResult(false, null, List.copyOf(errors));
        }
    }

    /**
     * Build and validate. Cheap, structural problems are collected first so the user
     * sees them together; if the draft is structurally sound, the agent-core records
     * are constructed, which enforces the remaining domain invariants (a single
     * {@link IllegalArgumentException} surfaced as one more error).
     */
    public BuildResult build(AgentDraftRequest draft) {
        List<String> errors = precheck(draft);
        if (!errors.isEmpty()) {
            return BuildResult.invalid(errors);
        }
        try {
            WorkloadManifest manifest = toManifest(draft);
            return BuildResult.ok(toYaml(manifest));
        } catch (IllegalArgumentException e) {
            return BuildResult.invalid(List.of(e.getMessage()));
        }
    }

    // ---- validation -------------------------------------------------------------

    private List<String> precheck(AgentDraftRequest draft) {
        List<String> errors = new ArrayList<>();
        AgentDraftRequest.Metadata md = draft.metadata();
        if (md == null || isBlank(md.name())) {
            errors.add("metadata.name is required");
        }
        if (md == null || isBlank(md.version())) {
            errors.add("metadata.version is required");
        }
        AgentDraftRequest.Model model = draft.model();
        if (model != null) {
            if (!isBlank(model.temperature()) && parseDouble(model.temperature()) == null) {
                errors.add("model.temperature must be a number");
            }
            if (!isBlank(model.maxTokens()) && parseInt(model.maxTokens()) == null) {
                errors.add("model.maxTokens must be an integer");
            }
        }
        for (AgentDraftRequest.Guardrail g : draft.guardrails()) {
            if (isBlank(g.name())) {
                errors.add("guardrail name is required");
            } else if (!isBlank(g.settingsJson()) && parseJsonObject(g.settingsJson()) == null) {
                errors.add("guardrail '" + g.name() + "': settings must be a JSON object");
            }
        }
        for (String layer : draft.memoryLayers()) {
            if (parseMemoryLayer(layer) == null) {
                errors.add("unknown memory layer '" + layer + "'");
            }
        }
        AgentDraftRequest.Loadout lo = draft.loadout();
        if (lo != null) {
            for (AgentDraftRequest.KnowledgeRef k : lo.knowledge()) {
                if (isBlank(k.name())) {
                    errors.add("loadout knowledge base name is required");
                    continue;
                }
                if (!isBlank(k.maxResults()) && parseInt(k.maxResults()) == null) {
                    errors.add("loadout knowledge '" + k.name() + "': maxResults must be an integer");
                }
                if (!isBlank(k.minScore()) && parseDouble(k.minScore()) == null) {
                    errors.add("loadout knowledge '" + k.name() + "': minScore must be a number");
                }
            }
            for (AgentDraftRequest.ResourceRef r : lo.resources()) {
                if (isBlank(r.name())) {
                    errors.add("loadout resource name is required");
                }
            }
        }
        AgentDraftRequest.Governance gov = draft.governance();
        if (gov != null && !isBlank(gov.visibility())) {
            try {
                parseVisibility(gov.visibility());
            } catch (IllegalArgumentException e) {
                errors.add(e.getMessage() + " (use private, internal or public)");
            }
        }
        AgentDraftRequest.Cognition cognition = draft.cognition();
        if (cognition != null && !isBlank(cognition.contextWindowMinimum())
                && parseInt(cognition.contextWindowMinimum()) == null) {
            errors.add("cognition.requirements.contextWindow.minimum must be an integer");
        }
        AgentDraftRequest.Contract contract = draft.contract();
        if (contract != null && !isBlank(contract.autonomyLevel())) {
            Integer level = parseInt(contract.autonomyLevel());
            if (level == null || level < 0 || level > 4) {
                errors.add("contract.autonomy.level must be an integer between 0 and 4");
            }
        }
        for (AgentDraftRequest.InterfaceEndpoint i : draft.interfaces()) {
            if (isBlank(i.protocol())) {
                errors.add("interface protocol is required");
            }
            if (isBlank(i.endpoint())) {
                errors.add("interface endpoint is required");
            }
        }
        return errors;
    }

    // ---- records -> draft (rehydrate the form when editing a published workload) --

    /** The inverse of {@link #toManifest}: turn a parsed manifest back into a form draft. */
    public AgentDraftRequest toDraft(WorkloadManifest manifest) {
        WorkloadMetadata md = manifest.metadata();
        AgentSpec spec = manifest.agentSpec();

        return new AgentDraftRequest(
                new AgentDraftRequest.Metadata(
                        nullToEmpty(md.name()),
                        nullToEmpty(md.version()),
                        nullToEmpty(md.description()),
                        nullToEmpty(md.owner()),
                        joinKeyValues(md.labels())),
                new AgentDraftRequest.Runtime(
                        nullToEmpty(spec.runtime().image()),
                        nullToEmpty(spec.runtime().minVersion())),
                new AgentDraftRequest.Model(
                        nullToEmpty(spec.model().primary()),
                        nullToEmpty(spec.model().fallback()),
                        nullToEmpty(spec.model().routing()),
                        numberToString(spec.model().temperature()),
                        numberToString(spec.model().maxTokens())),
                capabilityDrafts(spec.capabilities()),
                mcpServerDrafts(spec.mcpServers()),
                spec.memoryLayers().stream().map(Enum::name).toList(),
                nullToEmpty(spec.defaultSkill()),
                joinCsv(spec.allowedRoles()),
                guardrailDrafts(spec.guardrails()),
                loadoutDraft(spec.loadout()),
                governanceDraft(md.governance()),
                List.of(),
                cognitionDraft(spec.cognition()),
                contractDraft(spec.contract()),
                interfaceDrafts(spec.interfaces()));
    }

    private AgentDraftRequest.Cognition cognitionDraft(Cognition c) {
        if (c == null || c.isEmpty()) {
            return AgentDraftRequest.Cognition.empty();
        }
        CognitionRequirements req = c.requirements();
        return new AgentDraftRequest.Cognition(
                joinCsv(c.modalities()),
                joinCsv(c.capabilities()),
                modelDescriptorDraft(c.models() == null ? null : c.models().primary()),
                modelDescriptorDraft(c.models() == null ? null : c.models().fallback()),
                req == null ? "" : joinCsv(req.modalities()),
                req == null ? "" : joinCsv(req.capabilities()),
                req == null ? "" : numberToString(req.contextWindowMinimum()));
    }

    private AgentDraftRequest.ModelDescriptor modelDescriptorDraft(ModelDescriptor d) {
        if (d == null) {
            return AgentDraftRequest.ModelDescriptor.empty();
        }
        return new AgentDraftRequest.ModelDescriptor(
                nullToEmpty(d.provider()), nullToEmpty(d.family()), nullToEmpty(d.name()));
    }

    private AgentDraftRequest.Contract contractDraft(Contract c) {
        if (c == null || c.isEmpty()) {
            return AgentDraftRequest.Contract.empty();
        }
        return new AgentDraftRequest.Contract(
                c.autonomy() == null ? "" : String.valueOf(c.autonomy().level()),
                joinCsv(c.permissions()));
    }

    private List<AgentDraftRequest.InterfaceEndpoint> interfaceDrafts(List<InterfaceEndpoint> endpoints) {
        List<AgentDraftRequest.InterfaceEndpoint> out = new ArrayList<>();
        for (InterfaceEndpoint e : endpoints) {
            out.add(new AgentDraftRequest.InterfaceEndpoint(
                    nullToEmpty(e.protocol()), nullToEmpty(e.endpoint()), nullToEmpty(e.version())));
        }
        return out;
    }

    private List<AgentDraftRequest.Capability> capabilityDrafts(List<Capability> caps) {
        List<AgentDraftRequest.Capability> out = new ArrayList<>();
        for (Capability c : caps) {
            out.add(new AgentDraftRequest.Capability(
                    nullToEmpty(c.name()),
                    nullToEmpty(c.description()),
                    nullToEmpty(c.version()),
                    nullToEmpty(c.implementedBy()),
                    nullToEmpty(c.inputSchema()),
                    nullToEmpty(c.outputSchema()),
                    joinCsv(c.tags())));
        }
        return out;
    }

    private List<AgentDraftRequest.McpServer> mcpServerDrafts(List<McpServerSpec> servers) {
        List<AgentDraftRequest.McpServer> out = new ArrayList<>();
        for (McpServerSpec s : servers) {
            McpAuth auth = s.auth() == null ? McpAuth.none() : s.auth();
            out.add(new AgentDraftRequest.McpServer(
                    nullToEmpty(s.name()),
                    s.transport().name().toLowerCase(),
                    nullToEmpty(s.command()),
                    String.join(" ", s.args()),
                    joinKeyValues(s.env()),
                    nullToEmpty(s.url()),
                    auth.type(),
                    nullToEmpty(auth.value()),
                    nullToEmpty(auth.headerName()),
                    joinCsv(s.allowedTools()),
                    s.enabled()));
        }
        return out;
    }

    private List<AgentDraftRequest.Guardrail> guardrailDrafts(Map<String, Object> guardrails) {
        List<AgentDraftRequest.Guardrail> out = new ArrayList<>();
        for (Map.Entry<String, Object> e : guardrails.entrySet()) {
            out.add(new AgentDraftRequest.Guardrail(e.getKey(), writeJson(e.getValue())));
        }
        return out;
    }

    private AgentDraftRequest.Loadout loadoutDraft(Loadout l) {
        List<AgentDraftRequest.KnowledgeRef> knowledge = new ArrayList<>();
        for (KnowledgeRef k : l.knowledge()) {
            knowledge.add(new AgentDraftRequest.KnowledgeRef(
                    nullToEmpty(k.name()),
                    nullToEmpty(k.description()),
                    numberToString(k.maxResults()),
                    numberToString(k.minScore())));
        }
        List<AgentDraftRequest.ResourceRef> resources = new ArrayList<>();
        for (ResourceRef r : l.resources()) {
            resources.add(new AgentDraftRequest.ResourceRef(
                    nullToEmpty(r.name()), nullToEmpty(r.type()), nullToEmpty(r.uri())));
        }
        return new AgentDraftRequest.Loadout(
                knowledge, joinCsv(l.memoryScopes()), joinCsv(l.skills()), resources);
    }

    private AgentDraftRequest.Governance governanceDraft(GovernanceEnvelope g) {
        return new AgentDraftRequest.Governance(
                nullToEmpty(g.tenant()),
                g.visibility() == Visibility.PRIVATE ? "" : g.visibility().name().toLowerCase(),
                nullToEmpty(g.status()),
                joinCsv(g.access()));
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private static String numberToString(Object n) {
        return n == null ? "" : String.valueOf(n);
    }

    /** Inverse of {@link #parseCsv}. */
    private static String joinCsv(Collection<String> items) {
        return String.join(", ", items);
    }

    /** Inverse of {@link #parseKeyValues}. */
    private static String joinKeyValues(Map<String, String> map) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> e : map.entrySet()) {
            if (sb.length() > 0) {
                sb.append('\n');
            }
            sb.append(e.getKey()).append('=').append(e.getValue());
        }
        return sb.toString();
    }

    private String writeJson(Object value) {
        try {
            return json.writerWithDefaultPrettyPrinter().writeValueAsString(value);
        } catch (Exception e) {
            return "{}";
        }
    }

    // ---- draft -> records -------------------------------------------------------

    private WorkloadManifest toManifest(AgentDraftRequest draft) {
        AgentDraftRequest.Metadata md = draft.metadata();
        WorkloadMetadata metadata = new WorkloadMetadata(
                trimToNull(md.name()),
                trimToNull(md.version()),
                emptyToBlank(md.description()),
                trimToNull(md.owner()),
                parseKeyValues(md.labelsText()),
                governance(draft.governance()));

        AgentSpec spec = new AgentSpec(
                runtimeSpec(draft.runtime()),
                capabilities(draft.capabilities()),
                modelSpec(draft.model()),
                mcpServers(draft.mcpServers()),
                memoryLayers(draft.memoryLayers()),
                trimToNull(draft.defaultSkill()),
                guardrails(draft.guardrails()),
                new LinkedHashSet<>(parseCsv(draft.allowedRolesText())),
                loadout(draft.loadout()),
                cognition(draft.cognition()),
                contract(draft.contract()),
                interfaces(draft.interfaces()));

        return WorkloadManifest.agent(metadata, spec);
    }

    private Cognition cognition(AgentDraftRequest.Cognition c) {
        if (c == null) {
            return Cognition.none();
        }
        CognitionModels models = cognitionModels(c.primaryModel(), c.fallbackModel());
        CognitionRequirements requirements = cognitionRequirements(c);
        return new Cognition(
                new LinkedHashSet<>(parseCsv(c.modalitiesText())),
                new LinkedHashSet<>(parseCsv(c.capabilitiesText())),
                models,
                requirements);
    }

    private CognitionModels cognitionModels(AgentDraftRequest.ModelDescriptor primary,
                                            AgentDraftRequest.ModelDescriptor fallback) {
        ModelDescriptor primaryModel = modelDescriptor(primary);
        ModelDescriptor fallbackModel = modelDescriptor(fallback);
        if (primaryModel == null && fallbackModel == null) {
            return null;
        }
        return new CognitionModels(primaryModel, fallbackModel);
    }

    private ModelDescriptor modelDescriptor(AgentDraftRequest.ModelDescriptor d) {
        if (d == null || (isBlank(d.provider()) && isBlank(d.family()) && isBlank(d.name()))) {
            return null;
        }
        return new ModelDescriptor(trimToNull(d.provider()), trimToNull(d.family()), trimToNull(d.name()));
    }

    private CognitionRequirements cognitionRequirements(AgentDraftRequest.Cognition c) {
        List<String> requiredModalities = parseCsv(c.requiredModalitiesText());
        List<String> requiredCapabilities = parseCsv(c.requiredCapabilitiesText());
        Integer contextWindowMinimum = parseInt(c.contextWindowMinimum());
        if (requiredModalities.isEmpty() && requiredCapabilities.isEmpty() && contextWindowMinimum == null) {
            return null;
        }
        return new CognitionRequirements(
                new LinkedHashSet<>(requiredModalities), new LinkedHashSet<>(requiredCapabilities), contextWindowMinimum);
    }

    private Contract contract(AgentDraftRequest.Contract c) {
        if (c == null) {
            return Contract.none();
        }
        Integer level = parseInt(c.autonomyLevel());
        return new Contract(
                level == null ? null : Autonomy.ofLevel(level),
                new LinkedHashSet<>(parseCsv(c.permissionsText())));
    }

    private List<InterfaceEndpoint> interfaces(List<AgentDraftRequest.InterfaceEndpoint> endpoints) {
        List<InterfaceEndpoint> out = new ArrayList<>();
        for (AgentDraftRequest.InterfaceEndpoint e : endpoints) {
            if (isBlank(e.protocol())) {
                throw new IllegalArgumentException("interface protocol is required");
            }
            if (isBlank(e.endpoint())) {
                throw new IllegalArgumentException("interface endpoint is required");
            }
            out.add(new InterfaceEndpoint(trimToNull(e.protocol()), trimToNull(e.endpoint()), trimToNull(e.version())));
        }
        return out;
    }

    private Loadout loadout(AgentDraftRequest.Loadout l) {
        if (l == null) {
            return Loadout.empty();
        }
        List<KnowledgeRef> knowledge = new ArrayList<>();
        for (AgentDraftRequest.KnowledgeRef k : l.knowledge()) {
            if (isBlank(k.name())) {
                throw new IllegalArgumentException("loadout knowledge base name is required");
            }
            knowledge.add(new KnowledgeRef(
                    trimToNull(k.name()),
                    trimToNull(k.description()),
                    parseInt(k.maxResults()),
                    parseDouble(k.minScore())));
        }
        List<ResourceRef> resources = new ArrayList<>();
        for (AgentDraftRequest.ResourceRef r : l.resources()) {
            if (isBlank(r.name())) {
                throw new IllegalArgumentException("loadout resource name is required");
            }
            resources.add(new ResourceRef(
                    trimToNull(r.name()), trimToNull(r.type()), trimToNull(r.uri())));
        }
        return new Loadout(
                knowledge, parseCsv(l.memoryScopesText()), parseCsv(l.skillsText()), resources);
    }

    private GovernanceEnvelope governance(AgentDraftRequest.Governance g) {
        if (g == null) {
            return GovernanceEnvelope.none();
        }
        // Timestamps are Control-Plane-assigned, not authored in the Studio.
        return GovernanceEnvelope.of(
                trimToNull(g.tenant()),
                parseVisibility(g.visibility()),
                trimToNull(g.status()),
                parseCsv(g.accessText()));
    }

    private static Visibility parseVisibility(String s) {
        if (isBlank(s)) {
            return Visibility.PRIVATE;
        }
        try {
            return Visibility.valueOf(s.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("unknown visibility '" + s + "'");
        }
    }

    private RuntimeSpec runtimeSpec(AgentDraftRequest.Runtime r) {
        if (r == null) {
            return RuntimeSpec.platformDefault();
        }
        return new RuntimeSpec(trimToNull(r.image()), trimToNull(r.minVersion()));
    }

    private List<Capability> capabilities(List<AgentDraftRequest.Capability> caps) {
        List<Capability> out = new ArrayList<>();
        for (AgentDraftRequest.Capability c : caps) {
            if (isBlank(c.name())) {
                throw new IllegalArgumentException("capability name is required");
            }
            out.add(new Capability(
                    trimToNull(c.name()),
                    trimToNull(c.description()),
                    trimToNull(c.version()),
                    trimToNull(c.inputSchema()),
                    trimToNull(c.outputSchema()),
                    trimToNull(c.implementedBy()),
                    new LinkedHashSet<>(parseCsv(c.tags()))));
        }
        return out;
    }

    private ModelSpec modelSpec(AgentDraftRequest.Model m) {
        if (m == null) {
            return ModelSpec.inherit();
        }
        return new ModelSpec(
                trimToNull(m.primary()),
                trimToNull(m.fallback()),
                trimToNull(m.routing()),
                parseDouble(m.temperature()),
                parseInt(m.maxTokens()));
    }

    private List<McpServerSpec> mcpServers(List<AgentDraftRequest.McpServer> servers) {
        List<McpServerSpec> out = new ArrayList<>();
        for (AgentDraftRequest.McpServer s : servers) {
            McpTransport transport = parseTransport(s.transport());
            out.add(new McpServerSpec(
                    trimToNull(s.name()),
                    transport,
                    trimToNull(s.command()),
                    parseArgs(s.args()),
                    parseKeyValues(s.envText()),
                    trimToNull(s.url()),
                    auth(s),
                    new LinkedHashSet<>(parseCsv(s.allowedTools())),
                    s.enabled() == null || s.enabled()));
        }
        return out;
    }

    private McpAuth auth(AgentDraftRequest.McpServer s) {
        String type = trimToNull(s.authType());
        if (type == null || "none".equalsIgnoreCase(type)) {
            return McpAuth.none();
        }
        return new McpAuth(type, trimToNull(s.authValue()), trimToNull(s.authHeaderName()));
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

    private Map<String, Object> guardrails(List<AgentDraftRequest.Guardrail> guardrails) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (AgentDraftRequest.Guardrail g : guardrails) {
            Map<String, Object> settings = isBlank(g.settingsJson())
                    ? Map.of()
                    : parseJsonObject(g.settingsJson());
            out.put(trimToNull(g.name()), settings);
        }
        return out;
    }

    // ---- records -> canonical YAML ---------------------------------------------

    private String toYaml(WorkloadManifest manifest) {
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("apiVersion", manifest.apiVersion());
        root.put("kind", "Agent");

        WorkloadMetadata md = manifest.metadata();
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("name", md.name());
        metadata.put("version", md.version());
        putIfPresent(metadata, "description", trimToNull(md.description()));
        putIfPresent(metadata, "owner", md.owner());
        if (!md.labels().isEmpty()) {
            metadata.put("labels", new LinkedHashMap<>(md.labels()));
        }
        Map<String, Object> governanceNode = governanceNode(md.governance());
        if (!governanceNode.isEmpty()) {
            metadata.put("governance", governanceNode);
        }
        root.put("metadata", metadata);

        AgentSpec spec = manifest.agentSpec();
        Map<String, Object> specNode = new LinkedHashMap<>();

        RuntimeSpec rt = spec.runtime();
        Map<String, Object> runtime = new LinkedHashMap<>();
        putIfPresent(runtime, "image", rt.image());
        putIfPresent(runtime, "minVersion", rt.minVersion());
        if (!runtime.isEmpty()) {
            specNode.put("runtime", runtime);
        }

        if (!spec.capabilities().isEmpty()) {
            List<Object> caps = new ArrayList<>();
            for (Capability c : spec.capabilities()) {
                Map<String, Object> cn = new LinkedHashMap<>();
                cn.put("name", c.name());
                putIfPresent(cn, "description", c.description());
                putIfPresent(cn, "version", c.version());
                putIfPresent(cn, "implementedBy", c.implementedBy());
                putIfPresent(cn, "inputSchema", c.inputSchema());
                putIfPresent(cn, "outputSchema", c.outputSchema());
                if (!c.tags().isEmpty()) {
                    cn.put("tags", new ArrayList<>(c.tags()));
                }
                caps.add(cn);
            }
            specNode.put("capabilities", caps);
        }

        ModelSpec model = spec.model();
        Map<String, Object> modelNode = new LinkedHashMap<>();
        putIfPresent(modelNode, "primary", model.primary());
        putIfPresent(modelNode, "fallback", model.fallback());
        putIfPresent(modelNode, "routing", model.routing());
        putIfPresent(modelNode, "temperature", model.temperature());
        putIfPresent(modelNode, "maxTokens", model.maxTokens());
        if (!modelNode.isEmpty()) {
            specNode.put("model", modelNode);
        }

        if (!spec.mcpServers().isEmpty()) {
            List<Object> servers = new ArrayList<>();
            for (McpServerSpec s : spec.mcpServers()) {
                Map<String, Object> sn = new LinkedHashMap<>();
                sn.put("name", s.name());
                sn.put("transport", s.transport().name().toLowerCase());
                putIfPresent(sn, "command", s.command());
                if (!s.args().isEmpty()) {
                    sn.put("args", new ArrayList<>(s.args()));
                }
                if (!s.env().isEmpty()) {
                    sn.put("env", new LinkedHashMap<>(s.env()));
                }
                putIfPresent(sn, "url", s.url());
                Map<String, Object> authNode = authNode(s.auth());
                if (!authNode.isEmpty()) {
                    sn.put("auth", authNode);
                }
                if (!s.allowedTools().isEmpty()) {
                    sn.put("allowedTools", new ArrayList<>(s.allowedTools()));
                }
                if (!s.enabled()) {
                    sn.put("enabled", false);
                }
                servers.add(sn);
            }
            specNode.put("mcp", Map.of("servers", servers));
        }

        if (!spec.memoryLayers().isEmpty()) {
            List<String> layers = new ArrayList<>();
            spec.memoryLayers().forEach(l -> layers.add(l.name()));
            specNode.put("memoryLayers", layers);
        }
        putIfPresent(specNode, "defaultSkill", spec.defaultSkill());
        if (!spec.allowedRoles().isEmpty()) {
            specNode.put("allowedRoles", new ArrayList<>(spec.allowedRoles()));
        }
        if (!spec.guardrails().isEmpty()) {
            specNode.put("guardrails", new LinkedHashMap<>(spec.guardrails()));
        }

        Map<String, Object> loadoutNode = loadoutNode(spec.loadout());
        if (!loadoutNode.isEmpty()) {
            specNode.put("loadout", loadoutNode);
        }

        Map<String, Object> cognitionNode = cognitionNode(spec.cognition());
        if (!cognitionNode.isEmpty()) {
            specNode.put("cognition", cognitionNode);
        }

        Map<String, Object> contractNode = contractNode(spec.contract());
        if (!contractNode.isEmpty()) {
            specNode.put("contract", contractNode);
        }

        if (!spec.interfaces().isEmpty()) {
            List<Object> endpoints = new ArrayList<>();
            for (InterfaceEndpoint e : spec.interfaces()) {
                Map<String, Object> en = new LinkedHashMap<>();
                en.put("protocol", e.protocol());
                en.put("endpoint", e.endpoint());
                putIfPresent(en, "version", e.version());
                endpoints.add(en);
            }
            specNode.put("interfaces", endpoints);
        }

        root.put("spec", specNode);

        try {
            return yaml.writeValueAsString(root);
        } catch (Exception e) {
            throw new IllegalStateException("cannot serialize manifest to YAML", e);
        }
    }

    private Map<String, Object> governanceNode(GovernanceEnvelope g) {
        Map<String, Object> node = new LinkedHashMap<>();
        if (g == null || g.isDefault()) {
            return node;
        }
        putIfPresent(node, "tenant", g.tenant());
        // Only emit visibility when it departs from the PRIVATE default, to keep manifests lean.
        if (g.visibility() != Visibility.PRIVATE) {
            node.put("visibility", g.visibility().name().toLowerCase());
        }
        putIfPresent(node, "status", g.status());
        if (!g.access().isEmpty()) {
            node.put("access", new ArrayList<>(g.access()));
        }
        // createdAt/updatedAt are Control-Plane-owned; the Studio never emits them.
        return node;
    }

    private Map<String, Object> loadoutNode(Loadout l) {
        Map<String, Object> node = new LinkedHashMap<>();
        if (l == null || l.isEmpty()) {
            return node;
        }
        if (!l.knowledge().isEmpty()) {
            List<Object> ks = new ArrayList<>();
            for (KnowledgeRef k : l.knowledge()) {
                Map<String, Object> kn = new LinkedHashMap<>();
                kn.put("name", k.name());
                putIfPresent(kn, "description", k.description());
                putIfPresent(kn, "maxResults", k.maxResults());
                putIfPresent(kn, "minScore", k.minScore());
                ks.add(kn);
            }
            node.put("knowledge", ks);
        }
        if (!l.memoryScopes().isEmpty()) {
            node.put("memoryScopes", new ArrayList<>(l.memoryScopes()));
        }
        if (!l.skills().isEmpty()) {
            node.put("skills", new ArrayList<>(l.skills()));
        }
        if (!l.resources().isEmpty()) {
            List<Object> rs = new ArrayList<>();
            for (ResourceRef r : l.resources()) {
                Map<String, Object> rn = new LinkedHashMap<>();
                rn.put("name", r.name());
                putIfPresent(rn, "type", r.type());
                putIfPresent(rn, "uri", r.uri());
                rs.add(rn);
            }
            node.put("resources", rs);
        }
        return node;
    }

    private Map<String, Object> cognitionNode(Cognition c) {
        Map<String, Object> node = new LinkedHashMap<>();
        if (c == null || c.isEmpty()) {
            return node;
        }
        if (!c.modalities().isEmpty()) {
            node.put("modalities", new ArrayList<>(c.modalities()));
        }
        if (!c.capabilities().isEmpty()) {
            node.put("capabilities", new ArrayList<>(c.capabilities()));
        }
        if (c.models() != null) {
            Map<String, Object> modelsNode = new LinkedHashMap<>();
            putModelDescriptor(modelsNode, "primary", c.models().primary());
            putModelDescriptor(modelsNode, "fallback", c.models().fallback());
            if (!modelsNode.isEmpty()) {
                node.put("models", modelsNode);
            }
        }
        if (c.requirements() != null) {
            Map<String, Object> reqNode = new LinkedHashMap<>();
            if (!c.requirements().modalities().isEmpty()) {
                reqNode.put("modalities", Map.of("required", new ArrayList<>(c.requirements().modalities())));
            }
            if (!c.requirements().capabilities().isEmpty()) {
                reqNode.put("capabilities", Map.of("required", new ArrayList<>(c.requirements().capabilities())));
            }
            if (c.requirements().contextWindowMinimum() != null) {
                reqNode.put("contextWindow", Map.of("minimum", c.requirements().contextWindowMinimum()));
            }
            if (!reqNode.isEmpty()) {
                node.put("requirements", reqNode);
            }
        }
        return node;
    }

    private void putModelDescriptor(Map<String, Object> parent, String key, ModelDescriptor d) {
        if (d == null) {
            return;
        }
        Map<String, Object> node = new LinkedHashMap<>();
        putIfPresent(node, "provider", d.provider());
        putIfPresent(node, "family", d.family());
        putIfPresent(node, "name", d.name());
        if (!node.isEmpty()) {
            parent.put(key, node);
        }
    }

    private Map<String, Object> contractNode(Contract c) {
        Map<String, Object> node = new LinkedHashMap<>();
        if (c == null || c.isEmpty()) {
            return node;
        }
        if (c.autonomy() != null) {
            node.put("autonomy", Map.of("level", c.autonomy().level()));
        }
        if (!c.permissions().isEmpty()) {
            node.put("permissions", new ArrayList<>(c.permissions()));
        }
        return node;
    }

    private Map<String, Object> authNode(McpAuth auth) {
        Map<String, Object> node = new LinkedHashMap<>();
        if (auth == null) {
            return node;
        }
        String type = auth.type();
        if (type == null || "none".equalsIgnoreCase(type)) {
            return node;
        }
        node.put("type", type);
        putIfPresent(node, "value", auth.value());
        putIfPresent(node, "headerName", auth.headerName());
        return node;
    }

    // ---- parsing helpers --------------------------------------------------------

    private static void putIfPresent(Map<String, Object> map, String key, Object value) {
        if (value != null && !(value instanceof String s && s.isBlank())) {
            map.put(key, value);
        }
    }

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

    private static String emptyToBlank(String s) {
        return s == null ? "" : s.trim();
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

    /** Whitespace-separated argv. */
    private static List<String> parseArgs(String args) {
        List<String> out = new ArrayList<>();
        if (isBlank(args)) {
            return out;
        }
        for (String part : args.trim().split("\\s+")) {
            if (!part.isEmpty()) {
                out.add(part);
            }
        }
        return out;
    }

    /** {@code KEY=VALUE} per line → ordered map. Blank lines and lines without '=' are skipped. */
    private static Map<String, String> parseKeyValues(String text) {
        Map<String, String> out = new LinkedHashMap<>();
        if (isBlank(text)) {
            return out;
        }
        for (String line : text.split("\\r?\\n")) {
            String t = line.trim();
            if (t.isEmpty()) {
                continue;
            }
            int eq = t.indexOf('=');
            if (eq <= 0) {
                continue;
            }
            out.put(t.substring(0, eq).trim(), t.substring(eq + 1).trim());
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

    private static McpTransport parseTransport(String s) {
        if (isBlank(s)) {
            throw new IllegalArgumentException("MCP server transport is required");
        }
        try {
            return McpTransport.valueOf(s.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("unknown MCP transport '" + s + "'");
        }
    }

    private Map<String, Object> parseJsonObject(String jsonText) {
        try {
            return json.readValue(jsonText, new TypeReference<LinkedHashMap<String, Object>>() {});
        } catch (Exception e) {
            return null;
        }
    }
}

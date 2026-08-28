package ai.gargantua.studio.manifest;

import static org.assertj.core.api.Assertions.assertThat;

import ai.gargantua.bundle.ManifestParser;
import ai.gargantua.core.workload.WorkloadManifest;
import ai.gargantua.studio.manifest.AgentDraftRequest.Capability;
import ai.gargantua.studio.manifest.AgentDraftRequest.Guardrail;
import ai.gargantua.studio.manifest.AgentDraftRequest.McpServer;
import ai.gargantua.studio.manifest.AgentDraftRequest.Metadata;
import ai.gargantua.studio.manifest.AgentDraftRequest.Model;
import ai.gargantua.studio.manifest.AgentDraftRequest.Runtime;
import ai.gargantua.studio.manifest.ManifestBuilder.BuildResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The manifest builder is the shared-model authority for what a valid agent is, so the
 * interesting cases are the domain invariants (duplicate capabilities, transport rules,
 * model ranges) and that the emitted YAML uses the canonical schema shape.
 */
class ManifestBuilderTest {

    private final ManifestBuilder builder = new ManifestBuilder(new ObjectMapper());

    private AgentDraftRequest draft(Metadata md, List<AgentDraftRequest.Capability> caps,
            List<McpServer> servers, Model model) {
        return new AgentDraftRequest(md, new Runtime("", ""), model, caps, servers,
                List.of(), "", "", List.of(), AgentDraftRequest.Loadout.empty(),
                AgentDraftRequest.Governance.empty());
    }

    private Metadata md(String name, String version) {
        return new Metadata(name, version, "", "", "");
    }

    private Model emptyModel() {
        return new Model("", "", "", "", "");
    }

    private AgentDraftRequest fullDraft() {
        return new AgentDraftRequest(
                new Metadata("customer-agent", "1.2.0", "Handles refunds", "payments", "env=prod"),
                new Runtime("ghcr.io/giskardb/gargantua-runtime:1.0", "1.0"),
                new Model("gpt-4o", "", "", "0.7", "1000"),
                List.of(new AgentDraftRequest.Capability(
                        "refund-payment", "Handles a refund", "1.0.0", "refund-skill",
                        "", "", "payments, gdpr")),
                List.of(new McpServer("payments-api", "http", "", "", "",
                        "https://mcp.internal/payments", "bearer", "${secrets.token}", "",
                        "getPayment, refundPayment", true)),
                List.of("WORKING", "EPISODIC"),
                "default-skill",
                "support-agent, super-admin",
                List.of(new Guardrail("pii-input", "{\"enabled\": true}")),
                new AgentDraftRequest.Loadout(
                        List.of(new AgentDraftRequest.KnowledgeRef(
                                "payments-kb", "Payments policies", "8", "0.55")),
                        "customer-history",
                        "refund-skill, status-skill",
                        List.of(new AgentDraftRequest.ResourceRef(
                                "refund-form", "file", "resources/refund.pdf"))),
                new AgentDraftRequest.Governance("acme", "internal", "active", "ops, support"));
    }

    @Test
    void buildsCanonicalYamlFromAFullDraft() {
        AgentDraftRequest draft = fullDraft();
        BuildResult result = builder.build(draft);

        assertThat(result.valid()).isTrue();
        assertThat(result.errors()).isEmpty();
        String yaml = result.yaml();
        assertThat(yaml).contains("apiVersion: gargantua.ai/v1");
        assertThat(yaml).contains("kind: Agent");
        assertThat(yaml).contains("name: customer-agent");
        // MCP servers nest under spec.mcp.servers, per the canonical schema.
        assertThat(yaml).contains("mcp:");
        assertThat(yaml).contains("servers:");
        assertThat(yaml).contains("transport: http");
        assertThat(yaml).contains("type: bearer");
        assertThat(yaml).contains("memoryLayers:");
        // Loadout: knowledge bases are first-class, with retrieval overrides.
        assertThat(yaml).contains("loadout:");
        assertThat(yaml).contains("knowledge:");
        assertThat(yaml).contains("name: payments-kb");
        assertThat(yaml).contains("maxResults: 8");
        assertThat(yaml).contains("memoryScopes:");
        assertThat(yaml).contains("resources:");
        // Governance nests under metadata; visibility departs from the private default.
        assertThat(yaml).contains("governance:");
        assertThat(yaml).contains("tenant: acme");
        assertThat(yaml).contains("visibility: internal");
        assertThat(yaml).contains("status: active");
    }

    /**
     * The path a "click a workload to edit it" flow takes: publish's own output (YAML),
     * parsed by the same {@link ManifestParser} the Runtime uses, must rehydrate a draft
     * the form can show back to the user — not just the name, every field.
     */
    @Test
    void toDraftRoundTripsAFullManifestBackToTheOriginalFields() {
        AgentDraftRequest original = fullDraft();
        String yaml = builder.build(original).yaml();

        WorkloadManifest parsed = ManifestParser.parse(yaml);
        AgentDraftRequest roundTripped = builder.toDraft(parsed);

        assertThat(roundTripped.metadata().name()).isEqualTo("customer-agent");
        assertThat(roundTripped.metadata().version()).isEqualTo("1.2.0");
        assertThat(roundTripped.metadata().description()).isEqualTo("Handles refunds");
        assertThat(roundTripped.metadata().owner()).isEqualTo("payments");
        assertThat(roundTripped.metadata().labelsText()).isEqualTo("env=prod");

        assertThat(roundTripped.runtime().image()).isEqualTo("ghcr.io/giskardb/gargantua-runtime:1.0");
        assertThat(roundTripped.model().primary()).isEqualTo("gpt-4o");
        assertThat(roundTripped.model().temperature()).isEqualTo("0.7");
        assertThat(roundTripped.model().maxTokens()).isEqualTo("1000");

        assertThat(roundTripped.capabilities()).hasSize(1);
        AgentDraftRequest.Capability cap = roundTripped.capabilities().get(0);
        assertThat(cap.name()).isEqualTo("refund-payment");
        assertThat(cap.implementedBy()).isEqualTo("refund-skill");
        assertThat(cap.tags()).contains("payments").contains("gdpr");

        assertThat(roundTripped.mcpServers()).hasSize(1);
        McpServer server = roundTripped.mcpServers().get(0);
        assertThat(server.name()).isEqualTo("payments-api");
        assertThat(server.transport()).isEqualTo("http");
        assertThat(server.url()).isEqualTo("https://mcp.internal/payments");
        assertThat(server.authType()).isEqualTo("bearer");
        assertThat(server.authValue()).isEqualTo("${secrets.token}");
        assertThat(server.allowedTools()).contains("getPayment").contains("refundPayment");

        assertThat(roundTripped.memoryLayers()).containsExactlyInAnyOrder("WORKING", "EPISODIC");
        assertThat(roundTripped.defaultSkill()).isEqualTo("default-skill");
        assertThat(roundTripped.allowedRolesText()).contains("support-agent").contains("super-admin");

        assertThat(roundTripped.guardrails()).hasSize(1);
        assertThat(roundTripped.guardrails().get(0).name()).isEqualTo("pii-input");
        assertThat(roundTripped.guardrails().get(0).settingsJson()).contains("enabled").contains("true");

        assertThat(roundTripped.loadout().knowledge()).hasSize(1);
        assertThat(roundTripped.loadout().knowledge().get(0).name()).isEqualTo("payments-kb");
        assertThat(roundTripped.loadout().knowledge().get(0).maxResults()).isEqualTo("8");
        assertThat(roundTripped.loadout().knowledge().get(0).minScore()).isEqualTo("0.55");
        assertThat(roundTripped.loadout().memoryScopesText()).contains("customer-history");
        assertThat(roundTripped.loadout().resources()).hasSize(1);
        assertThat(roundTripped.loadout().resources().get(0).name()).isEqualTo("refund-form");

        assertThat(roundTripped.governance().tenant()).isEqualTo("acme");
        assertThat(roundTripped.governance().visibility()).isEqualTo("internal");
        assertThat(roundTripped.governance().status()).isEqualTo("active");
        assertThat(roundTripped.governance().accessText()).contains("ops").contains("support");
    }

    @Test
    void missingNameAndVersionAreReportedTogether() {
        BuildResult result = builder.build(draft(md("", ""), List.of(), List.of(), emptyModel()));
        assertThat(result.valid()).isFalse();
        assertThat(result.errors())
                .anyMatch(e -> e.contains("metadata.name"))
                .anyMatch(e -> e.contains("metadata.version"));
    }

    @Test
    void duplicateCapabilityNamesAreRejectedByTheDomainModel() {
        AgentDraftRequest.Capability c1 =
                new AgentDraftRequest.Capability("dup", "a", "1.0.0", "", "", "", "");
        AgentDraftRequest.Capability c2 =
                new AgentDraftRequest.Capability("dup", "b", "1.0.0", "", "", "", "");
        BuildResult result =
                builder.build(draft(md("agent", "1.0.0"), List.of(c1, c2), List.of(), emptyModel()));
        assertThat(result.valid()).isFalse();
        assertThat(result.errors().toString().toLowerCase()).contains("duplicate");
    }

    @Test
    void stdioServerWithoutCommandIsRejected() {
        McpServer bad = new McpServer("local", "stdio", "", "", "", "", "none", "", "", "", true);
        BuildResult result =
                builder.build(draft(md("agent", "1.0.0"), List.of(), List.of(bad), emptyModel()));
        assertThat(result.valid()).isFalse();
        assertThat(result.errors().toString()).contains("command");
    }

    @Test
    void httpServerWithoutUrlIsRejected() {
        McpServer bad = new McpServer("remote", "http", "", "", "", "", "none", "", "", "", true);
        BuildResult result =
                builder.build(draft(md("agent", "1.0.0"), List.of(), List.of(bad), emptyModel()));
        assertThat(result.valid()).isFalse();
        assertThat(result.errors().toString()).contains("url");
    }

    @Test
    void temperatureOutOfRangeIsRejected() {
        BuildResult result = builder.build(draft(md("agent", "1.0.0"), List.of(), List.of(),
                new Model("gpt-4o", "", "", "5.0", "")));
        assertThat(result.valid()).isFalse();
        assertThat(result.errors().toString().toLowerCase()).contains("temperature");
    }

    @Test
    void nonNumericTemperatureIsReportedInPrecheck() {
        BuildResult result = builder.build(draft(md("agent", "1.0.0"), List.of(), List.of(),
                new Model("gpt-4o", "", "", "hot", "")));
        assertThat(result.valid()).isFalse();
        assertThat(result.errors()).anyMatch(e -> e.contains("temperature must be a number"));
    }

    @Test
    void minimalDraftProducesAValidManifest() {
        BuildResult result =
                builder.build(draft(md("agent", "1.0.0"), List.of(), List.of(), emptyModel()));
        assertThat(result.valid()).isTrue();
        assertThat(result.yaml()).contains("name: agent");
    }
}

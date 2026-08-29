package ai.gargantua.studio.controlplane;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ai.gargantua.studio.common.NotFoundException;
import ai.gargantua.studio.controlplane.ControlPlaneRegistry.Config;
import ai.gargantua.studio.launch.SettingsStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ControlPlaneRegistryTest {

    private ControlPlaneRegistry registry;

    @BeforeEach
    void setUp() {
        registry = new ControlPlaneRegistry(inMemorySettings(), new ObjectMapper(), "http://localhost:8080");
    }

    /** A real (if trivial) settings store, so create/activate/delete round-trip properly. */
    private static SettingsStore inMemorySettings() {
        Map<String, String> backing = new HashMap<>();
        SettingsStore store = mock(SettingsStore.class);
        when(store.get(anyString())).thenAnswer(inv -> Optional.ofNullable(backing.get(inv.getArgument(0))));
        doAnswer(inv -> {
            backing.put(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(store).put(anyString(), anyString());
        return store;
    }

    @Test
    void firstRunSeedsOneConfigFromTheBootstrapUrlAndMakesItActive() {
        assertThat(registry.list()).hasSize(1);
        assertThat(registry.list().get(0).baseUrl()).isEqualTo("http://localhost:8080");
        assertThat(registry.activeBaseUrl()).contains("http://localhost:8080");
    }

    @Test
    void creatingASecondConfigDoesNotChangeWhichOneIsActive() {
        Config first = registry.list().get(0);
        registry.create("shared-dev", "http://cp.dev.internal:8080");

        assertThat(registry.list()).hasSize(2);
        assertThat(registry.activeId()).isEqualTo(first.id());
    }

    @Test
    void activateSwitchesTheResolvedBaseUrlImmediately() {
        Config second = registry.create("shared-dev", "http://cp.dev.internal:8080");

        registry.activate(second.id());

        assertThat(registry.activeBaseUrl()).contains("http://cp.dev.internal:8080");
    }

    @Test
    void deletingTheActiveConfigFallsBackToWhateverIsLeft() {
        Config first = registry.list().get(0);
        Config second = registry.create("shared-dev", "http://cp.dev.internal:8080");
        registry.activate(first.id());

        registry.delete(first.id());

        assertThat(registry.activeId()).isEqualTo(second.id());
        assertThat(registry.activeBaseUrl()).contains("http://cp.dev.internal:8080");
    }

    @Test
    void deletingTheLastConfigLeavesNothingConnected() {
        registry.delete(registry.list().get(0).id());

        assertThat(registry.list()).isEmpty();
        assertThat(registry.activeBaseUrl()).isEmpty();
    }

    @Test
    void deactivateDisconnectsWithoutRemovingAnyConfig() {
        Config first = registry.list().get(0);

        registry.deactivate();

        assertThat(registry.activeBaseUrl()).isEmpty();
        assertThat(registry.list()).containsExactly(first);
    }

    @Test
    void reconnectingAfterDeactivateWorks() {
        Config first = registry.list().get(0);
        registry.deactivate();

        registry.activate(first.id());

        assertThat(registry.activeBaseUrl()).contains("http://localhost:8080");
    }

    @Test
    void activatingAnUnknownIdIs404() {
        assertThatThrownBy(() -> registry.activate("missing")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void trailingSlashesAreNormalizedAwaySoUrlConcatenationNeverDoubleSlashes() {
        Config created = registry.create("x", "http://cp.example.com:8080/");

        assertThat(created.baseUrl()).isEqualTo("http://cp.example.com:8080");
    }
}

package ai.gargantua.studio.controlplane;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ai.gargantua.studio.common.UpstreamException;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class ControlPlaneClientTest {

    @Test
    void everyCallFailsClearlyWhenNoControlPlaneIsConnected() {
        ControlPlaneRegistry registry = mock(ControlPlaneRegistry.class);
        when(registry.activeBaseUrl()).thenReturn(Optional.empty());
        ControlPlaneClient client = new ControlPlaneClient(RestClient.builder().build(), registry);

        assertThatThrownBy(() -> client.get("/api/v1/registry/bundles"))
                .isInstanceOf(UpstreamException.class)
                .hasMessageContaining("No Control Plane is connected");
    }
}

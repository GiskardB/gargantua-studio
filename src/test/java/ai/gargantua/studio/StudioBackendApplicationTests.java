package ai.gargantua.studio;

import ai.gargantua.studio.controlplane.ControlPlaneClient;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest
class StudioBackendApplicationTests {

    // Mocked so the context loads without a running Control Plane.
    @MockitoBean
    private ControlPlaneClient controlPlane;

    @Test
    void contextLoads() {
    }
}

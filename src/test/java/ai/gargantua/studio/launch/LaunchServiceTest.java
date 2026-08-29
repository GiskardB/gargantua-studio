package ai.gargantua.studio.launch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ai.gargantua.studio.controlplane.ControlPlaneClient;
import ai.gargantua.studio.launch.LaunchService.LaunchResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

class LaunchServiceTest {

    private SettingsStore settings;
    private ControlPlaneClient controlPlane;

    @BeforeEach
    void setUp() {
        settings = mock(SettingsStore.class);
        when(settings.get(LaunchService.TEMPLATE_KEY)).thenReturn(Optional.empty());
        controlPlane = mock(ControlPlaneClient.class);
    }

    private LaunchService serviceWithTemplate(String template) {
        return new LaunchService(settings, template, ".", controlPlane, new ObjectMapper());
    }

    @Test
    void reportsHealthyDeploymentStateOnSuccessfulLaunch() {
        when(controlPlane.createDeployment("customer-agent", "1.0.0"))
                .thenReturn(ResponseEntity.ok("{\"id\":\"dep-1\"}"));

        LaunchResult result = serviceWithTemplate("true").launch("customer-agent", "1.0.0");

        assertThat(result.exitCode()).isZero();
        verify(controlPlane).updateDeploymentState("dep-1", "HEALTHY");
    }

    @Test
    void reportsFailedDeploymentStateWhenTheLaunchCommandFails() {
        when(controlPlane.createDeployment("customer-agent", "1.0.0"))
                .thenReturn(ResponseEntity.ok("{\"id\":\"dep-2\"}"));

        LaunchResult result = serviceWithTemplate("false").launch("customer-agent", "1.0.0");

        assertThat(result.exitCode()).isNotZero();
        verify(controlPlane).updateDeploymentState("dep-2", "FAILED");
    }

    @Test
    void launchStillWorksWhenTheControlPlaneIsUnreachable() {
        when(controlPlane.createDeployment(any(), any())).thenThrow(new RuntimeException("offline"));

        LaunchResult result = serviceWithTemplate("true").launch("customer-agent", "1.0.0");

        assertThat(result.exitCode()).isZero();
        verify(controlPlane, never()).updateDeploymentState(any(), any());
    }
}

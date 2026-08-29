package ai.gargantua.studio.launch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ai.gargantua.studio.controlplane.ControlPlaneClient;
import ai.gargantua.studio.launch.LaunchService.LaunchResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

class LaunchServiceTest {

    private SettingsStore settings;
    private ControlPlaneClient controlPlane;
    private HttpServer healthServer;
    private String healthUrl;

    @BeforeEach
    void setUp() throws IOException {
        settings = mock(SettingsStore.class);
        when(settings.get(LaunchService.TEMPLATE_KEY)).thenReturn(Optional.empty());
        controlPlane = mock(ControlPlaneClient.class);

        // A real (loopback-only) HTTP server standing in for the runtime's actuator/health,
        // so "the launched agent actually answers" can be tested without Docker.
        healthServer = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        healthServer.createContext("/health", exchange -> {
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        healthServer.start();
        healthUrl = "http://localhost:" + healthServer.getAddress().getPort() + "/health";
    }

    @AfterEach
    void tearDown() {
        healthServer.stop(0);
    }

    private LaunchService serviceWithTemplate(String template) {
        return new LaunchService(settings, template, ".", controlPlane, new ObjectMapper(), healthUrl, 5, 100);
    }

    @Test
    void reportsHealthyDeploymentStateOnceTheRuntimeAnswersHealthChecks() {
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
    void reportsFailedDeploymentStateWhenTheRuntimeNeverBecomesHealthy() {
        when(controlPlane.createDeployment("customer-agent", "1.0.0"))
                .thenReturn(ResponseEntity.ok("{\"id\":\"dep-3\"}"));
        // The docker command itself succeeds ("true"), but nothing is listening at this URL —
        // the app inside never finished booting. That must still surface as a failed launch,
        // not a silent HEALTHY that leaves the Playground pointing at a dead agent.
        LaunchService unhealthy =
                new LaunchService(settings, "true", ".", controlPlane, new ObjectMapper(), "http://localhost:1", 1, 100);

        LaunchResult result = unhealthy.launch("customer-agent", "1.0.0");

        assertThat(result.exitCode()).isNotZero();
        verify(controlPlane).updateDeploymentState("dep-3", "FAILED");
    }

    @Test
    void splicesExtraEnvVarsIntoTheCommandAtTheEnvPlaceholder() {
        when(controlPlane.createDeployment("customer-agent", "1.0.0"))
                .thenReturn(ResponseEntity.ok("{\"id\":\"dep-4\"}"));

        LaunchResult result = serviceWithTemplate("true {env}")
                .launch("customer-agent", "1.0.0", Map.of("FOO", "bar's value"));

        assertThat(result.exitCode()).isZero();
        assertThat(result.command()).contains("-e FOO='bar'\\''s value'");
    }

    @Test
    void rejectsAnInvalidEnvironmentVariableName() {
        assertThatThrownBy(() ->
                serviceWithTemplate("true {env}").launch("customer-agent", "1.0.0", Map.of("not valid!", "x")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void launchStillWorksWhenTheControlPlaneIsUnreachable() {
        when(controlPlane.createDeployment(any(), any())).thenThrow(new RuntimeException("offline"));

        LaunchResult result = serviceWithTemplate("true").launch("customer-agent", "1.0.0");

        assertThat(result.exitCode()).isZero();
        verify(controlPlane, never()).updateDeploymentState(any(), any());
    }
}

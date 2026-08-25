package ai.gargantua.studio.security;

import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Two postures, selected by profile:
 *
 * <ul>
 *   <li><b>default (dev)</b> — everything is open. Cave runs the whole platform locally
 *       without an identity provider, so requiring auth would only get in the way.</li>
 *   <li><b>{@code oidc}</b> — the API is a JWT resource server (Keycloak/OIDC). Turn it
 *       on with {@code --spring.profiles.active=oidc} and point
 *       {@code spring.security.oauth2.resourceserver.jwt.issuer-uri} at the realm.</li>
 * </ul>
 *
 * Both disable CSRF (this is a token/stateless API) and allow the Studio frontend's
 * dev origins through CORS.
 */
@Configuration
public class SecurityConfig {

    @Bean
    @Profile("!oidc")
    public SecurityFilterChain devSecurity(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }

    @Bean
    @Profile("oidc")
    public SecurityFilterChain oidcSecurity(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/", "/actuator/health").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        // Vite dev server and Cave's published-site host; adjust for real deployments.
        cfg.setAllowedOriginPatterns(List.of("http://localhost:*", "https://*"));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}

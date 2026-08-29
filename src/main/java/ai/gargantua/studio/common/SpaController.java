package ai.gargantua.studio.common;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

/**
 * Serve the bundled SPA for React Router routes. A catch-all instead of one mapping per
 * route: an enumerated list silently 500s on every new client-side route until someone
 * remembers to add it here (it already had, e.g. {@code /control-plane} was missing).
 * The {@code [^.]*} guard excludes paths with a dot so real static assets (js/css/etc.)
 * still fall through to the resource handler. Single path segment only — every current
 * client-side route is top-level; a wildcard suffix would also swallow nested asset
 * paths like {@code /assets/app.js}, since browsers send a wildcard Accept header.
 */
@RestController
public class SpaController {

    @GetMapping(value = {"/", "/{path:[^.]*}"}, produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<byte[]> spa() throws IOException {
        return serveIndex();
    }

    private ResponseEntity<byte[]> serveIndex() throws IOException {
        ClassPathResource resource = new ClassPathResource("static/index.html");
        byte[] bytes = resource.getContentAsByteArray();
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(bytes);
    }
}

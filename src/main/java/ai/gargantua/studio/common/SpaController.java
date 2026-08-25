package ai.gargantua.studio.common;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

/** Serve the bundled SPA for React Router routes. */
@RestController
public class SpaController {

    @GetMapping(value = "/", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<byte[]> root() throws IOException {
        return serveIndex();
    }

    @GetMapping(value = "/agent", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<byte[]> agent() throws IOException {
        return serveIndex();
    }

    @GetMapping(value = "/skill", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<byte[]> skill() throws IOException {
        return serveIndex();
    }

    @GetMapping(value = "/workload", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<byte[]> workload() throws IOException {
        return serveIndex();
    }

    @GetMapping(value = "/capability", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<byte[]> capability() throws IOException {
        return serveIndex();
    }

    @GetMapping(value = "/playground", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<byte[]> playground() throws IOException {
        return serveIndex();
    }

    @GetMapping(value = "/trace", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<byte[]> trace() throws IOException {
        return serveIndex();
    }

    @GetMapping(value = "/evaluation", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<byte[]> evaluation() throws IOException {
        return serveIndex();
    }

    @GetMapping(value = "/gateway", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<byte[]> gateway() throws IOException {
        return serveIndex();
    }

    @GetMapping(value = "/security", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<byte[]> security() throws IOException {
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

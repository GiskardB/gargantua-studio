package ai.gargantua.studio.drafts;

import ai.gargantua.studio.drafts.model.SavedDraft;
import ai.gargantua.studio.manifest.AgentDraftRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** CRUD over Agent Designer drafts, so the designer has durable server-side state. */
@RestController
@RequestMapping("/api/studio/drafts")
public class DraftController {

    private final DraftService drafts;

    public DraftController(DraftService drafts) {
        this.drafts = drafts;
    }

    @GetMapping
    public List<SavedDraft> list() {
        return drafts.list();
    }

    @GetMapping("/{id}")
    public SavedDraft get(@PathVariable String id) {
        return drafts.get(id);
    }

    @PostMapping
    public ResponseEntity<SavedDraft> create(@RequestBody AgentDraftRequest draft) {
        return ResponseEntity.status(HttpStatus.CREATED).body(drafts.create(draft));
    }

    @PutMapping("/{id}")
    public SavedDraft update(@PathVariable String id, @RequestBody AgentDraftRequest draft) {
        return drafts.update(id, draft);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        drafts.delete(id);
        return ResponseEntity.noContent().build();
    }
}

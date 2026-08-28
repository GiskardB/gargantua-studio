package ai.gargantua.studio.manifest;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.stereotype.Component;

/**
 * Builds the exact {@code .gbundle} zip structure the Control Plane assembles on
 * publish ({@code manifest.yaml} + {@code skills/<name>/SKILL.md} +
 * {@code skills/<name>/references/<filename>}) — but entirely locally, no Control
 * Plane involved. Backs the Agent Designer's "Download bundle" button, so a developer
 * can inspect (or hand to a Runtime directly) exactly what would be published, with
 * only the Studio running.
 */
@Component
public class BundleZipBuilder {

    public byte[] build(
            String manifestYaml, Map<String, String> skillFiles, Map<String, Map<String, String>> skillReferenceFiles) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            zip.putNextEntry(new ZipEntry("manifest.yaml"));
            zip.write(manifestYaml.getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            for (Map.Entry<String, String> skill : skillFiles.entrySet()) {
                zip.putNextEntry(new ZipEntry("skills/" + skill.getKey() + "/SKILL.md"));
                zip.write(skill.getValue().getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
            for (Map.Entry<String, Map<String, String>> skill : skillReferenceFiles.entrySet()) {
                for (Map.Entry<String, String> file : skill.getValue().entrySet()) {
                    zip.putNextEntry(new ZipEntry(
                            "skills/" + skill.getKey() + "/references/" + file.getKey()));
                    zip.write(file.getValue().getBytes(StandardCharsets.UTF_8));
                    zip.closeEntry();
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException("cannot build bundle zip", e);
        }
        return out.toByteArray();
    }
}

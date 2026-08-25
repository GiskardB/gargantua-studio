package ai.gargantua.studio.launch;

import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * A tiny key→value settings store on the same {@code studio_settings} table shape used
 * elsewhere (portable across H2 and Postgres). Only used for a handful of admin-editable
 * platform settings, the launch command template being the first.
 */
@Repository
public class SettingsStore {

    private final JdbcTemplate jdbc;

    public SettingsStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<String> get(String key) {
        return jdbc.query("SELECT v FROM studio_settings WHERE k = ?",
                        (rs, n) -> rs.getString(1), key)
                .stream().findFirst();
    }

    @Transactional
    public void put(String key, String value) {
        int updated = jdbc.update("UPDATE studio_settings SET v = ? WHERE k = ?", value, key);
        if (updated == 0) {
            jdbc.update("INSERT INTO studio_settings (k, v) VALUES (?, ?)", key, value);
        }
    }
}

package cz.mzk.vera.plugins;

import cz.mzk.vera.pluginhost.InstalledPlugins;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

// PLG-contract; B6: load installed package versions once when this VERA process starts.
@Component
public class PluginPackageInstallation implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    private final InstalledPlugins installed;

    public PluginPackageInstallation(JdbcTemplate jdbc, InstalledPlugins installed) {
        this.jdbc = jdbc;
        this.installed = installed;
    }

    @Override
    public void run(ApplicationArguments args) {
        jdbc.query("SELECT jar FROM plugin_packages ORDER BY implementation_id, version", result -> {
            while (result.next()) {
                installed.install(result.getBytes(1));
            }
            return null;
        });
    }
}

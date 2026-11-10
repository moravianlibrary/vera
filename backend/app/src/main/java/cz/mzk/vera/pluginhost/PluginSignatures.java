package cz.mzk.vera.pluginhost;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.jar.JarEntry;
import java.util.jar.JarInputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

// B6 Signed; PLG-upload: verify every package payload entry against deployment trust.
@Component
public class PluginSignatures {
    private final Set<String> trusted;

    public PluginSignatures(@Value("${vera.plugins.trusted-certificates}") String bundle) {
        trusted = new HashSet<>();
        if (bundle == null || bundle.isBlank()) {
            return;
        }
        try (java.io.InputStream stream = bundle.startsWith("classpath:")
                ? PluginSignatures.class.getClassLoader().getResourceAsStream(bundle.substring(10))
                : Files.newInputStream(Path.of(bundle))) {
            if (stream == null) {
                throw new IllegalStateException("Could not find trusted plugin certificate bundle.");
            }
            CertificateFactory factory = CertificateFactory.getInstance("X.509");
            Collection<? extends Certificate> certificates = factory.generateCertificates(stream);
            for (Certificate certificate : certificates) {
                trusted.add(java.util.HexFormat.of().formatHex(certificate.getEncoded()));
            }
        } catch (Exception exception) {
            throw new IllegalStateException("Could not read trusted plugin certificates.", exception);
        }
    }

    public void verify(byte[] bytes) {
        boolean payloadFound = false;
        try (JarInputStream jar = new JarInputStream(new ByteArrayInputStream(bytes), true)) {
            JarEntry entry;
            while ((entry = jar.getNextJarEntry()) != null) {
                jar.readAllBytes();
                if (entry.isDirectory() || signatureMetadata(entry.getName())) {
                    continue;
                }
                payloadFound = true;
                Certificate[] certificates = entry.getCertificates();
                if (certificates == null || certificates.length == 0
                        || !trusted.contains(java.util.HexFormat.of().formatHex(certificates[0].getEncoded()))) {
                    throw new SecurityException("Every plugin package entry must be signed by a trusted certificate.");
                }
            }
        } catch (IOException | java.security.cert.CertificateEncodingException exception) {
            throw new SecurityException("Could not verify plugin package signature.", exception);
        }
        if (!payloadFound) {
            throw new SecurityException("Plugin package has no signed entries.");
        }
    }

    private boolean signatureMetadata(String name) {
        String upper = name.toUpperCase(java.util.Locale.ROOT);
        return upper.equals("META-INF/MANIFEST.MF") || upper.startsWith("META-INF/")
                && (upper.endsWith(".SF") || upper.endsWith(".RSA") || upper.endsWith(".DSA")
                        || upper.endsWith(".EC"));
    }
}

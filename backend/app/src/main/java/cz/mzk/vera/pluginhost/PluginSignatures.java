package cz.mzk.vera.pluginhost;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.CodeSigner;
import java.security.cert.Certificate;
import java.security.cert.CertificateEncodingException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Collection;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;
import java.util.jar.JarEntry;
import java.util.jar.JarInputStream;
import javax.naming.InvalidNameException;
import javax.naming.ldap.LdapName;
import javax.naming.ldap.Rdn;
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
        try (InputStream stream = bundle.startsWith("classpath:")
                ? PluginSignatures.class.getClassLoader().getResourceAsStream(bundle.substring(10))
                : Files.newInputStream(Path.of(bundle))) {
            if (stream == null) {
                throw new IllegalStateException("Could not find trusted plugin certificate bundle.");
            }
            CertificateFactory factory = CertificateFactory.getInstance("X.509");
            Collection<? extends Certificate> certificates = factory.generateCertificates(stream);
            for (Certificate certificate : certificates) {
                trusted.add(HexFormat.of().formatHex(certificate.getEncoded()));
            }
        } catch (Exception exception) {
            throw new IllegalStateException("Could not read trusted plugin certificates.", exception);
        }
    }

    public String verify(byte[] bytes) {
        X509Certificate signer = null;
        try (JarInputStream jar = new JarInputStream(new ByteArrayInputStream(bytes), true)) {
            JarEntry entry;
            while ((entry = jar.getNextJarEntry()) != null) {
                jar.readAllBytes();
                if (entry.isDirectory() || signatureMetadata(entry.getName())) {
                    continue;
                }
                CodeSigner[] signers = entry.getCodeSigners();
                if (signers == null || signers.length != 1) {
                    throw new SecurityException("Every plugin package entry must have one trusted signer.");
                }
                X509Certificate certificate = (X509Certificate) signers[0].getSignerCertPath()
                        .getCertificates().getFirst();
                if (!trusted.contains(HexFormat.of().formatHex(certificate.getEncoded()))
                        || signer != null && !signer.equals(certificate)) {
                    throw new SecurityException("Every plugin package entry must have the same trusted signer.");
                }
                signer = certificate;
            }
        } catch (IOException | CertificateEncodingException exception) {
            throw new SecurityException("Could not verify plugin package signature.", exception);
        }
        if (signer == null) {
            throw new SecurityException("Plugin package has no signed entries.");
        }
        String subject = signer.getSubjectX500Principal().getName();
        try {
            for (Rdn name : new LdapName(subject).getRdns()) {
                if (name.getType().equalsIgnoreCase("CN")) {
                    return name.getValue().toString();
                }
            }
        } catch (InvalidNameException exception) {
            throw new SecurityException("Could not read plugin signer subject.", exception);
        }
        return subject;
    }

    private boolean signatureMetadata(String name) {
        String upper = name.toUpperCase(Locale.ROOT);
        return upper.equals("META-INF/MANIFEST.MF") || upper.startsWith("META-INF/")
                && (upper.endsWith(".SF") || upper.endsWith(".RSA") || upper.endsWith(".DSA")
                        || upper.endsWith(".EC"));
    }
}

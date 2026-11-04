package cz.mzk.vera.plugin.identity;

import java.util.List;

// PLG-api-kinds: Identity.
public record CompleteAnswer(
        String externalId, String email, boolean emailVerified, String name, List<String> claims) {}

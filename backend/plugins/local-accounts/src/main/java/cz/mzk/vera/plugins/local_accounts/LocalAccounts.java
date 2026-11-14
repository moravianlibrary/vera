package cz.mzk.vera.plugins.local_accounts;

import cz.mzk.vera.plugin.PasswordCheck;
import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.identity.BeginAnswer;
import cz.mzk.vera.plugin.identity.BeginInput;
import cz.mzk.vera.plugin.identity.CompleteAnswer;
import cz.mzk.vera.plugin.identity.CompleteInput;
import cz.mzk.vera.plugin.identity.Identity;
import cz.mzk.vera.plugin.identity.IdentityRefusal;
import cz.mzk.vera.plugin.identity.IdentityRefused;
import java.util.List;

// ACCESS-local-account; PLG-api-kinds: Identity.
public final class LocalAccounts implements Identity {
    @Override
    public BeginAnswer begin(PluginContext context, BeginInput input) {
        return new BeginAnswer(null);
    }

    @Override
    public CompleteAnswer complete(PluginContext context, CompleteInput input) {
        if (!(input instanceof CompleteInput.Form form)) {
            throw new IdentityRefused(IdentityRefusal.NOT_ALLOWED);
        }
        PasswordCheck check = context.localPasswords().check(form.username(), form.password());
        if (check != PasswordCheck.MATCHES) {
            throw new IdentityRefused(IdentityRefusal.WRONG_CREDENTIALS);
        }
        return new CompleteAnswer(form.username(), null, false, form.username(), List.of());
    }
}

# Keep the plugins configured and current

**Who.** An administrator: Petr Dvořák.

**Goal.** "Install the new version of the validation rules, add a second catalog, and retire an
old login."

**Starting state.**
- Four Identity instances are enabled.
- A catalog-validity implementation has a newer version waiting to be uploaded.

## Steps

1. On *Plugins* he uploads the new package.
   → It is read first and shows what it adds and retires; installing adds the version, and no
   instance moves ([PLG-upload](../../reference/integrations/plugins.md#plg-upload)).
2. He moves the instance to the new version.
   → What the version adds and retires is listed first
   ([PLG-upgrade](../../reference/integrations/plugins.md#plg-upgrade)).
3. He creates a second webhook Delivery channel instance with its secret, and leaves the secret
   blank on a later edit.
   → The secret keeps its value ([PLG-secrets](../../reference/integrations/plugins.md#plg-secrets)).
4. He disables one Identity instance.
   → First he reads what stops: how many people log in through it. It leaves the login page
   ([ACCESS-instance-disabled](../../reference/access/people.md#access-instance-disabled)).
5. He disables the others but one, and then tries the last one.
   → The last is refused ([ACCESS-last-identity](../../reference/access/people.md#access-last-identity)).
6. He runs a harvester now.
   → A run appears on Tasks ([ACT-instance-run](../../reference/access/acts.md#plugins)).

## Rules

[PLG-model](../../reference/integrations/plugins.md#plg-model) ·
[PLG-contract](../../reference/integrations/plugins.md#plg-contract) ·
[PLG-disable](../../reference/integrations/plugins.md#plg-disable) ·
[ACT-plugin-upload](../../reference/access/acts.md#plugins)

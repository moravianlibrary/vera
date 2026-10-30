# DEC-0016: A person may create their own local account

Amends [ACCESS-local-account](../reference/access/people.md#access-local-account), under which
only an admin created one.

**Context.** The public's way in is Google or Seznam
([DEC-0015](DEC-0015-public-requests-by-entry-link.md)), but not everyone who asks for a
digitization has either or wants to use one. The old VERA let people register. Without it, such a
person needs an admin to create an account before they can ask.

**Decision.**
- A local-accounts Identity instance may allow **sign-up**. While it does, its login form offers
  *Create an account*: a name, an email, a username and a password.
- The account works only once its **email is verified**, through a link sent to it. It gets the
  instance's default role, as any first login does.
- **Forgot your password?** sends a link to set a new one.
- Neither form says whether an email already has an account: both always answer *check your
  email*, and the email says what happened.
- The emails go through a Delivery channel instance the local-accounts instance names (an SMTP
  or Gmail mailer). Sign-up cannot be turned on without one.
- An admin still creates local accounts by hand, sign-up on or off.

**Rejected.**
- Sign-up without verifying the email: anyone could create accounts in other people's names, and
  a request's outcome would be sent to whatever address was typed.
- A captcha: a hidden field and limits per address and per email stop the scripted sign-ups seen
  so far; a captcha service is added if they do not.
- A separate sign-up for each provider: Google and Seznam create the account at first login
  ([ACCESS-first-login](../reference/access/people.md#access-first-login)).

**Rules.** [ACCESS-local-account](../reference/access/people.md#access-local-account),
[ACCESS-sign-up](../reference/access/people.md#access-sign-up),
[ACCESS-verify-email](../reference/access/people.md#access-verify-email),
[ACCESS-password-reset](../reference/access/people.md#access-password-reset),
[ACCESS-no-enumeration](../reference/access/people.md#access-no-enumeration). Built ([L71](../ledger.md#built-2026-10-29)).

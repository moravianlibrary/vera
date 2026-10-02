# Messaging

How a person in VERA reaches another about a record: **VERA does not carry
the conversation**. A *Message…* action hands it to a **Message plugin**,
which opens a mail, a chat or a ticket somewhere people already talk.
Decided with the user on 2026-10-01, replacing the "channel" idea.

---

## 1. Why not a channel inside VERA

A channel would need threads, unread state, notifications and moderation,
and nobody would read it: the library already talks in mail and chat. What
VERA knows, and those tools do not, is **who** to ask and **about what**.
So VERA resolves the recipient and the context, and the plugin takes it
from there.

---

## 2. Message plugins

A plugin kind of its own, **Message**. An instance is given:

| | |
|---|---|
| **recipients** | users, resolved by VERA (§3), with what the instance needs of them: email, chat handle, from the Identity claims or the user record |
| **subject** | the record: *IT2041 · Herbář moravský*, and a link back to it in VERA |
| **context** | why: *Forbidden by rule IT18*, *proposed into NDK Periodika* |
| **sender** | the user writing |

and returns one of:

| Result | Example | |
|---|---|---|
| **a redirect** | `mailto:…?subject=…&body=…`, a Slack deep link, a new ticket form | the default: opened in a new tab, pre-filled, sent by the person in their own tool |
| **sent** | posted by the plugin to a chat channel or a ticket queue | for instances that send on their own; the dialog asks for the text first |

**Implementations**: email (`mailto:`), Slack or Teams (deep link to a DM or
channel), a ticketing system. Several instances can be enabled; the dialog
offers them in their **order**, the first preselected.

**Delivery channels are not this.** Those carry *hooks*, machine events to a
fixed destination ([[view-catalog]] Plugins). A Message instance is one
person writing to another. An implementation may provide both.

---

## 3. Who a message goes to

VERA resolves recipients from the record, never from a typed address:

| Message… on | Goes to |
|---|---|
| a Forbidden item (Validations) | admins: holders of `restriction.overrule` |
| a proposal (Proposals) | its requesters |
| a project | its manager; the manager may message its members |
| an item on a list | the list's author, or the dig-curators |
| a user (Users & Groups) | that user |
| a plugin instance or a failed task | admins: holders of `plugin.configure` |

The dialog shows who it will reach before opening anything. A recipient with
no address the instance can use is listed as *not reachable by mail* and
left out.

---

## 4. What VERA keeps

- **Nothing of the text.** It lives in the mail or the chat.
- **That a message was started**, for *sent* results only: *Jana messaged
  admins about IT2041 via #vera-admins*. A redirect is not logged, because
  VERA cannot know it was sent.
- **No permission of its own.** *Message…* appears wherever the user can see
  the record; reaching someone is not a capability. With no Message
  instance enabled, there is no *Message…* action.

---

## 5. Open

- **Reply into VERA.** A ticket plugin could report back (*answered*,
  *closed*). Not needed yet.

## Related

- [[permissions]]: who the recipients are
- [[view-map]]: §2.3 Validations, the Forbidden filter
- [[view-catalog]]: Plugins, the Message type

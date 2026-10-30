# Messaging

How a person reaches another about a record. VERA does not carry the conversation: *Message…*
hands it to a Message plugin, which opens a mail or a chat where people already talk.

#### MSG-handoff

A Message instance is given the recipients VERA resolved, the record with a link back to it, why
the message is about it, and who is writing. It answers in one of two ways, fixed by its
implementation:
- **a redirect** (a pre-filled `mailto:` or a chat deep link) that opens in the person's own
  tool, where they write and send it;
- **sent**: the instance posts the message itself, to a chat channel or a ticket queue. For such
  an instance the dialog asks for the text first, and the instance is given it with the rest; the
  dialog then says it was sent, or why the instance refused.

#### MSG-recipients

VERA resolves who a message goes to from the record, never from a typed address:

Each act is named for who it reaches, and a record may offer several.

| On | Act | Goes to |
|---|---|---|
| a proposal | *Message askers…* | its askers |
| a forbidden item | *Ask to overrule…* | the people who may overrule it (`restriction.overrule`) |
| a forbidden item | *Message askers…* | its askers |
| a project | *Message manager…* | its manager |
| a listed item | *Message list author…* | whoever made the list |

A recipient with no address the instance can use is listed as not reachable and left out. The
dialog shows who it will reach before anything opens.

There is no *Message…* on a user or a plugin run: VERA is not a mail client
([DEC-0010](../../decisions/DEC-0010-messaging-hands-off.md)), and hooks tell administrators about
failed runs.

#### MSG-keeps-nothing

VERA keeps nothing of a message, the text a sending instance was given included, and neither
result is logged: after a redirect VERA cannot know it was sent.
*Message…* needs no permission of its own beyond seeing the record.

#### MSG-order

Several Message instances can be enabled; the dialog offers them in their order, the first
preselected. With none enabled there is no *Message…*.

#### MSG-not-hooks

Delivery channels carry hooks, machine events to a fixed destination. A Message instance is one
person writing to another.

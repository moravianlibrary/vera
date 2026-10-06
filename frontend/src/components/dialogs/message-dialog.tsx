// The one Message dialog (component-interfaces.md §6.8; messaging.md; vera-ui.js message): who it
// goes to, resolved by the server from the record and never typed, what it is about, and which
// Message instance to send it with, the first preselected. It hands off: *Open in Email* opens
// the person's own mail or chat, pre-filled, in a new tab, and VERA keeps none of the text. A
// recipient the chosen instance cannot reach is named and left out.
// Unlike the sketch, the dialog asks for the recipients and the instances itself, so each
// *Message…* only names its record.
// TODO(rrandiak): instances that send on their own ask for the text first (messaging.md §2);
// labels move to i18n.

import { useId, useState } from "react";
import type { MessageSubject } from "@/api/messages";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMessageChannelsQuery, useMessageHandOffQuery } from "@/hooks/use-message-query";

interface MessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  subject: MessageSubject;
  // The record as the title names it: "Herbář moravský".
  label: string;
  // Who the recipients are to the record: "who asked".
  recipientLabel: string;
}

export function MessageDialog({
  isOpen,
  onClose,
  subject,
  label,
  recipientLabel,
}: MessageDialogProps) {
  const fieldId = useId();
  const { data: channels = [] } = useMessageChannelsQuery();
  const handOffQuery = useMessageHandOffQuery(isOpen ? subject : null);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const channel = channels.find((candidate) => candidate.id === pickedId) ?? channels[0];
  const handOff = handOffQuery.data;
  const channelHandOff = handOff?.handOffs.find((each) => each.channelId === channel?.id);
  const reachableIds = new Set(channelHandOff?.reachableIds ?? []);
  const reachable = handOff?.recipients.filter(({ userId }) => reachableIds.has(userId)) ?? [];
  const unreachable = handOff?.recipients.filter(({ userId }) => !reachableIds.has(userId)) ?? [];
  const channelName = channel?.name ?? "";

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={onClose}
      title={`Message about ${label}`}
      description={`Write to ${recipientLabel} about ${label}`}
      refusal={
        handOffQuery.isError
          ? { status: null, code: null, message: "Who it goes to could not be found. Try again." }
          : null
      }
      primary={{
        label: `Open in ${channelName}`,
        href: channelHandOff?.href ?? undefined,
        isDisabled: (channelHandOff?.href ?? null) === null,
        onSelect: onClose,
      }}
    >
      {handOff === undefined ? (
        <p className="text-muted-foreground">Finding who it goes to…</p>
      ) : (
        <div className="grid gap-4">
          <section>
            <h3 className="mb-1.5 text-xs font-semibold">
              To <span className="font-normal text-muted-foreground">— {recipientLabel}</span>
            </h3>
            {reachable.length === 0 ? (
              <p className="text-muted-foreground">Nobody this way.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {reachable.map((recipient) => (
                  <li key={recipient.userId}>
                    <Badge variant="secondary" className="text-sm font-normal">
                      {recipient.name}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            {unreachable.length > 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Not reachable by {channelName}:{" "}
                {unreachable.map((recipient) => recipient.name).join(", ")} — left out.
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold">About</h3>
            <p>{handOff.context}</p>
          </section>

          {channels.length > 1 && (
            <section>
              <h3 id={`${fieldId}-channels`} className="mb-1.5 text-xs font-semibold">
                Send with
              </h3>
              <RadioGroup
                aria-labelledby={`${fieldId}-channels`}
                value={channel?.id}
                onValueChange={setPickedId}
                className="gap-2"
              >
                {channels.map((each) => (
                  <div key={each.id} className="flex items-center gap-2">
                    <RadioGroupItem id={`${fieldId}-${each.id}`} value={each.id} />
                    <Label htmlFor={`${fieldId}-${each.id}`} className="font-normal">
                      <b className="font-semibold">{each.name}</b>
                      <span className="text-muted-foreground">· {each.description}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </section>
          )}

          <p className="text-xs text-muted-foreground">
            You write and send it yourself. VERA keeps none of the text, and does not log a message
            it only opened for you.
          </p>
        </div>
      )}
    </DialogShell>
  );
}

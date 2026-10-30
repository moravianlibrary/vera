// The one Message dialog (component-interfaces.md §6.8; messaging.md; vera-ui.js message): who it
// goes to, resolved by the server from the record and never typed, what it is about, and which
// Message instance to send it with, the first preselected. It hands off: *Open in Email* opens
// the person's own mail or chat, pre-filled, in a new tab, and VERA keeps none of the text. A
// recipient the chosen instance cannot reach is named and left out.
// Unlike the sketch, the dialog asks for the recipients and the instances itself, so each
// *Message…* only names its record.
// A sending instance gets the typed text and reports who it reached; VERA keeps neither
// (MSG-handoff, MSG-keeps-nothing).

import type { MessageSubject } from "@vera/contract/messages";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/classification-fields";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { Refusal } from "@/hooks/use-action-mutation";
import {
  useMessageChannelsQuery,
  useMessageHandOffQuery,
  useSendMessage,
} from "@/hooks/use-message-query";

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
  const { t } = useTranslation("common");
  const fieldId = useId();
  const { data: channels = [] } = useMessageChannelsQuery();
  const handOffQuery = useMessageHandOffQuery(isOpen ? subject : null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sentNames, setSentNames] = useState<string[] | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  const channel = channels.find((candidate) => candidate.id === pickedId) ?? channels[0];
  const handOff = handOffQuery.data;
  const channelHandOff = handOff?.handOffs.find((each) => each.channelId === channel?.id);
  const reachableIds = new Set(channelHandOff?.reachableIds ?? []);
  const reachable = handOff?.recipients.filter(({ userId }) => reachableIds.has(userId)) ?? [];
  const unreachable = handOff?.recipients.filter(({ userId }) => !reachableIds.has(userId)) ?? [];
  const channelName = channel?.name ?? "";
  const isSending = channel?.result === "sent";
  const mutation = useSendMessage(subject);
  const send = async () => {
    if (channel === undefined) return;
    const result = await mutation.run({ channelId: channel.id, text: text.trim() });
    if (result.isDone) {
      setSentNames(
        result.value.reachedIds.map(
          (id) => handOff?.recipients.find((recipient) => recipient.userId === id)?.name ?? id,
        ),
      );
    } else {
      setRefusal(result.refusal);
    }
  };

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={onClose}
      title={t("message.title", { label })}
      description={t("message.description", { recipient: recipientLabel, label })}
      refusal={
        refusal ??
        (handOffQuery.isError
          ? { status: null, code: null, message: t("message.recipientLookupError") }
          : null)
      }
      primary={{
        label:
          sentNames !== null
            ? t("dialog.close")
            : isSending
              ? t("message.send")
              : t("message.openIn", { channel: channelName }),
        href: !isSending && sentNames === null ? (channelHandOff?.href ?? undefined) : undefined,
        isDisabled:
          sentNames === null &&
          (isSending ? text.trim() === "" : (channelHandOff?.href ?? null) === null),
        disabledReason: isSending && text.trim() === "" ? t("message.writeFirst") : undefined,
        isPending: mutation.isPending,
        onSelect: sentNames !== null ? onClose : isSending ? () => void send() : onClose,
      }}
      cancelLabel={sentNames !== null ? null : undefined}
    >
      {sentNames !== null ? (
        <p>{t("message.sentTo", { names: sentNames.join(", ") })}</p>
      ) : handOff === undefined ? (
        <p className="text-muted-foreground">{t("message.findingRecipients")}</p>
      ) : (
        <div className="grid gap-4">
          <section>
            <h3 className="mb-1.5 text-xs font-semibold">
              To <span className="font-normal text-muted-foreground">— {recipientLabel}</span>
            </h3>
            {reachable.length === 0 ? (
              <p className="text-muted-foreground">{t("message.noRecipients")}</p>
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
                {t("message.unreachable", {
                  channel: channelName,
                  names: unreachable.map((recipient) => recipient.name).join(", "),
                })}
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold">{t("message.about")}</h3>
            <p>{handOff.context}</p>
          </section>

          {channels.length > 1 && (
            <section>
              <h3 id={`${fieldId}-channels`} className="mb-1.5 text-xs font-semibold">
                {t("message.sendWith")}
              </h3>
              <RadioGroup
                aria-labelledby={`${fieldId}-channels`}
                value={channel?.id}
                onValueChange={(id) => {
                  setPickedId(id);
                  setRefusal(null);
                }}
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

          {isSending && (
            <Field id={`${fieldId}-message`} label={t("message.message")}>
              <Textarea
                id={`${fieldId}-message`}
                rows={4}
                required
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setRefusal(null);
                }}
              />
            </Field>
          )}

          {!isSending && <p className="text-xs text-muted-foreground">{t("message.privacy")}</p>}
        </div>
      )}
    </DialogShell>
  );
}

// A record name in the interface language and, when needed, the other one (UI-names).

import type { Names } from "@vera/domain/names";
import { namesAfterEdit, otherLanguage } from "@vera/domain/names";
import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { i18n } from "@/i18n";

interface NamesFieldProps {
  id: string;
  label: string;
  placeholder?: string;
  names: Names;
  onChange: (names: Names) => void;
  autoFocus?: boolean;
  // A name that cannot change, such as the fallback custody's.
  disabled?: boolean;
  // Enter in either name, where a form moves on without a submit button.
  onEnter?: () => void;
}

export function NamesField({
  id,
  label,
  placeholder,
  names,
  onChange,
  autoFocus,
  disabled,
  onEnter,
}: NamesFieldProps) {
  const { t } = useTranslation("common");
  const language = i18n.language.startsWith("cs") ? "cs" : "en";
  const other = otherLanguage(language);
  const otherId = useId();
  const otherInput = useRef<HTMLInputElement>(null);
  const shouldFocusOther = useRef(false);
  const enter =
    onEnter === undefined
      ? undefined
      : (event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") onEnter();
        };
  const [showOther, setShowOther] = useState((names[other] ?? "").trim() !== "");

  useEffect(() => {
    if (showOther && shouldFocusOther.current) {
      otherInput.current?.focus();
      shouldFocusOther.current = false;
    }
  }, [showOther]);

  return (
    <div className="grid gap-2">
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          placeholder={placeholder}
          value={names[language] ?? ""}
          autoFocus={autoFocus}
          disabled={disabled}
          onKeyDown={enter}
          onChange={(event) => onChange(namesAfterEdit(names, language, event.target.value))}
        />
      </div>
      {showOther ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-${otherId}`}>
            {t(other === "en" ? "names.english" : "names.czech")}
          </Label>
          <Input
            ref={otherInput}
            id={`${id}-${otherId}`}
            placeholder={placeholder}
            value={names[other] ?? ""}
            disabled={disabled}
            onKeyDown={enter}
            onChange={(event) => onChange(namesAfterEdit(names, other, event.target.value))}
          />
        </div>
      ) : disabled ? null : (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="w-fit justify-start px-0"
          onClick={() => {
            shouldFocusOther.current = true;
            setShowOther(true);
          }}
        >
          {t(other === "en" ? "names.addEnglish" : "names.addCzech")}
        </Button>
      )}
    </div>
  );
}

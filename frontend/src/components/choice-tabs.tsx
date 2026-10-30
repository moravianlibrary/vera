// A wrapped set of choices within a dialog or card, rather than a page's tab strip.

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface ChoicePanel<Value extends string> {
  value: Value;
  label: string;
  content: ReactNode;
}

export function ChoiceTabs<Value extends string>({
  value,
  onChange,
  panels,
  label,
}: {
  value: Value;
  onChange: (value: Value) => void;
  panels: readonly ChoicePanel<Value>[];
  label: string;
}) {
  return (
    <Tabs value={value} onValueChange={(picked) => onChange(picked as Value)}>
      <TabsList aria-label={label} className="h-auto flex-wrap">
        {panels.map((panel) => (
          <TabsTrigger key={panel.value} value={panel.value}>
            {panel.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {panels.map((panel) => (
        <TabsContent key={panel.value} value={panel.value} className="pt-2">
          {panel.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

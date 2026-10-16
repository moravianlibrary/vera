// What the Classifier plugins answer for a proposal, played by the mock (plugins.md §4.13): the
// enabled instances in tier order, the first suggestion winning. Only once the checks have
// answered, since they run when the checks finish. A node with children is rejected as an
// answer (§3), so the decider never sees it.

import { leafCategoriesOf } from "@vera/domain/categories";
import type { Document, Request } from "@vera/domain/entities";
import type { ClassifierSuggestion } from "@vera/domain/requests";
import { database } from "@/mocks/database";
import { materialLeaves, moravianPlaces } from "@/mocks/fixtures/classifiers";
import type { StoredPluginInstance } from "@/mocks/fixtures/plugins";
import { enabledInstancesOf, implementationOf } from "@/mocks/plugin-instances";

interface Answer {
  categoryId: string;
  reason: string;
}

const rules: Readonly<Record<string, (document: Document) => Answer | null>> = {
  PlaceOfPublication: (document) => {
    const title = document.title.toLocaleLowerCase("cs");
    return document.type === "Periodical" && moravianPlaces.some((place) => title.includes(place))
      ? { categoryId: "c21", reason: "Periodical, Moravian place of publication" }
      : null;
  },
  MaterialType: (document) => materialLeaves[document.type] ?? null,
};

function answerOf(instance: StoredPluginInstance, document: Document): Answer | null {
  const answer = rules[implementationOf(instance)?.name ?? ""]?.(document) ?? null;
  const leafIds = leafCategoriesOf(database.categories).map((category) => category.id);
  return answer !== null && leafIds.includes(answer.categoryId) ? answer : null;
}

export function suggestionFor(ask: Request, document: Document): ClassifierSuggestion | null {
  if (ask.checkedAt === null) {
    return null;
  }

  for (const instance of enabledInstancesOf("Classifier")) {
    const answer = answerOf(instance, document);
    if (answer !== null) {
      return { ...answer, classifier: { id: instance.id, name: instance.name } };
    }
  }

  return null;
}

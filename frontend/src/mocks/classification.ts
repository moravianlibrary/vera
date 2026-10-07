// What the Classifier plugins answer for a proposal, played by the mock (plugins.md §4.13): the
// enabled instances in tier order, the first suggestion winning. Only once the checks have
// answered, since they run when the checks finish. A node with children is rejected as an
// answer (§3), so the decider never sees it.

import { leafCategoriesOf } from "@/domain/categories";
import type { Document, Request } from "@/domain/entities";
import type { ClassifierSuggestion } from "@/domain/proposal-review";
import { database } from "@/mocks/database";
import type { ClassifierInstance } from "@/mocks/fixtures/classifiers";
import { classifiers, materialLeaves, moravianPlaces } from "@/mocks/fixtures/classifiers";

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

function answerOf(instance: ClassifierInstance, document: Document): Answer | null {
  const answer = rules[instance.plugin]?.(document) ?? null;
  const leafIds = leafCategoriesOf(database.categories).map((category) => category.id);
  return answer !== null && leafIds.includes(answer.categoryId) ? answer : null;
}

export function suggestionFor(ask: Request, document: Document): ClassifierSuggestion | null {
  if (ask.checkedAt === null) {
    return null;
  }

  for (const instance of classifiers.filter((candidate) => candidate.isEnabled)) {
    const answer = answerOf(instance, document);
    if (answer !== null) {
      return { ...answer, classifier: { id: instance.id, name: instance.name } };
    }
  }

  return null;
}

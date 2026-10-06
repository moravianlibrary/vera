// A count with its noun, "1 asker", "3 askers".
// TODO(rrandiak): plurals come from i18n, which knows languages with more than two forms.

export function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : pluralNoun}`;
}

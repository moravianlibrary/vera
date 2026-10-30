// A count with its noun, "1 asker", "3 askers".
/** @deprecated I18N-8 moves the remaining callers to plural messages. */

export function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : pluralNoun}`;
}

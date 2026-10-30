import { pick, type Random } from "./random";

const first = [
  "Anna",
  "Jan",
  "Eva",
  "Pavel",
  "Tereza",
  "Marek",
  "Klára",
  "David",
  "Lucie",
  "Adam",
  "Barbora",
  "Tomáš",
];
const last = [
  "Nováková",
  "Svoboda",
  "Dvořáková",
  "Černý",
  "Procházková",
  "Kučera",
  "Veselá",
  "Horák",
  "Pokorná",
  "Marek",
];
const titleWords = [
  "Moravský",
  "Tichý",
  "Zahradní",
  "Český",
  "Podzimní",
  "Městský",
  "Hluboký",
  "Nový",
  "Starý",
  "Modrý",
  "Příběh",
  "Atlas",
  "Kronika",
  "Přehled",
  "Zápisník",
  "Obzor",
];

export function personName(random: Random): string {
  return `${pick(random, first)} ${pick(random, last)}`;
}
export function bookTitle(random: Random): string {
  return `${pick(random, titleWords)} ${pick(random, titleWords)}`;
}
export function emailName(index: number): string {
  return `person${index}@example.org`;
}

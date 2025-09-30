import { faker } from "@faker-js/faker";

export const fakeId = (
    range: { min: number; max: number } = { min: 1, max: 10000 }
) => faker.number.int({ min: range.min, max: range.max });
export const fakeCatalogRecordId = () => `MZK01-${faker.string.numeric(9)}`;

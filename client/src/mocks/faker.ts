import { faker } from "@faker-js/faker";

export const fakeId = () => faker.number.int({ min: 1, max: 10000 });
export const fakeCatalogRecordId = () => `MZK01-${faker.string.numeric(9)}`;

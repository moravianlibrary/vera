export class Quota {
    id;
    name;
    description;
    pages_count;
    active;

    static fromJson(json) {
        const qouta= new Quota();

        qouta.id = json.id;
        qouta.name = json.name;
        qouta.description = json.description;
        qouta.pages_count = json.pages_count;
        qouta.active = json.active;

        return qouta;
    }
}

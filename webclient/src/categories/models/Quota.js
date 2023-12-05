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

    static emptyQuota(name) {
        const qouta= new Quota();
        qouta.name = name;
        qouta.pages_count = 0;
        qouta.active = true;
        return qouta;
    }

    static createQuota(id, name, description, pages_count) {
        const qouta= new Quota();
        qouta.id = id;
        qouta.name = name;
        qouta.description = description;
        qouta.pages_count = pages_count;
        qouta.active = false;
        return qouta;
    }
}

import { createServer, Model, Server } from "miragejs";
import { projectFactory, projectRoutes, projectSeeds } from "./project";
import { documentFactory, documentRoutes, documentSeeds } from "./document";

const models = {
    project: Model,
    document: Model.extend<Partial<Document>>({}),
};

export function makeServer() {
    return createServer({
        models: models,
        factories: {
            document: documentFactory,
            project: projectFactory,
        },
        seeds: (server: Server) => {
            documentSeeds(server);
            projectSeeds(server);
        },
        routes() {
            this.namespace = "api";
            documentRoutes.call(this);
            projectRoutes.call(this);
        },
    });
}

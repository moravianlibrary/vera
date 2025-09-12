import { createServer } from "miragejs";
import {
    projectFactories,
    projectModels,
    projectRoutes,
    projectSeeds,
} from "./project";

export function makeServer() {
    return createServer({
        models: projectModels,
        factories: projectFactories,
        seeds: projectSeeds,
        routes() {
            this.namespace = "api";
            projectRoutes.call(this);
        },
    });
}

import { Factory, Response, Server } from "miragejs";
import type { Project, ProjectEdit, ProjectStatus } from "../models/project";
import type { EsQuery, EsRequest } from "../models/es";
import type { ProposalCreate } from "../models/proposal";
import type { AdditionCreate } from "../models/addition";

// Factory producing exact Project objects
export const projectFactory = Factory.extend<Project>({
    id(i) {
        return i + 1;
    },
    name(i) {
        return `Project ${i + 1}`;
    },
    description() {
        return "This is a mocked project description";
    },
    target_page_count() {
        return 100;
    },
    start_date() {
        return new Date();
    },
    end_date() {
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    },
    created_by() {
        return "user1";
    },
    created_at() {
        return new Date();
    },
    priority() {
        return 3;
    },
    status() {
        return ["Proposed", "Approved", "Rejected"][
            Math.floor(Math.random() * 3)
        ] as ProjectStatus;
    },
    is_archived() {
        return false;
    },
    groups() {
        return [];
    },
    users() {
        return [];
    },
    status_log() {
        return [];
    },
    watchlists() {
        return [];
    },
});

// Seeds with exact Project objects
export function projectSeeds(server: Server) {
    server.create("project", {
        id: 1,
        name: "Project Alpha",
        description: "Alpha description",
        created_by: "user1",
        created_at: new Date().toISOString(),
        priority: 3,
        status: "Approved",
        is_archived: false,
        groups: [],
        users: [],
        status_log: [],
        watchlists: [],
        target_page_count: 120,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    server.create("project", {
        id: 2,
        name: "Project Beta",
        description: "Beta description",
        created_by: "user2",
        created_at: new Date().toISOString(),
        priority: 2,
        status: "Proposed",
        is_archived: false,
        groups: [],
        users: [],
        status_log: [],
        watchlists: [],
        target_page_count: 50,
        start_date: new Date().toISOString(),
    });

    server.create("project", {
        id: 3,
        name: "Project Gamma",
        description: "Gamma description",
        created_by: "user1",
        created_at: new Date().toISOString(),
        priority: 4,
        status: "Rejected",
        is_archived: false,
        groups: [],
        users: [],
        status_log: [],
        watchlists: [],
        target_page_count: 50,
        end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
}

export function projectRoutes(this: any) {
    this.post("/projects/search", (schema: any, request: any) => {
        const esRequest = JSON.parse(request.requestBody) as EsRequest;
        const { query } = esRequest;

        const hits = schema
            .all("project")
            .models.filter((p: any) => query.match_all)
            .map((p: any) => {
                const { id, ...rest } = p.attrs;
                return {
                    _index: "projects",
                    _id: String(p.id),
                    _source: rest,
                };
            });

        return {
            took: 1,
            timed_out: false,
            _shards: { total: 1, successful: 1, failed: 0 },
            hits: { total: { value: hits.length }, hits },
        };
    });

    this.post("/projects", (schema: any, request: any) => {
        let attrs: ProjectEdit = JSON.parse(request.requestBody);
        return schema.create("project", attrs);
    });

    this.put("/projects/:id", (schema: any, request: any) => {
        let id = request.params.id;
        let attrs: ProjectEdit = JSON.parse(request.requestBody);
        let project = schema.find("project", id);
        if (!project)
            return new Response(404, {}, { error: "Project not found" });
        return project.update(attrs);
    });

    this.delete("/projects/:id", (schema: any, request: any) => {
        let id = request.params.id;
        let project = schema.find("project", id);
        if (!project)
            return new Response(404, {}, { error: "Project not found" });
        project.destroy();
        return {};
    });

    this.patch("/projects/:id/assignment", (schema: any, request: any) => {
        let id = request.params.id;
        let assignment = JSON.parse(request.requestBody);
        let project = schema.find("project", id);
        if (!project)
            return new Response(404, {}, { error: "Project not found" });
        return project.update({ assignment });
    });

    this.post(
        "/projects/:id/propose-documents",
        (schema: any, request: any) => {
            let id = request.params.id;
            let proposals: ProposalCreate[] = JSON.parse(request.requestBody);
            let project = schema.find("project", id);
            if (!project)
                return new Response(404, {}, { error: "Project not found" });
            return { success: true, proposals };
        }
    );

    this.post("/projects/:id/add-documents", (schema: any, request: any) => {
        let id = request.params.id;
        let additions: AdditionCreate[] = JSON.parse(request.requestBody);
        let params: { batch_id?: number; allow_new_iteration?: boolean } =
            request.queryParams;
        let project = schema.find("project", id);
        if (!project)
            return new Response(404, {}, { error: "Project not found" });
        return { success: true, additions, params };
    });

    this.patch("/projects/:id/priority", (schema: any, request: any) => {
        let id = request.params.id;
        let { priority } = JSON.parse(request.requestBody);
        let project = schema.find("project", id);
        if (!project)
            return new Response(404, {}, { error: "Project not found" });
        return project.update({ priority });
    });

    this.patch("/projects/:id/approve", (schema: any, request: any) => {
        let id = request.params.id;
        let { message } = JSON.parse(request.requestBody) || {};
        let project = schema.find("project", id);
        if (!project)
            return new Response(404, {}, { error: "Project not found" });
        return project.update({ status: "Approved", message });
    });

    this.patch("/projects/:id/reject", (schema: any, request: any) => {
        let id = request.params.id;
        let { message } = JSON.parse(request.requestBody) || {};
        let project = schema.find("project", id);
        if (!project)
            return new Response(404, {}, { error: "Project not found" });
        return project.update({ status: "Rejected", message });
    });

    this.post("/projects/watchlist", (schema: any, request: any) => {
        let body: EsQuery = JSON.parse(request.requestBody);
        let { name, description } = request.queryParams;
        return {
            id: Math.floor(Math.random() * 1000),
            name,
            description,
            query: body,
        };
    });
}

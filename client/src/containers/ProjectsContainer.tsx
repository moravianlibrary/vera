import { Fragment, useState, type ReactElement } from "react";
import type { EsQuery, EsRequest } from "../models/es";
import { useSearchProjects } from "../hooks/useProjects";
import {
    Card,
    CardBody,
    CardFooter,
    CardHeader,
    CardTitle,
    Content,
    Gallery,
    PageSection,
    Pagination,
} from "@patternfly/react-core";
import type { Project } from "../models/project";
import PriorityLabel from "../components/PriorityLabel";
import ProjectStatusLabel from "../components/ProjectStatusLabel";

interface ProjectGalleryProps {
    projects: Project[];
    showCreator?: boolean;
}

const ProjectCard = ({ project }: { project: Project }) => {
    return (
        <Card key={project.id}>
            <CardHeader
            // selectableActions={{
            //     isChecked: selectedItems.includes(product.id),
            //     selectableActionId: `selectable-actions-item-${product.id}`,
            //     selectableActionAriaLabelledby: product.name.replace(
            //         / /g,
            //         "-"
            //     ),
            //     name: `check-${product.id}`,
            //     onChange,
            // }}
            ></CardHeader>
            <CardTitle>
                <span>{project.name}</span>
                <ProjectStatusLabel status={project.status!} />
            </CardTitle>
            <CardBody>
                <Content>
                    <p>Target Pages: {project.target_page_count}</p>
                    <p>
                        Dates: {project.start_date.toLocaleDateString()} –{" "}
                        {new Date(project.end_date).toLocaleDateString()}
                    </p>
                    <PriorityLabel
                        priority={project.priority || 0}
                        withKeyword
                    />
                </Content>
            </CardBody>
            <CardFooter>
                <p>Created by: {project.created_by}</p>
            </CardFooter>
        </Card>
    );
};

const ProjectsContainer = (): ReactElement => {
    const [query, setQuery] = useState<EsQuery>({ match_all: {} });
    const request: EsRequest = { query };

    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const totalItemCount = 200;

    const { data, isLoading, isError, error, refetch } =
        useSearchProjects(request);

    if (isLoading) return <div>Loading projects...</div>;
    if (isError) return <div>Error: {error?.message}</div>;

    const onSetPage = (_event: any, pageNumber: number) => {
        setPage(pageNumber);
    };

    const onPerPageSelect = (_event: any, perPage: number) => {
        setPerPage(perPage);
        setPage(1);
    };

    return (
        <Fragment>
            <PageSection>
                <Gallery hasGutter>
                    {(
                        data?.hits.hits.map((h) => ({
                            id: Number(h._id),
                            ...h._source,
                        })) || []
                    ).map((p) => (
                        <ProjectCard key={p.id} project={p as Project} />
                    ))}
                </Gallery>
            </PageSection>
            <PageSection
                stickyOnBreakpoint={{ default: "bottom" }}
                // padding={{ default: "noPadding" }}
                aria-label="Pagination controls"
            >
                <Pagination
                    itemCount={totalItemCount}
                    page={page}
                    perPage={perPage}
                    onPerPageSelect={onPerPageSelect}
                    onSetPage={onSetPage}
                    variant="bottom"
                />
            </PageSection>
        </Fragment>
    );
};

export default ProjectsContainer;

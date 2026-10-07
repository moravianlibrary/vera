// The application: providers and routes. Every navigation entry is a route, gated by the same
// permissions that reveal it in the sidebar.
// TODO(rrandiak): the remaining views (frontend/continuation.md); labels move to i18n.

import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { AppShell } from "@/components/layout/app-shell";
import { navigationEntries, visibleNavigation } from "@/components/layout/navigation";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CategoriesPage } from "@/features/categories/categories-page";
import { DocumentsPage } from "@/features/documents/documents-page";
import { IntentionsPage } from "@/features/intentions/intentions-page";
import { IntentionMixPage } from "@/features/intentions/mix-page";
import { ListEditorPage } from "@/features/lists/list-editor-page";
import { ListsPage } from "@/features/lists/lists-page";
import { ProjectPage } from "@/features/projects/project-page";
import { ProjectsPage } from "@/features/projects/projects-page";
import { ProposalsPage } from "@/features/proposals/proposals-page";
import { TasksPage } from "@/features/tasks/tasks-page";
import { ValidationsPage } from "@/features/validations/validations-page";
import { useSessionQuery } from "@/hooks/use-session-query";
import { queryClient } from "@/lib/query-client";

function Placeholder({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <PageContent>
        <p className="text-sm text-muted-foreground">This view is planned for a later milestone.</p>
      </PageContent>
    </>
  );
}

function EntryPage({ entryId, label }: { entryId: string; label: string }) {
  switch (entryId) {
    case "documents":
      return <DocumentsPage />;
    case "proposals":
      return <ProposalsPage />;
    case "validations":
      return <ValidationsPage />;
    case "lists":
      return <ListsPage />;
    case "projects":
      return <ProjectsPage />;
    case "categories":
      return <CategoriesPage />;
    case "intentions":
      return <IntentionsPage />;
    case "tasks":
      return <TasksPage />;
    default:
      return <Placeholder title={label} />;
  }
}

function NoAccess() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-lg font-semibold">No access yet</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        An administrator has not given this account a role.
      </p>
    </div>
  );
}

// Sends `/` and unknown paths to the first entry the session holds.
function Landing() {
  const { data: session } = useSessionQuery();
  if (session === undefined) {
    return null;
  }

  const [first] = visibleNavigation(session);
  return first === undefined ? <NoAccess /> : <Navigate to={first.path} replace />;
}

function Gate({ entryId, children }: { entryId: string; children: React.ReactNode }) {
  const { data: session } = useSessionQuery();
  if (session === undefined) {
    return null;
  }

  const isVisible = visibleNavigation(session).some((entry) => entry.id === entryId);
  return isVisible ? children : <Navigate to="/" replace />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Landing /> },
      ...navigationEntries.map((entry) => ({
        path: entry.path.slice(1),
        element: (
          <Gate entryId={entry.id}>
            <EntryPage entryId={entry.id} label={entry.label} />
          </Gate>
        ),
      })),
      // Digitization Lists' editor: one page, three surfaces (view-map.md §2.4).
      ...["lists/new", "lists/:listId/edit"].map((path) => ({
        path,
        element: (
          <Gate entryId="lists">
            <ListEditorPage />
          </Gate>
        ),
      })),
      // A project's own page: few run at once, so it is not a pane (STATUS "Projects").
      {
        path: "projects/:projectId",
        element: (
          <Gate entryId="projects">
            <ProjectPage />
          </Gate>
        ),
      },
      // An intention's Mix: where its shares are read and edited (intentions.md §2.4).
      {
        path: "intentions/:intentionId/mix",
        element: (
          <Gate entryId="intentions">
            <IntentionMixPage />
          </Gate>
        ),
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

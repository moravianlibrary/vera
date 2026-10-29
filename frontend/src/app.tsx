// The application: providers and routes. Every navigation entry is a route, gated by the same
// permissions that reveal it in the sidebar.
// TODO(rrandiak): the remaining views (frontend/continuation.md); labels move to i18n.

import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { AppShell } from "@/components/layout/app-shell";
import {
  canOpenNavigationEntry,
  navigationEntries,
  visibleNavigation,
} from "@/components/layout/navigation";
import { PageContent, PageHeader } from "@/components/layout/page-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccessPage } from "@/features/access/access-page";
import { CategoriesPage } from "@/features/categories/categories-page";
import { AskRoute } from "@/features/documents/ask-route";
import { DocumentsPage } from "@/features/documents/documents-page";
import { HooksPage } from "@/features/hooks/hooks-page";
import { IntentionsPage } from "@/features/intentions/intentions-page";
import { IntentionMixPage } from "@/features/intentions/mix-page";
import { MixesPage } from "@/features/intentions/mixes-page";
import { ListEditorPage } from "@/features/lists/list-editor-page";
import { ListsPage } from "@/features/lists/lists-page";
import { PluginsPage } from "@/features/plugins/plugins-page";
import { EmailNotificationsPage } from "@/features/preferences/email-notifications-page";
import { PreferencesPage } from "@/features/preferences/preferences-page";
import { WatchlistsPage } from "@/features/preferences/watchlists-page";
import { ProjectPage } from "@/features/projects/project-page";
import { ProjectsPage } from "@/features/projects/projects-page";
import { PropertiesPage } from "@/features/properties/properties-page";
import { RequestsPage } from "@/features/requests/requests-page";
import { CrashPage } from "@/features/system/crash-page";
import { ForbiddenPage } from "@/features/system/forbidden-page";
import { ForgotPasswordPage } from "@/features/system/forgot-password-page";
import { LoginPage } from "@/features/system/login-page";
import { NoAccessPage } from "@/features/system/no-access-page";
import { NotFoundPage } from "@/features/system/not-found-page";
import { ResetPasswordPage } from "@/features/system/reset-password-page";
import { SignUpPage } from "@/features/system/sign-up-page";
import { SignedOutPage } from "@/features/system/signed-out-page";
import { VerifyEmailPage } from "@/features/system/verify-email-page";
import { SchedulesPage } from "@/features/tasks/schedules-page";
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
      return <DocumentsPage perspective="staff" />;
    case "my-documents":
      return <DocumentsPage perspective="my" />;
    case "requests":
      return <RequestsPage />;
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
    case "mixes":
      return <MixesPage />;
    case "tasks":
      return <TasksPage />;
    case "schedules":
      return <SchedulesPage />;
    case "access":
      return <AccessPage />;
    case "plugins":
      return <PluginsPage />;
    case "properties":
      return <PropertiesPage />;
    case "hooks":
      return <HooksPage />;
    case "watchlists":
      return <WatchlistsPage />;
    default:
      return <Placeholder title={label} />;
  }
}

// Sends `/` and unknown paths to the first entry the session holds.
function Landing() {
  const { data: session } = useSessionQuery();
  if (session === undefined) {
    return null;
  }

  const [first] = visibleNavigation(session);
  return first === undefined ? <NoAccessPage /> : <Navigate to={first.path} replace />;
}

function Gate({ entryId, children }: { entryId: string; children: React.ReactNode }) {
  const { data: session } = useSessionQuery();
  if (session === undefined) {
    return null;
  }

  return canOpenNavigationEntry(session, entryId) ? (
    children
  ) : (
    <ForbiddenPage
      page={navigationEntries.find((entry) => entry.id === entryId)?.label ?? entryId}
    />
  );
}

const router = createBrowserRouter([
  {
    path: "/login",
    handle: { template: "/login" },
    element: <LoginPage />,
    errorElement: <CrashPage />,
  },
  {
    path: "/signup",
    handle: { template: "/signup" },
    element: <SignUpPage />,
    errorElement: <CrashPage />,
  },
  {
    path: "/verify-email/:token",
    handle: { template: "/verify-email/:token" },
    element: <VerifyEmailPage />,
    errorElement: <CrashPage />,
  },
  {
    path: "/forgot-password",
    handle: { template: "/forgot-password" },
    element: <ForgotPasswordPage />,
    errorElement: <CrashPage />,
  },
  {
    path: "/reset-password/:token",
    handle: { template: "/reset-password/:token" },
    element: <ResetPasswordPage />,
    errorElement: <CrashPage />,
  },
  { path: "/signed-out", handle: { template: "/signed-out" }, element: <SignedOutPage /> },
  {
    path: "/email-notifications/:token",
    handle: { template: "/email-notifications/:token" },
    element: <EmailNotificationsPage />,
  },
  {
    path: "/",
    handle: { template: "/" },
    element: <AppShell />,
    errorElement: <CrashPage />,
    children: [
      { index: true, element: <Landing /> },
      {
        path: "preferences",
        handle: { template: "/preferences" },
        element: <Navigate to="/preferences/watchlists" replace />,
      },
      {
        path: "preferences/:section",
        handle: { template: "/preferences/:section" },
        element: <PreferencesPage />,
      },
      { path: "ask", handle: { template: "/ask" }, element: <AskRoute /> },
      ...navigationEntries.map((entry) => ({
        path: entry.path.slice(1),
        handle: { template: entry.path },
        element: (
          <Gate entryId={entry.id}>
            <EntryPage entryId={entry.id} label={entry.label} />
          </Gate>
        ),
      })),
      // Digitization Lists' editor: one page, three surfaces (view-map.md §2.4).
      ...["lists/new", "lists/:listId/edit"].map((path) => ({
        path,
        handle: { template: path === "lists/new" ? "/lists/new" : "/lists/:listId/edit" },
        element: (
          <Gate entryId="lists">
            <ListEditorPage />
          </Gate>
        ),
      })),
      // A project's own page: few run at once, so it is not a pane (STATUS "Projects").
      {
        path: "projects/:projectId",
        handle: { template: "/projects/:projectId" },
        element: (
          <Gate entryId="projects">
            <ProjectPage />
          </Gate>
        ),
      },
      // An intention's Mix: the mix it chose, read against its output (PLAN-mix-reading).
      {
        path: "intentions/:intentionId/mix",
        handle: { template: "/intentions/:intentionId/mix" },
        element: (
          <Gate entryId="intentions">
            <IntentionMixPage />
          </Gate>
        ),
      },
      {
        path: "mixes/:mixId",
        handle: { template: "/mixes/:mixId" },
        element: (
          <Gate entryId="mixes">
            <MixesPage />
          </Gate>
        ),
      },
      { path: "*", handle: { template: "/*" }, element: <NotFoundPage /> },
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

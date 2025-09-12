import { createRoot } from "react-dom/client";
import type { ReactNode, FC, ComponentType } from "react";
import { StrictMode } from "react";
import { makeServer } from "./mocks/server.ts";
import { App } from "./App.tsx";
import AccessProvider from "./contexts/AccessContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./services/queryClient.ts";
import "./services/locales";

if (import.meta.env.DEV) {
    makeServer();
}

// TODO: Move to separate file
interface WithProvidersProps {
    providers: ComponentType<{ children: ReactNode }>[];
    children: ReactNode;
}

const WithProviders: FC<WithProvidersProps> = ({ providers, children }) => {
    return providers.reduceRight(
        (acc, Provider) => <Provider>{acc}</Provider>,
        children
    );
};

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <WithProviders
            providers={[
                AccessProvider,
                ({ children }) => (
                    <QueryClientProvider client={queryClient}>
                        {children}
                    </QueryClientProvider>
                ),
            ]}
        >
            <App />
        </WithProviders>
    </StrictMode>
);

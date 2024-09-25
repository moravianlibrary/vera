import React, { ReactNode, FC } from "react";

interface ProviderProps {
    children: ReactNode;
}

type Provider = FC<ProviderProps>;

interface WithProvidersProps {
    providers: Provider[];
    children: ReactNode;
}

const WithProviders: FC<WithProvidersProps> = ({ providers, children }) => {
    return (
        <>
            {providers.reduce((acc, Provider) => {
                return <Provider>{acc}</Provider>;
            }, children)}
        </>
    );
};

export default WithProviders;

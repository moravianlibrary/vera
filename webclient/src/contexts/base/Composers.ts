import React from "react";

const composeHOCs =
    (...hocs: Function[]) =>
    <P extends object>(Component: React.ComponentType<P>) => {
        return hocs.reduce((WrappedComponent, hoc) => {
            return hoc(WrappedComponent);
        }, Component);
    };
// const composeHOCs =
//     (...hocs: Function[]) =>
//     <P extends object>(Component: React.ComponentType<P>) => {
//         return hocs.reduceRight(
//             (WrappedComponent, hoc) => hoc(WrappedComponent),
//             Component
//         );
//     };

export { composeHOCs };

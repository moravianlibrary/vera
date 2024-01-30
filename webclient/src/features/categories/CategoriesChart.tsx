import React from "react";
import { OrganizationChart } from "primereact/organizationchart";
import { NodeType } from "../../contexts/categories/CategoryNodeType";
import { useCategoryNodes } from "../../contexts/categories/CategoryNodesContext";
import CategoriesChartRoot from "./CategoriesChartRoot";
import CategoriesChartNode from "./CategoriesChartNode";
import CategoriesChartUpdate from "./CategoriesChartUpdate";
import { CategoryNode } from "../../contexts/categories/CategoryNodeModel";
import { Button } from "primereact/button";

interface CategoriesChartProps {
};

const CategoriesChart: React.FC<CategoriesChartProps> = (props) => {
    const { categoryNodes, handleFocusParentNode } = useCategoryNodes();

    const getCategoryNodeComponent = (node: CategoryNode) => {
        if (!node) {
            return;
        } else if (node.type === NodeType.Root) {
            return (<CategoriesChartRoot node={node} />)
        } else if (node.type === NodeType.Category) {
            return (<CategoriesChartNode node={node} />)
        } else if (node.type === NodeType.CreateCategory) {
            return (<CategoriesChartUpdate node={node} />)
        } else if (node.type === NodeType.UpdateCategory) {
            return (<CategoriesChartUpdate node={node} />)
        }
    };

    if (!categoryNodes) {
        return (<div></div>);
    }

    return (
        <div className="flex flex-column align-items-center gap-3 m-2">
            <Button
                className="absolute"
                visible={!(!categoryNodes[0].parentNode)}
                size="large"
                rounded
                icon="pi pi-caret-up"
                onClick={() => handleFocusParentNode()}
            />
            <OrganizationChart
                className="w-full mt-7"
                value={categoryNodes}
                nodeTemplate={getCategoryNodeComponent}
            />
        </div>
    );
};



export default CategoriesChart;

import React, { useEffect, useRef, useState } from "react";
import { OrganizationChart } from "primereact/organizationchart";
import { NodeType } from "../../contexts/categories/CategoryNodeType";
import { useCategoryNodes } from "../../contexts/categories/CategoryNodesContext";
import CategoriesChartRoot, {
    CategoriesChartLevelRoot,
} from "./CategoriesChartRoot";
import CategoriesChartNode from "./CategoriesChartNode";
import CategoriesChartUpdate from "./CategoriesChartUpdate";
import { CategoryNode } from "../../contexts/categories/CategoryNodeModel";
import { Button } from "primereact/button";

interface CategoriesChartProps {}

const SCROLL_BY_PROPORTION = 0.8;

const CategoriesChart: React.FC<CategoriesChartProps> = (props) => {
    const { categoryNodes, handleFocusParentNode } = useCategoryNodes();
    const containerRef = useRef<HTMLDivElement>(null);

    const getCategoryNodeComponent = (node: CategoryNode) => {
        if (!node) {
            return;
        } else if (node.type === NodeType.Root) {
            return <CategoriesChartRoot node={node} />;
        } else if (node.type === NodeType.LevelRoot) {
            return <CategoriesChartLevelRoot node={node} />;
        } else if (node.type === NodeType.Category) {
            return <CategoriesChartNode node={node} />;
        } else if (node.type === NodeType.CreateCategory) {
            return <CategoriesChartUpdate node={node} />;
        } else if (node.type === NodeType.UpdateCategory) {
            return <CategoriesChartUpdate node={node} />;
        }
    };

    const handleScrollLeft = (e) => {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) {
            return;
        }
        container.scrollBy({
            left: -(
                container.getBoundingClientRect().width * SCROLL_BY_PROPORTION
            ),
            top: 0,
            behavior: "smooth",
        });
    };

    const handleScrollRight = () => {
        const container = containerRef.current;
        if (!container) {
            return;
        }
        container.scrollBy({
            left:
                container.getBoundingClientRect().width * SCROLL_BY_PROPORTION,
            top: 0,
            behavior: "smooth",
        });
    };

    if (!categoryNodes) {
        return <div></div>;
    }

    return (
        <div ref={containerRef} className="my-2">
            <Button
                className="relative mb-2"
                style={{ left: "50%", transform: "translateX(-50%)" }}
                visible={!!categoryNodes[0].parentNode}
                size="large"
                rounded
                icon="pi pi-caret-up"
                onClick={() => handleFocusParentNode()}
            />
            <div className="card overflow-scroll overflow-y-auto">
                <OrganizationChart
                    value={categoryNodes}
                    nodeTemplate={getCategoryNodeComponent}
                />
            </div>
        </div>
    );
};

export default CategoriesChart;

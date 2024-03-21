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

interface ScrollBy {
    left: number;
    top: number;
}

const SCROLL_BY_PROPORTION = 0.8;

const CategoriesChart: React.FC<CategoriesChartProps> = (props) => {
    const { categoryNodes, handleFocusParentNode } = useCategoryNodes();
    const containerRef = useRef<HTMLDivElement>(null);

    // const [scrollBy, setScrollBy] = useState<ScrollBy>({
    //     left: 0,
    //     top: 0,
    // });

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

    // useEffect(() => {
    //     const container = containerRef.current;

    //     if (!container) {
    //         return;
    //     }

    //     container.scrollBy({
    //         left: scrollBy.left,
    //         top: scrollBy.top,
    //         behavior: "smooth",
    //     });
    //     const intervalId = setInterval(() => {
    //         console.log(`scrollBy: ${scrollBy.left}, ${scrollBy.top}`);
    //         container.scrollBy({
    //             left: scrollBy.left,
    //             top: scrollBy.top,
    //             behavior: "smooth",
    //         });
    //     }, 200);

    //     return () => {
    //         clearInterval(intervalId);
    //     };
    // }, [scrollBy]);

    // useEffect(() => {
    //     const container = containerRef.current;

    //     if (!container) {
    //         return;
    //     }

    //     const handleMouseMove = (event) => {
    //         const { clientX, clientY } = event;
    //         const { left, top, width, height } =
    //             container.getBoundingClientRect();

    //         // Calculate the distance from the mouse position to the edges of the container
    //         const distanceFromLeft = clientX - left;
    //         const distanceFromRight = width - distanceFromLeft;
    //         const distanceFromTop = clientY - top;
    //         const distanceFromBottom = height - distanceFromTop;

    //         // Adjust scrollLeft and scrollTop based on mouse position
    //         if (distanceFromLeft < 50) {
    //             setScrollBy({ left: -width / 2, top: 0 });
    //         } else if (distanceFromRight < 50) {
    //             setScrollBy({ left: width / 2, top: 0 });
    //         } else {
    //             setScrollBy({ left: 0, top: 0 });
    //         }

    //         if (distanceFromTop < 50) {
    //         } else if (distanceFromBottom < 50) {
    //         }
    //     };

    //     container.addEventListener("mousemove", handleMouseMove);

    //     return () => {
    //         container.removeEventListener("mousemove", handleMouseMove);
    //     };
    // }, []);

    if (!categoryNodes) {
        return <div></div>;
    }

    return (
        <div
            ref={containerRef}
            className="flex flex-column align-items-center gap-3 m-2 h-full overflow-scroll"
        >
            <Button
                className="absolute"
                visible={!!categoryNodes[0].parentNode}
                size="large"
                rounded
                icon="pi pi-caret-up"
                onClick={() => handleFocusParentNode()}
            />
            <OrganizationChart
                className="mt-7 w-full"
                value={categoryNodes}
                nodeTemplate={getCategoryNodeComponent}
            />
            <Button
                className="absolute left-0 h-full pi pi-caret-left text-300 bg-surface-100 border-surface-300"
                style={{ boxShadow: "none" }}
                text
                onClick={handleScrollLeft}
            />
            <Button
                className="absolute right-0 h-full pi pi-caret-right text-300 bg-surface-100 color-surface-300 border-surface-300"
                style={{ boxShadow: "none" }}
                text
                onClick={handleScrollRight}
            />
        </div>
    );
};

export default CategoriesChart;

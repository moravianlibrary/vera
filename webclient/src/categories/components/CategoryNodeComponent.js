import NodeType from "../models/CategoryNodeType";
import CategoryViewNode from "./CategoryViewNode";
import InsertCategoryNode from "./InsertCategoryNode";
import UpdateCategoryNode from "./UpdateCategoryNode";

const CategoryNodeComponent = (props) => {
    if (!props.node) {
        return;
    } else if (props.node.type == NodeType.INSERT) {
        return (<InsertCategoryNode {...props} />)
    } else if (props.node.type == NodeType.ROOT) {
        return (<CategoryViewNode {...props} />)
    } else if (props.node.type == NodeType.CATEGORY) {
        return (<CategoryViewNode {...props} />)
    } else if (props.node.type == NodeType.UPDATE_CATEGORY) {
        return (<UpdateCategoryNode {...props} />)
    }
}

export default CategoryNodeComponent;

const InsertNode = (props) => {
    const handleClick = () => {
        if (props.onClick) {
            props.onClick(props.node);
        }
    };

    return (
        <div onClick={() => handleClick()} style={{ cursor: "pointer" }}>
            <i className="pi pi-plus-circle text-blue-400 m-0 p-0" />
        </div>
    );
}

export default InsertNode;

interface EditorProps<T> {
    value: T;
    editorCallback: (value: T) => void;
    cancelCallback: () => void;
}

export default EditorProps;

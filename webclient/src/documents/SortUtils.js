const naturalSort = (a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);

    if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
    }

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const charCodeA = a.charCodeAt(i);
        const charCodeB = b.charCodeAt(i);

        if (!isNaN(charCodeA) && !isNaN(charCodeB)) {
            if (charCodeA !== charCodeB) {
                return charCodeA - charCodeB;
            }
        } else {
            return charCodeA - charCodeB;
        }
    }

    return a.length - b.length;
};

export default naturalSort;

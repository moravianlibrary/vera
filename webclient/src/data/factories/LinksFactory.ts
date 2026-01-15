function createMzkAlephLink(sysno: string) {
    const sysnoSplit = sysno.split("-");
    return `https://aleph.mzk.cz:443/F?func=direct&doc_number=${sysnoSplit[1]}&local_base=${sysnoSplit[0]}&format=999`;
}

function createSkcLink(sysno: string) {
    return `https://aleph.nkp.cz/F/?func=direct&doc_number=${sysno}&local_base=SKC`;
}

function createCnbLink(sysno: string) {
    return `https://aleph.nkp.cz/F/?func=direct&doc_number=${sysno}&local_base=CNB`;
}

function createDigitizationRegistryLink(id: number) {
    return `https://registrdigitalizace.cz/results;q=id:${id}`;
}

export {
    createCnbLink,
    createMzkAlephLink,
    createSkcLink,
    createDigitizationRegistryLink,
};

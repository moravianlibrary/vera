function parseDescriptionTranslationKey(volume_year, volume, bundle) {
    let traslationKey = "";
    if (volume_year) {
        traslationKey = traslationKey + "volume-year";
    }
    if (volume) {
        traslationKey = traslationKey + "volume";
    }
    if (bundle) {
        traslationKey = traslationKey + "bundle";
    }
    return traslationKey;
}

function parseDescription(volume_year, volume, bundle) {
    return (
        (volume_year !== volume
            ? [volume_year, volume, bundle]
            : [volume, bundle]
        )
            .filter((a) => a)
            .join(", ") || ""
    );
}

export { parseDescriptionTranslationKey, parseDescription };

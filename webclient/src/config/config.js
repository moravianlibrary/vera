const APP_CONFIG_DEV = {
    base_url: "http://localhost:8000/",
};

const APP_CONFIG_PROD = {
    base_url: "api.digiboard.osdd.mzk.cz",
};

export const APP_CONFIG = process.env.NODE_ENV === 'development' ? APP_CONFIG_DEV : APP_CONFIG_PROD;
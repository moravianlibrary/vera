import Keycloak from 'keycloak-js';

const keycloakProperties = {
    // url: process.env.REACT_APP_KEYCLOAK_SERVER_URL,
    // realm: process.env.REACT_APP_KEYCLOAK_REALM,
    // clientId: process.env.REACT_APP_KEYCLOAK_CLIENT_ID,
    url: 'https://keycloak.osdd.mzk.cz',
    realm: 'mzk',
    clientId: 'vera',
};

const keycloak = new Keycloak(keycloakProperties);

export default keycloak;

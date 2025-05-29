import Keycloak from "keycloak-js";
import config from "../config/config";

const keycloakProperties = {
    url: config.keycloak.url,
    realm: config.keycloak.realm,
    clientId: config.keycloak.clientId,
};

export const keycloakInitOptions = {
    // onLoad: "check-sso",
    // silentCheckSsoRedirectUri:
    //     window.location.origin + "/silent-check-sso.html",
    pkceMethod: "S256",
};

const keycloak = new Keycloak(keycloakProperties);

export default keycloak;

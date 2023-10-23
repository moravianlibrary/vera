import { Role } from "../models/Role";
import { api } from "./Api";
// import { msgs } from '../views/App';

class Data {
    setError(error) {
        // msgs.current.show(
        //     {sticky: true, severity: 'error', summary: 'Error', detail: 'Message Content', closable: false}
        // );
    }

    async getRolesActions() {
        let roles = [];
        api.getRolesActions()
        .then(
            (result) => {
                roles = result.roles.map(role => Role.fromJson(role));
            },
            (error) => {
                this.setError(error);
            }
        )
        return roles;
    }

    async getRolesNames() {
        api.getRoles()
        .then(
            (result) => {
                return result.roles.map(role => role.name);
            },
            (error) => {
                this.setError(error);
            }
        )
    }
};

export const data = new Data();

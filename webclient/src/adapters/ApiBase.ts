import Axios, { AxiosInstance } from "axios";
import config from "../config/config";
import Page from "./Page";

const axiosInstance: AxiosInstance = Axios.create({
    baseURL: `${config.apiUrl}`,
    headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
    },
});

export function authHeader(contentType: string = "application/json") {
    const token = localStorage.getItem("token");
    if (token !== null) {
        return {
            Authorization: "Bearer " + token,
            "Content-Type": contentType,
        };
    } else {
        return {
            "Content-Type": contentType,
        };
    }
}

enum ApiOperation {
    GetPage = "Get page",
    Get = "Get",
    Create = "Create",
    Update = "Update",
    Delete = "Delete",
}

export interface ApiOptions {
    disableGetPage?: boolean;
    contentTypeGetPage?: string;
    disableGet?: boolean;
    contentTypeGet?: string;
    disableCreate?: boolean;
    contentTypeCreate?: string;
    disableUpdate?: boolean;
    contentTypeUpdate?: string;
    disableDelete?: boolean;
    contentTypeDelete?: string;
}

const defaultApiOptions: ApiOptions = {
    disableGetPage: false,
    contentTypeGetPage: "application/json",
    disableGet: false,
    contentTypeGet: "application/json",
    disableCreate: false,
    contentTypeCreate: "application/json",
    disableUpdate: false,
    contentTypeUpdate: "application/json",
    disableDelete: false,
    contentTypeDelete: "application/json",
};

export class ApiBase<T> {
    protected static axiosInstance: AxiosInstance = Axios.create({
        baseURL: `${config.apiUrl}`,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
    });

    protected endpoint: string;
    private options: ApiOptions;

    private operationToDisableMap: { [key in ApiOperation]: boolean };

    constructor(endpoint: string, options: ApiOptions = {}) {
        this.endpoint = endpoint;
        this.options = { ...defaultApiOptions, ...options };

        this.operationToDisableMap = {
            [ApiOperation.GetPage]: this.options.disableGetPage!,
            [ApiOperation.Get]: this.options.disableGet!,
            [ApiOperation.Create]: this.options.disableCreate!,
            [ApiOperation.Update]: this.options.disableUpdate!,
            [ApiOperation.Delete]: this.options.disableDelete!,
        };
    }

    private raiseOnDisabledOperation(operation: ApiOperation) {
        if (this.operationToDisableMap[operation]) {
            throw new Error(
                `${operation} operation is disabled for ${this.endpoint}`
            );
        }
    }

    protected authHeader(contentType: string = "application/json") {
        const token = localStorage.getItem("token");
        if (token !== null) {
            return {
                Authorization: "Bearer " + token,
                "Content-Type": contentType,
            };
        } else {
            return {
                "Content-Type": contentType,
            };
        }
    }

    getPage(page: number, pageSize: number) {
        this.raiseOnDisabledOperation(ApiOperation.GetPage);
        return axiosInstance.get<Page<T>>(
            `${this.endpoint}?page=${page}&page_size=${pageSize}`,
            {
                headers: this.authHeader(this.options.contentTypeGetPage!),
            }
        );
    }

    get(item_id: number) {
        this.raiseOnDisabledOperation(ApiOperation.Get);
        return axiosInstance.get<T>(`${this.endpoint}/${item_id}`, {
            headers: this.authHeader(this.options.contentTypeGet!),
        });
    }

    create(body: Partial<T>) {
        this.raiseOnDisabledOperation(ApiOperation.Create);
        return axiosInstance.post<T>(`${this.endpoint}`, body, {
            headers: this.authHeader(this.options.contentTypeCreate!),
        });
    }

    update(item_id: number, body: Partial<T>) {
        this.raiseOnDisabledOperation(ApiOperation.Update);
        return axiosInstance.put<T>(`${this.endpoint}/${item_id}`, body, {
            headers: this.authHeader(this.options.contentTypeUpdate!),
        });
    }

    delete(item_id: number | string) {
        this.raiseOnDisabledOperation(ApiOperation.Delete);
        return axiosInstance.delete(`${this.endpoint}/${item_id}`, {
            headers: this.authHeader(this.options.contentTypeDelete!),
        });
    }
}

export default axiosInstance;

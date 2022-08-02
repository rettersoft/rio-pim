import {Data, Response} from "@retter/rdk";
import {randomString} from "./helpers";
import {CategoryObject} from "./rio";


export interface CatalogSettingsPublicState{
    categories: CategoryObject[]
    updateToken: string
}

export type CatalogSettingsData<Input = any, Output = any> = Data<Input,Output, CatalogSettingsPublicState>

export async function authorizer(data: CatalogSettingsData): Promise<Response> {
    return {statusCode: 401};
}

export async function init(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    data.state.public = {
        categories: [],
        updateToken: randomString(),
    }
    return data
}

export async function getState(data: CatalogSettingsData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

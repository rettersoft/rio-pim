import {Data, Response} from "@retter/rdk";
import {AccountIDInput} from "./rio";
import {v4 as uuidv4} from 'uuid';

export interface ApiKeyItem {
    apiKey: string
    createdAt: string
}

export interface APIPrivateState {
    apiKeys: ApiKeyItem[]
}

export type APIData<Input = any, Output = any> = Data<Input, Output, any, APIPrivateState>

export async function authorizer(data: APIData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"

    if ([
        "generateApiKey",
        "deleteApiKey",
        "listApiKeys",
    ].includes(data.context.methodName)) {
        return {statusCode: 200}
    }

    if ([
        "getProducts",
        "getProductSettings",
        "getCatalogSettings",
        "upsertProduct",
        "deleteProduct",
        "getImage"
    ].includes(data.context.methodName)) {
        return {statusCode: 200}
    }

    switch (data.context.methodName) {
        case 'DESTROY':
            if (data.context.identity === "AccountManager") {
                return {statusCode: 200}
            }
            break
        case 'STATE':
            if (isDeveloper) return {statusCode: 200}
            break
        case 'GET':
            return {statusCode: 200}
        case 'INIT':
            if (data.context.identity === "AccountManager" || isDeveloper) {
                return {statusCode: 200}
            }
            break
    }
    return {statusCode: 401};
}

export async function getInstanceId(data: APIData<AccountIDInput>): Promise<string> {
    return data.request.body.accountId
}

export async function init(data: APIData): Promise<APIData> {
    data.state.private = {
        apiKeys: [{
            apiKey: generateKey(),
            createdAt: new Date().toISOString(),
        }]
    }
    return data
}

export async function getState(data: APIData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

export async function generateApiKey(data: APIData): Promise<APIData> {
    const apiKey = generateKey()
    const createdAt = new Date().toISOString()
    data.state.private.apiKeys.push({
        apiKey,
        createdAt
    })
    data.response = {
        statusCode: 200,
        body: {
            apiKey,
            createdAt
        }
    }
    return data
}

export async function deleteApiKey(data: APIData): Promise<APIData> {
    data.state.private.apiKeys = data.state.private.apiKeys.filter(d => d.apiKey !== data.request.body.apiKey)
    return data
}

export async function listApiKeys(data: APIData): Promise<APIData> {
    data.response = {
        statusCode: 200,
        body: {
            apiKeys: data.state.private.apiKeys
        }
    }
    return data
}

function generateKey() {
    return uuidv4().replace(new RegExp("-", "g"), "")
}

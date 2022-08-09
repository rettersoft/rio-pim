import {Data, Response} from "@retter/rdk";
import {AccountIDInput} from "./rio";
import {randomString} from "./helpers";

export interface ProductSettingsPublicState {
    updateToken: string
}

export type ProductSettingsData<Input = any, Output = any> = Data<Input, Output, ProductSettingsPublicState>

export async function authorizer(data: ProductSettingsData): Promise<Response> {
    const isDeveloper= data.context.identity === "developer"

    if ([].includes(data.context.methodName)) {
        return {statusCode: 200}
    }

    switch (data.context.methodName) {
        case 'STATE':
            if(isDeveloper) return {statusCode: 200}
            break
        case 'GET':
            return {statusCode: 200}
        case 'INIT':
            if (data.context.identity === "AccountManager") {
                return {statusCode: 200}
            }
            break
    }
    return {statusCode: 401};
}

export async function getInstanceId(data: ProductSettingsData<AccountIDInput>): Promise<string> {
    return data.request.body.accountId
}

export async function init(data: ProductSettingsData): Promise<ProductSettingsData> {
    data.state.public = {
        updateToken: randomString()
    }
    return data
}

export async function getState(data: ProductSettingsData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

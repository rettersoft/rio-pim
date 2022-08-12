import {Data, Response} from "@retter/rdk";
import {randomString} from "./helpers";
import {AccountIDInput} from "./rio";
import {Category, Channel} from "./models";
import {addCategory, removeCategory, updateCategory} from "./categories";

export interface CatalogSettingsPublicState {
    categories: Category[]
    enabledCurrencies: string[]
    enabledLocales: string[]
    channels: Channel[]
    updateToken: string
}

export type CatalogSettingsData<Input = any, Output = any> = Data<Input, Output, CatalogSettingsPublicState>

export async function authorizer(data: CatalogSettingsData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"

    if ([
        "addCategory", "removeCategory", "updateCategory", "toggleCurrency", "toggleLocale", "upsertChannel", "deleteChannel"
    ].includes(data.context.methodName)) {
        return {statusCode: 200}
    }

    switch (data.context.methodName) {
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

export async function getInstanceId(data: CatalogSettingsData<AccountIDInput>): Promise<string> {
    return data.request.body.accountId
}

export async function init(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    data.state.public = {
        categories: [{
            code: "masterCatalog",
            label: [
                {
                    locale: "en_Us",
                    value: "Master Catalog"
                }
            ],
            subCategories: []
        }],
        channels: [{
            code: "eCommerce",
            label: [
                {
                    locale: "en_US",
                    value: "E-Commerce"
                }
            ],
            locales: ["en_US"],
            currencies: ["USD"],
            categoryTree: "masterCatalog"
        }],
        enabledCurrencies: ["USD"],
        enabledLocales: ["en_US"],
        updateToken: randomString(),
    }
    return data
}

export async function getState(data: CatalogSettingsData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

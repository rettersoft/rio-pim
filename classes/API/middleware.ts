import {APIData} from "./index";
import {PIMMiddlewarePackage} from "PIMMiddlewarePackage";


export async function checkUserRole(data: APIData) {
    const middlewarePackage = new PIMMiddlewarePackage();
    await middlewarePackage.checkUserRole({
        accountId: data.context.instanceId,
        userId: data.context.userId,
        identity: data.context.identity
    })
}

export async function checkApiKey(data: APIData) {
    if (!(data.state.private.apiKeys || []).find(a => a.apiKey === data.request.headers["x-api-key"])) {
        throw new Error("Access Denied")
    }
}

export async function checkAuthorization(data: APIData) {
    if (data.context.identity === "system_user") {
        await checkUserRole(data)
    } else if ([
        "CatalogSettings",
        "AccountManager",
        "Export",
        "Import",
        "InternalDestination",
        "Product",
        "ProductSettings",
        "System",
        "SystemUser",
    ].includes(data.context.identity)) {
        return true
    } else {
        await checkApiKey(data)
    }
}

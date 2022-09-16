import {APIData} from "./index";
import {Classes} from "./rio";


export async function getProducts(data: APIData): Promise<APIData> {
    if(!checkApiKey(data)){
        data.response = {
            statusCode: 401,
            body: {
                message: "Access Denied!"
            }
        }
        return data
    }

    const accountId = data.context.instanceId.split("-").shift()

    const pageFrom = parseInt(data.request.body.pageFrom ) || 0
    const pageSize = parseInt(data.request.body.pageSize) || 10

    const productSKUList = await (new Classes.ProductManager(accountId).getProductsSKUList({
        pageFrom,
        pageSize
    }))

    const workers: Promise<any>[] = []

    for (const productSKUListElement of productSKUList.body.productsSKUList as string[]) {
        workers.push(new Classes.Product(accountId + "-" + productSKUListElement).getProduct())
    }

    const productsResult = await Promise.all(workers)

    data.response = {
        statusCode: 200,
        body: {
            pageFrom,
            pageSize,
            totalProducts: productSKUList.body.totalProducts,
            products: productsResult.map(pr => pr.body)
        }
    }
    return data
}

export async function getProductSettings(data: APIData): Promise<APIData> {
    if(!checkApiKey(data)){
        data.response = {
            statusCode: 401,
            body: {
                message: "Access Denied!"
            }
        }
        return data
    }

    const accountId = data.context.instanceId.split("-").shift()

    const getProductsSettingsResult = await new Classes.ProductSettings(accountId).getProductSettings()

    data.response = {
        statusCode: 200,
        body: {
            productSettings: getProductsSettingsResult.body.productSettings
        }
    }

    return data
}

export async function getCatalogSettings(data: APIData): Promise<APIData> {
    if(!checkApiKey(data)){
        data.response = {
            statusCode: 401,
            body: {
                message: "Access Denied!"
            }
        }
        return data
    }

    const accountId = data.context.instanceId.split("-").shift()

    const catalogSettingsResult = await (new Classes.CatalogSettings(accountId).getCatalogSettings())

    data.response = {
        statusCode: 200,
        body: {
            catalogSettings: catalogSettingsResult.body
        }
    }
    return data
}



function checkApiKey(data: APIData): boolean{
    return data.request.headers?.apikey && data.state.private.apiKeys.findIndex(a => a.apiKey === data.request.headers.apikey) !== -1;
}

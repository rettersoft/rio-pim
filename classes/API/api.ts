import {APIData} from "./index";
import {Classes, GetProductsInput} from "./rio";
import {ElasticHelper} from "./elastic";
import {SearchTotalHits} from "@elastic/elasticsearch/lib/api/types";
import RDK from "@retter/rdk";
import {checkUserRoleIfUser} from "./middleware";

const rdk = new RDK();


export async function getProducts(data: APIData<GetProductsInput>): Promise<APIData> {
    await checkUserRoleIfUser(data)

    const elasticHelper = new ElasticHelper(data.context.instanceId)

    const response = await elasticHelper.getProducts(data.request.body)

    data.response = {
        statusCode: 200,
        body: {
            filters: data.request.body?.filters,
            pageFrom: response.from,
            pageSize: response.size,
            totalProducts: (response.result.hits.total as SearchTotalHits).value,
            products: response.result.hits.hits.map(hit => {
                return {
                    score: hit._score,
                    source: hit._source
                }
            })
        }
    }
    return data
}

export async function getProductSettings(data: APIData): Promise<APIData> {
    await checkUserRoleIfUser(data)

    const getProductsSettingsResult = await new Classes.ProductSettings(data.context.instanceId).getProductSettings()

    data.response = {
        statusCode: 200,
        body: {
            productSettings: getProductsSettingsResult.body.productSettings
        }
    }

    return data
}

export async function getCatalogSettings(data: APIData): Promise<APIData> {
    await checkUserRoleIfUser(data)

    const catalogSettingsResult = await (new Classes.CatalogSettings(data.context.instanceId).getCatalogSettings())

    data.response = {
        statusCode: 200,
        body: {
            catalogSettings: catalogSettingsResult.body
        }
    }
    return data
}

export async function upsertProduct(data: APIData): Promise<APIData> {
    await checkUserRoleIfUser(data)

    const productInstance = await Classes.Product.getInstance({
        body: {...data.request.body, accountId: data.context.instanceId}
    })

    if (!productInstance.isNewInstance) {
        await productInstance.updateProduct({...data.request.body, accountId: data.context.instanceId})
    }

    return data
}

export async function deleteProduct(data: APIData): Promise<APIData> {
    const id = data.request.body.id
    if (!id && id === "") {
        data.response = {
            statusCode: 400,
            body: {
                message: "'id' required!"
            }
        }
        return data
    }

    await rdk.deleteInstance({instanceId: `${data.context.instanceId}-${id}`, classId: 'Product'})

    return data
}

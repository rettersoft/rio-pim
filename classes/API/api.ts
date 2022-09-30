import {APIData} from "./index";
import {Classes, GetProductsInput} from "./rio";
import {ElasticHelper} from "./elastic";
import {SearchTotalHits} from "@elastic/elasticsearch/lib/api/types";


export async function getProducts(data: APIData<GetProductsInput>): Promise<APIData> {
    const accountId = data.context.instanceId.split("-").shift()
    const elasticHelper = new ElasticHelper(accountId)

    const result = await elasticHelper.getProducts(data.request.body)

    data.response = {
        statusCode: 200,
        body: {
            filters: data.request.body?.filters,
            pageFrom: data.request.body?.pageFrom,
            pageSize: data.request.body?.pageSize,
            totalProducts: (result.hits.total as SearchTotalHits).value,
            products: result.hits.hits.map(hit => {
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

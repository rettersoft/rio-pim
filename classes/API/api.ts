import {APIData} from "./index";
import {Classes, GetProductsInput} from "./rio";
import {ElasticHelper} from "./elastic";
import {SearchTotalHits} from "@elastic/elasticsearch/lib/api/types";
import RDK from "@retter/rdk";
import {checkAuthorization} from "./middleware";
import {GetImageInputForAPI} from "./custom-models";
import {Buffer} from "buffer";
import {PIMRepository} from "PIMModelsPackage";

const rdk = new RDK();


export async function getProducts(data: APIData<GetProductsInput>): Promise<APIData> {
    await checkAuthorization(data)

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
    await checkAuthorization(data)

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
    await checkAuthorization(data)

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
    await checkAuthorization(data)

    let productInstance: Classes.Product;

    try {
        productInstance = await Classes.Product.getInstance({
            body: {...data.request.body, accountId: data.context.instanceId}
        })
        data.response = {
            statusCode: 200,
            body: productInstance._response
        }
    } catch (e) {
        data.response = {
            statusCode: 400,
            body: {
                message: e.toString()
            }
        }
        return data
    }

    if (!productInstance.isNewInstance) {
        const res = await productInstance.updateProduct({...data.request.body, accountId: data.context.instanceId})
        data.response = {
            statusCode: res.statusCode,
            body: res.body
        }
        if (res.statusCode >= 400) {
            data.response = {
                statusCode: res.statusCode,
                body: res.body
            }
            return data
        }
    }

    return data
}

export async function deleteProduct(data: APIData): Promise<APIData> {
    await checkAuthorization(data)

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

export async function getImage(data: APIData): Promise<APIData> {
    //await checkAuthorization(data)
    const d = GetImageInputForAPI.safeParse(data.request.queryStringParams)

    if (d.success === false) {
        data.response = {
            statusCode: 400,
            body: {message: "Invalid api parameters! (Model validation failed)", error: d.error}
        }
        return data
    }

    const result = await PIMRepository.getImageByRDK(data.context.instanceId, d.data as any)
    data.response = {
        statusCode: 200,
        body: result.fileData,
        isBase64Encoded: true,
        headers: {
            "content-type": result.contentType,
            "cache-control": result.cacheControl
        }
    }

    return data
}

export async function uploadProductTempImage(data: APIData): Promise<APIData> {
    await checkAuthorization(data)

    if (!data.request.body.image || data.request.body.image === "" ||
        !data.request.body.productId || data.request.body.productId === "" ||
        !data.request.body.extension || data.request.body.extension === "" ||
        !data.request.body.attributeCode || data.request.body.attributeCode === "") {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid body!"
            }
        }
        return data
    }

    try {
        Buffer.from(data.request.body.image, "base64")
    } catch (e) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid image data!"
            }
        }
        return data
    }

    data.response = await new Classes.Product([data.context.instanceId, data.request.body.productId].join("-")).uploadTempImage({
        image: data.request.body.image,
        extension: data.request.body.extension,
        attributeCode: data.request.body.attributeCode,
    })

    return data
}

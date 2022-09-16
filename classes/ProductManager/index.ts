import RDK, {Data, Response} from "@retter/rdk";
import {AccountIDInput, Classes} from "./rio";
import {Client} from "@elastic/elasticsearch";
import {Env} from "./env";
import axios from "axios";
import Product = Classes.Product;
import _ from "lodash";
const rdk = new RDK();
const client = new Client({
    cloud: {
        id: Env.get("ELASTIC_CLOUD_ID")
    },
    auth: {
        username: Env.get("ELASTIC_CLOUD_USERNAME"),
        password: Env.get("ELASTIC_CLOUD_PASSWORD")
    }
})

const ELASTIC_INDEX_PREFIX = "search"

interface ProductListItem {
    score: number
    source: {
        product: any
        meta: any
    }
}

export interface ProductManagerPrivateState {
    productsSKUList: string[]
}

export type ProductManagerData<Input = any, Output = any> = Data<Input, Output, any, ProductManagerPrivateState>

export async function authorizer(data: ProductManagerData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"

    if ([
        "getProductList",
        "createProduct",
        "deleteProduct",
        "getProductsSKUList"
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

export async function getInstanceId(data: ProductManagerData<AccountIDInput>): Promise<string> {
    return data.request.body.accountId
}

export async function init(data: ProductManagerData): Promise<ProductManagerData> {
    data.state.private = {
        productsSKUList: []
    }
    return data
}

export async function getState(data: ProductManagerData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

export async function getProductList(data: ProductManagerData): Promise<ProductManagerData> {
    const result = await client.search({
        index: ELASTIC_INDEX_PREFIX + "-" + data.context.instanceId,
        query: {
            match_all: {}
        },
    })
    const response: ProductListItem[] = result.hits.hits.map(h => {
        return {
            score: h._score,
            source: h._source as any,
        }
    })
    data.response = {
        statusCode: 200,
        body: response
    }
    return data
}

export async function createProduct(data: ProductManagerData): Promise<ProductManagerData> {
    if (!data.request.body.sku || data.request.body.sku === "") {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid SKU"
            }
        }
        return data
    }

    const result = await Product.getInstance({body: data.request.body})

    if (!result.isNewInstance) {
        data.response = {
            statusCode: 400,
            body: {
                message: "This SKU already exist!"
            }
        }
        return data
    }

    data.state.private.productsSKUList.push(data.request.body.sku)

    const accountId = data.context.instanceId.split("-").shift()
    await rdk.incrementMemory({key: `product#metric#${accountId + "-" + data.request.body.family}`, value: 1})

    return data
}

export async function deleteProduct(data: ProductManagerData): Promise<ProductManagerData> {
    if (!data.request.body.sku || data.request.body.sku === "") {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid SKU"
            }
        }
        return data
    }

    if (!data.state.private.productsSKUList.includes(data.request.body.sku)) {
        data.response = {
            statusCode: 404,
            body: {
                message: "SKU not found!"
            }
        }
        return data
    }

    try {
        await axios({
            method: "POST",
            params: {apiKey: Env.get("INTERNAL_API_KEY")},
            url: `https://${data.context.projectId}.api.retter.io/${data.context.projectId}/DESTROY/Product/${data.context.instanceId + "-" + data.request.body.sku}`
        })
    } catch (e) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Product delete error!",
                error: e.toString()
            }
        }
    }

    return data
}

export async function getProductsSKUList(data: ProductManagerData): Promise<ProductManagerData> {
    const list = _.slice(data.state.private.productsSKUList, data.request.body.pageFrom, data.request.body.pageFrom + data.request.body.pageSize)

    data.response = {
        statusCode: 200,
        body: {
            totalProducts: data.state.private.productsSKUList.length,
            productsSKUList: list
        }
    }
    return data
}

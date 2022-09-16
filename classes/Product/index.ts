import RDK, {Data, Response} from "@retter/rdk";
import {AttributeTypes, IMAGE, Product} from "./models";
import {checkUpdateToken, getProductRemovedImages, randomString} from "./helpers";
import {Classes, ElasticProductHandlerMethod} from "./rio";
import {validateProductAttributes, validateProductUniqueAttributes} from "./validations";
import {getProductAttributeSortedSetKeyMap} from "./sorted-sets";
import {Env} from "./env";
import {Buffer} from "buffer";
import {v4 as uuidv4} from 'uuid';
import InternalDestination = Classes.InternalDestination;
import mime from "mime-types";

const rdk = new RDK()

export interface ProductPrivateState {
    product: Product
    savedImages: string[]
    tempImages: string[]
    createdAt: string,
    updatedAt: string,
    updateToken: string
}

export interface ImageResponse {
    imageId: string
    extension: string
    filename: string
}

export type ProductData<Input = any, Output = any> = Data<Input, Output, any, ProductPrivateState>

export async function authorizer(data: ProductData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"

    if ([
        "getProduct",
        "updateProduct",
        "uploadTempImage",
        "deleteUploadedTempImage",
        "getUploadedImage"
    ].includes(data.context.methodName)) {
        return {statusCode: 200}
    }

    switch (data.context.methodName) {
        case 'checkUploadedImage':
            if (data.context.identity === "Product" || isDeveloper) {
                return {statusCode: 200}
            }
            break
        case 'STATE':
            if (isDeveloper) return {statusCode: 200}
            break
        case 'GET':
            return {statusCode: 200}
        case 'DESTROY':
            if (Env.get("INTERNAL_API_KEY") === data.request.queryStringParams.apiKey) {
                return {statusCode: 200}
            }
            break
        case 'INIT':
            if (data.context.identity === "ProductManager" || isDeveloper) {
                return {statusCode: 200}
            }
            break
    }
    return {statusCode: 401};
}

export async function getInstanceId(data: ProductData): Promise<string> {
    return data.context.userId + "-" + data.request.body.sku
}

export async function init(data: ProductData): Promise<ProductData> {
    const result = Product.safeParse(data.request.body)
    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: result.error
            }
        }
        return data
    }

    data.state.private.tempImages = []
    data.state.private.savedImages = []
    data.state.private.product = result.data
    data.state.private.createdAt = new Date().toISOString()
    data.state.private.updatedAt = new Date().toISOString()
    data.state.private.updateToken = randomString()

    await sendToElastic({
        instanceId: data.context.instanceId,
        method: ElasticProductHandlerMethod.Create,
        product: {
            product: data.state.private.product,
            meta: {
                createdAt: data.state.private.createdAt,
                updatedAt: data.state.private.updatedAt
            }
        },
    })

    return data
}

export async function getState(data: ProductData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

export async function getProduct(data: ProductData): Promise<ProductData> {
    const accountId = data.context.instanceId.split("-").shift()
    const getProductsSettingsResult = await new Classes.ProductSettings(accountId).getProductSettings()
    if (getProductsSettingsResult.statusCode >= 400) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Product settings error!"
            }
        }
        return data
    }
    const family = getProductsSettingsResult.body.productSettings.families.find(f => f.code === data.state.private.product.family)

    if (!family) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Product family not found!"
            }
        }
        return data
    }

    const product = data.state.private.product
    product.attributes = product.attributes.filter(pa => family.attributes.find(fa => fa.attribute === pa.code))

    data.response = {
        statusCode: 200,
        body: {
            product: data.state.private.product,
            meta: {
                createdAt: data.state.private.createdAt,
                updatedAt: data.state.private.updatedAt,
                updateToken: data.state.private.updateToken
            }
        }
    }
    return data
}

export async function updateProduct(data: ProductData): Promise<ProductData> {
    checkUpdateToken(data)

    const result = Product.safeParse({
        ...data.state.private.product,
        categories: data.request.body.categories,
        attributes: data.request.body.attributes,
    })

    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: result.error
            }
        }
        return data
    }
    const accountId = data.context.instanceId.split("-").shift()

    const getProductsSettingsResult = await new Classes.ProductSettings(accountId).getProductSettings()
    if (getProductsSettingsResult.statusCode >= 400) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Product settings error!"
            }
        }
        return data
    }

    await validateProductAttributes(result.data.family, result.data.attributes, getProductsSettingsResult.body.productSettings)

    await validateProductUniqueAttributes(result.data.attributes, getProductsSettingsResult.body.productSettings.attributes, accountId)

    const removedImages = getProductRemovedImages(result.data.attributes, data.state.private.product.attributes, getProductsSettingsResult.body.productSettings.attributes)

    //remove images
    const removeImageWorkers = []
    removedImages.forEach(ri=>{
        removeImageWorkers.push(rdk.deleteFile({filename: ri}))
    })
    await Promise.all(removeImageWorkers)

    for (const attribute of result.data.attributes) {
        const attributeProperty = getProductsSettingsResult.body.productSettings.attributes.find(ap => ap.code === attribute.code)

        if (attributeProperty.type === AttributeTypes.Enum.IMAGE) {
            const attachedImages = attribute.data.filter(d=>d.value !== undefined).map(d=>{
                return d.value
            })

            //activate images
            attachedImages.forEach(ai=>{
                data.state.private.tempImages = data.state.private.tempImages.filter(ti => ti !== ai)
                if (!data.state.private.savedImages) data.state.private.savedImages = []
                data.state.private.savedImages.push(ai)
            })
        }

        if (attributeProperty.isUnique && attribute.data && attribute.data.length && attribute.data[0].value) {
            await rdk.addToSortedSet({
                data: {}, ...getProductAttributeSortedSetKeyMap({
                    accountId,
                    attributeCode: attribute.code,
                    attributeValue: attribute.data[0].value
                })
            })
        }
    }

    data.state.private.product = result.data
    data.state.private.updateToken = randomString()
    data.state.private.updatedAt = new Date().toISOString()

    await sendToElastic({
        instanceId: data.context.instanceId,
        method: ElasticProductHandlerMethod.Update,
        product: {
            product: data.state.private.product,
            meta: {
                createdAt: data.state.private.createdAt,
                updatedAt: data.state.private.updatedAt
            }
        },
    })

    return data
}

export async function destroy(data: ProductData): Promise<ProductData> {
    const workers: Array<Promise<any>> = []
    for (const savedImage of data.state.private.savedImages) {
        workers.push(rdk.deleteFile({filename: savedImage}))
    }
    await Promise.all(workers)

    const accountId = data.context.instanceId.split("-").shift()
    await rdk.incrementMemory({key: `product#metric#${accountId + "-" + data.state.private.product.family}`, value: -1})

    await sendToElastic({
        instanceId: data.context.instanceId,
        method: ElasticProductHandlerMethod.Delete
    })
    return data
}

async function sendToElastic(props: {
    instanceId: string,
    product?: { product: Product, meta: { createdAt: string, updatedAt: string } }, method: ElasticProductHandlerMethod
}) {
    try {
        await new InternalDestination(props.instanceId.split("-").shift()).productHandler({
            productInstanceId: props.instanceId,
            method: props.method,
            product: props.product,
        })
    } catch (e) {
    }

}

export async function uploadTempImage(data: ProductData): Promise<ProductData> {

    if (!data.request.body.image || data.request.body.image === "" ||
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

    let imageBuffer: Buffer;
    try {
        imageBuffer = Buffer.from(data.request.body.image, "base64")
    } catch (e) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid image data!"
            }
        }
        return data
    }

    const accountId = data.context.instanceId.split("-").shift()
    const getProductsSettingsResult = await new Classes.ProductSettings(accountId).getProductSettings()
    if (getProductsSettingsResult.statusCode >= 400) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Product settings error!"
            }
        }
        return data
    }

    const attributeProperty = getProductsSettingsResult.body.productSettings.attributes.find(a => a.code === data.request.body.attributeCode)
    if (!attributeProperty || attributeProperty.type !== AttributeTypes.Enum.IMAGE) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid attribute!"
            }
        }
        return data
    }

    const IMAGE: IMAGE = (attributeProperty as IMAGE)

    if (IMAGE.allowedExtensions !== undefined) {
        if (!IMAGE.allowedExtensions.includes(data.request.body.extension)) {
            data.response = {
                statusCode: 400,
                body: {
                    message: `Not allowed extension! Allowed extensions: (${IMAGE.allowedExtensions.join(", ")})`
                }
            }
            return data
        }
    }

    if (IMAGE.maxFileSizeInMB !== undefined) {
        const imageLengthInMB = (Buffer.byteLength(imageBuffer) / (1024 * 1024)).toFixed(2)
        if (parseFloat(imageLengthInMB) > IMAGE.maxFileSizeInMB) {
            data.response = {
                statusCode: 400,
                body: {
                    message: `Max image size should be ${IMAGE.maxFileSizeInMB}`
                }
            }
            return data
        }
    }

    const imageId = uuidv4().replace(new RegExp("-","g"), "")
    const imageFileName = accountId + "-" + imageId + "." + data.request.body.extension
    await rdk.setFile({body: data.request.body.image, filename: imageFileName})

    const response: ImageResponse = {
        imageId,
        extension: data.request.body.extension,
        filename: imageFileName
    }

    data.tasks.push({
        after: parseInt(Env.get("TEMP_IMAGE_TTL_IN_SECONDS")),
        method: "checkUploadedImage",
        payload: response
    })

    if (!data.state.private.tempImages) data.state.private.tempImages = []
    data.state.private.tempImages.push(imageFileName)

    data.response = {
        statusCode: 200,
        body: response
    }

    return data
}

export async function deleteUploadedTempImage(data: ProductData): Promise<ProductData> {

    if (data.state.private.tempImages.includes(data.request.body.filename)) {
        await rdk.deleteFile({filename: data.request.body.filename})
        data.state.private.tempImages = data.state.private.tempImages.filter(t => t !== data.request.body.filename)
    }

    return data
}


export async function checkUploadedImage(data: ProductData): Promise<ProductData> {
    const payload: ImageResponse = data.request.body

    if (data.state.private.tempImages.includes(payload.filename)) {
        await rdk.deleteFile({filename: payload.filename})
    }

    return data
}

export async function getUploadedImage(data: ProductData): Promise<ProductData> {
    const filename= data.request.queryStringParams.filename
    const file = await rdk.getFile({filename})
    if(file.error){
        data.response = {
            statusCode: 400,
            body: {
                message: file.error
            }
        }
        return data
    }

    data.response = {
        statusCode: 200,
        body: file.data,
        isBase64Encoded: true,
        headers:{
            "content-type": mime.lookup(filename.split(".").pop()) || undefined
        }
    }

    return data
}

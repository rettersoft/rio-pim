import RDK, {Data, Response} from "@retter/rdk";
import {AttributeTypes, AxesValuesList, Code, DataType, IMAGE, Product, ProductModel} from "./models";
import {checkUpdateToken, finalizeProductOperation, getProductClassAccountId, randomString} from "./helpers";
import {Classes, InternalDestinationEventHandlerInput, WebhookEventOperation, WebhookEventType} from "./rio";
import {Env} from "./env";
import {Buffer} from "buffer";
import {v4 as uuidv4} from 'uuid';
import mime from "mime-types";
import {getProductAttributeKeyMap} from "./keysets";
import {MiddlewarePackage} from "MiddlewarePackage";
import {ModelsRepository} from "./models-repository";
import {checkProduct, checkProductModel, checkProductModelVariant, checkVariantAxesForInit} from "./validations";
import {ClassesRepository} from "./classes-repository";
import InternalDestination = Classes.InternalDestination;

const middleware = new MiddlewarePackage()

const rdk = new RDK()

export interface ProductPrivateState {
    dataSource?: Product | ProductModel
    dataType: DataType
    parent?: string
    axesValues?: AxesValuesList
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


export interface GetProductOutputData {
    dataType: DataType,
    parent: string
    data: Product | ProductModel
    updateToken: string
    meta: {
        createdAt: string
        updatedAt: string
        updateToken: string
    }
}

export async function authorizer(data: ProductData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"

    if ([
        "getProduct",
        "updateProduct",
        "uploadTempImage",
        "deleteUploadedTempImage",
        "getUploadedImage",
        "deleteInstance"
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
        case 'DESTROY':
        case 'GET':
            return {statusCode: 200}
        case 'INIT':
            if (isDeveloper || ["system_user", "API"].includes(data.context.identity)) {
                return {statusCode: 200}
            }
            break
    }
    return {statusCode: 401};
}

export async function getInstanceId(data: ProductData): Promise<string> {
    const dataTypeResult = DataType.safeParse(data.request.body.dataType)

    if (dataTypeResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: dataTypeResult.error
            }
        }
        throw new Error("Data type error!")
    }

    const accountId = data.request.body.accountId

    if (!accountId) throw new Error("Account id is not defined!")

    const productData = data.request.body.data

    if (!productData) throw new Error("Product data is not defined!")

    let productId;

    if (dataTypeResult.data === DataType.Enum.PRODUCT) {
        if (!productData.sku) throw new Error("Product sku is not defined!")
        productId = productData.sku
    } else if (dataTypeResult.data === DataType.Enum.PRODUCT_MODEL) {
        if (!productData.code) throw new Error("Product model code is not defined!")
        productId = productData.code
    } else {
        throw new Error("Invalid data type error!")
    }

    const productIdResult = Code.safeParse(productId)
    if (productIdResult.success === false) {
        throw new Error("Invalid product sku or code!")
    }

    return accountId + "-" + productIdResult.data
}

export async function init(data: ProductData): Promise<ProductData> {
    const accountId = getProductClassAccountId(data)

    if (data.context.identity !== "API") {
        await middleware.checkUserRole({accountId, userId: data.context.userId, identity: data.context.identity})
    }

    const dataType = ModelsRepository.getDataType(data.request.body.dataType)

    const productSettings = await ClassesRepository.getProductsSettings(accountId)

    let source: Product | ProductModel;

    switch (dataType) {
        case DataType.Enum.PRODUCT:
            if (data.request.body.parent !== undefined) {
                const checkSum = await checkProductModelVariant({
                    accountId,
                    axesValues: data.request.body.axesValues,
                    data: data.request.body.data,
                    parent: data.request.body.parent,
                    productSettings
                })

                await checkVariantAxesForInit({
                    accountId,
                    axesValues: data.request.body.axesValues,
                    childProduct: checkSum.childProduct,
                    parentProductModel: checkSum.parentProduct,
                    productSettings
                })

                source = checkSum.childProduct
                data.state.private.parent = data.request.body.parent
            } else {
                source = await checkProduct({
                    accountId,
                    data: data.request.body.data,
                    productSettings
                })
            }
            break
        case DataType.Enum.PRODUCT_MODEL:
            source = await checkProductModel({
                accountId,
                data: data.request.body.data,
                productSettings
            })
            break
        default:
            throw new Error("Invalid data type!")
    }

    await finalizeProductOperation(data, source.attributes, productSettings)

    data.state.private.dataSource = source
    data.state.private.dataType = dataType
    data.state.private.tempImages = []
    data.state.private.savedImages = []
    data.state.private.createdAt = new Date().toISOString()
    data.state.private.updatedAt = new Date().toISOString()
    data.state.private.updateToken = randomString()

    await sendProductEvent({
        instanceId: data.context.instanceId,
        method: WebhookEventOperation.Create,
        type: data.state.private.dataType === DataType.Enum.PRODUCT ? WebhookEventType.Product : WebhookEventType.ProductModel,
        source: {
            axesValues: dataType === DataType.Enum.PRODUCT && data.request.body.parent ? data.request.body.axesValues : [],
            parent: data.state.private.parent,
            dataType: data.state.private.dataType,
            data: source,
            meta: {
                createdAt: data.state.private.createdAt,
                updatedAt: data.state.private.updatedAt
            }
        },
    })

    data.response = {
        statusCode: 200,
        body: {
            meta: {
                createdAt: data.state.private.createdAt,
                updatedAt: data.state.private.updatedAt,
                updateToken: data.state.private.updateToken
            }
        }
    }

    return data
}

export async function getState(data: ProductData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

export async function getProduct(data: ProductData): Promise<ProductData<any, GetProductOutputData>> {
    const accountId = getProductClassAccountId(data)

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
    const family = getProductsSettingsResult.body.productSettings.families.find(f => f.code === data.state.private.dataSource.family)

    if (!family) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Product family not found!"
            }
        }
        return data
    }

    const sourceData = data.state.private.dataSource
    sourceData.attributes = (sourceData.attributes || []).filter(pa => family.attributes.find(fa => fa.attribute === pa.code))

    data.response = {
        statusCode: 200,
        body: {
            dataType: data.state.private.dataType,
            parent: data.state.private.parent,
            data: sourceData,
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
    const accountId = getProductClassAccountId(data)

    checkUpdateToken(data)

    if (data.context.identity !== "AccountManager" && data.context.identity !== "API") {
        await middleware.checkUserRole({accountId, userId: data.context.userId, identity: data.context.identity})
    }

    const dataType = ModelsRepository.getDataType(data.request.body.dataType)

    const productSettings = await ClassesRepository.getProductsSettings(accountId)

    let source: Product | ProductModel;

    switch (dataType) {
        case DataType.Enum.PRODUCT:
            if (data.request.body.parent) {
                const checkSum = await checkProductModelVariant({
                    accountId,
                    axesValues: data.request.body.axesValues,
                    data: {...data.state.private.dataSource, ...data.request.body.data},
                    parent: data.request.body.parent,
                    productSettings
                })
                source = checkSum.childProduct
            } else {
                source = await checkProduct({
                    accountId,
                    data: {...data.state.private.dataSource, ...data.request.body.data},
                    productSettings
                })
            }
            break
        case DataType.Enum.PRODUCT_MODEL:
            source = await checkProductModel({
                accountId,
                data: {...data.state.private.dataSource, ...data.request.body.data},
                productSettings
            })
            break
        default:
            throw new Error("Invalid data type!")
    }

    await finalizeProductOperation(data, source.attributes, productSettings)

    data.state.private.dataSource = source
    data.state.private.updateToken = randomString()
    data.state.private.updatedAt = new Date().toISOString()

    await sendProductEvent({
        instanceId: data.context.instanceId,
        method: WebhookEventOperation.Update,
        type: data.state.private.dataType === DataType.Enum.PRODUCT ? WebhookEventType.Product : WebhookEventType.ProductModel,
        source: {
            parent: data.state.private.parent,
            dataType: data.state.private.dataType,
            data: data.state.private.dataSource,
            meta: {
                createdAt: data.state.private.createdAt,
                updatedAt: data.state.private.updatedAt
            }
        },
    })

    data.response = {
        statusCode: 200,
        body: {
            meta: {
                createdAt: data.state.private.createdAt,
                updatedAt: data.state.private.updatedAt,
                updateToken: data.state.private.updateToken
            }
        }
    }

    return data
}

export async function deleteInstance(data: ProductData): Promise<ProductData> {
    const accountId = data.context.instanceId.split("-").shift()

    await middleware.checkUserRole({accountId, userId: data.context.userId, identity: data.context.identity})

    await rdk.deleteInstance({
        classId: "Product",
        instanceId: data.context.instanceId
    })
    return data
}

export async function destroy(data: ProductData): Promise<ProductData> {

    if (data.context.identity !== "AccountManager" && data.context.identity !== "API") {
        await middleware.checkUserRole({
            accountId: getProductClassAccountId(data),
            userId: data.context.userId,
            identity: data.context.identity
        })
    }

    const workers: Array<Promise<any>> = []
    for (const savedImage of data.state.private.savedImages) {
        workers.push(rdk.deleteFile({filename: savedImage}))
    }
    await Promise.all(workers)

    let source: Product | ProductModel;

    switch (data.state.private.dataType) {
        case DataType.Enum.PRODUCT:
            source = data.state.private.dataSource
            break
        case DataType.Enum.PRODUCT_MODEL:
            source = data.state.private.dataSource
            break
        default:
            throw new Error("Invalid data type!")
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

    for (const attribute of source.attributes) {
        const attributeProperty = getProductsSettingsResult.body.productSettings.attributes.find(ap => ap.code === attribute.code)

        if (attributeProperty.isUnique && attribute.data && attribute.data.length && attribute.data[0].value) {
            await rdk.removeFromDatabase({
                ...getProductAttributeKeyMap({
                    accountId,
                    attributeCode: attribute.code,
                    attributeValue: attribute.data[0].value
                })
            })
        }
    }

    await sendProductEvent({
        instanceId: data.context.instanceId,
        method: WebhookEventOperation.Delete,
        type: data.state.private.dataType === DataType.Enum.PRODUCT ? WebhookEventType.Product : WebhookEventType.ProductModel
    })
    return data
}

async function sendProductEvent(props: {
    instanceId: string,
    source?: {
        axesValues?: AxesValuesList,
        parent?: string,
        dataType: DataType,
        data: Product | ProductModel, meta: { createdAt: string, updatedAt: string }
    },
    method: WebhookEventOperation,
    type: WebhookEventType
}) {
    try {
        const event: InternalDestinationEventHandlerInput = {
            eventDocument: props.source,
            eventDocumentId: props.instanceId,
            eventOperation: props.method,
            eventType: props.type
        }
        await new InternalDestination(props.instanceId.split("-").shift()).eventHandler(event)
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

    const imageId = uuidv4().replace(new RegExp("-", "g"), "")
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
    const filename = data.request.queryStringParams.filename
    const file = await rdk.getFile({filename})
    if (file.error) {
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
        headers: {
            "content-type": mime.lookup(filename.split(".").pop()) || undefined
        }
    }

    return data
}

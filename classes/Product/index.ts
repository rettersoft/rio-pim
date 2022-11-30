import RDK, {Data, Response} from "@retter/rdk";
import {
    checkUpdateToken,
    deleteProductClassInstanceCheck,
    finalizeProductOperation,
    getProductClassAccountId,
    getProductParentAttributes,
    manipulateRequestProductAttributes,
    randomString
} from "./helpers";
import {Classes, InternalDestinationEventHandlerInput, WebhookEventOperation, WebhookEventType} from "./rio";
import {Buffer} from "buffer";
import {v4 as uuidv4} from 'uuid';
import {getProductAttributeKeyMap} from "./keysets";
import {ModelsRepository} from "./models-repository";
import {checkProduct, checkProductModel, checkProductModelVariant, checkVariantAxesForInit} from "./validations";
import {PIMMiddlewarePackage} from "PIMMiddlewarePackage";
import {
    AttributeTypes,
    AxesValuesList,
    Code,
    Codes,
    DataType,
    IMAGE,
    Product,
    ProductModel,
    TEMP_IMAGE_TTL_IN_SECONDS
} from "PIMModelsPackage";
import {PIMRepository} from "PIMRepositoryPackage";
import _ from "lodash";
import InternalDestination = Classes.InternalDestination;

const middleware = new PIMMiddlewarePackage()

const rdk = new RDK()


interface SendEventInput {
    instanceId: string,
    source?: {
        axesValues?: AxesValuesList,
        parent?: string,
        dataType: DataType,
        data: Product | ProductModel, meta: { createdAt: string, updatedAt: string }
    },
    method: WebhookEventOperation,
    type: WebhookEventType
}

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
    const isThisClassInstance = data.context.identity === "Product" && data.context.userId === data.context.instanceId

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
        case 'updateGroups':
            if (data.context.identity === "ProductSettings" && data.context.userId === getProductClassAccountId(data)) {
                return {statusCode: 200}
            }
            break
        case 'checkUploadedImage':
            if (isThisClassInstance || isDeveloper) {
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
            if (isDeveloper || ["system_user", "API", "Import"].includes(data.context.identity)) {
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

    if (!["API", "Import"].includes(data.context.identity)) {
        await middleware.checkUserRole({accountId, userId: data.context.userId, identity: data.context.identity})
    }

    const dataType = ModelsRepository.getDataType(data.request.body.dataType)

    const [productSettings, catalogSettings] = await Promise.all([
        PIMRepository.getProductsSettings(accountId),
        PIMRepository.getCatalogSettings(accountId)
    ])

    let source: Product | ProductModel;

    switch (dataType) {
        case DataType.Enum.PRODUCT:
            if (data.request.body.parent !== undefined) {
                const checksum = await checkProductModelVariant({
                    accountId,
                    catalogSettings,
                    axesValues: data.request.body.axesValues,
                    data: data.request.body.data,
                    parent: data.request.body.parent,
                    productSettings
                })

                const checkSumAxesValues = await checkVariantAxesForInit({
                    accountId,
                    axesValues: data.request.body.axesValues,
                    childProduct: checksum.childProduct,
                    parentProductModel: checksum.parentProduct,
                    productSettings
                })

                source = checksum.childProduct
                data.state.private.parent = data.request.body.parent
                data.state.private.axesValues = checkSumAxesValues
            } else {
                source = await checkProduct({
                    catalogSettings,
                    accountId,
                    data: data.request.body.data,
                    productSettings
                })
            }
            break
        case DataType.Enum.PRODUCT_MODEL:
            source = await checkProductModel({
                catalogSettings,
                accountId,
                data: data.request.body.data,
                productSettings
            })
            break
        default:
            throw new Error("Invalid data type!")
    }

    if (source.attributes === undefined) source.attributes = []

    PIMRepository.eliminateProductData(source, productSettings, catalogSettings)

    await finalizeProductOperation(data, source.attributes, productSettings)

    manipulateRequestProductAttributes(data, source, productSettings, catalogSettings)

    data.state.private.dataSource = source
    data.state.private.dataType = dataType
    data.state.private.tempImages = []
    data.state.private.savedImages = []
    data.state.private.createdAt = new Date().toISOString()
    data.state.private.updatedAt = new Date().toISOString()
    data.state.private.updateToken = randomString()

    const family = productSettings.families.find(f => f.code === data.state.private.dataSource.family)

    if (!family) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Product family not found!"
            }
        }
        return data
    }

    const elasticEventData: SendEventInput = {
        instanceId: data.context.instanceId,
        method: WebhookEventOperation.Create,
        type: data.state.private.dataType === DataType.Enum.PRODUCT ? WebhookEventType.Product : WebhookEventType.ProductModel,
        source: {
            axesValues: data.state.private.axesValues,
            parent: data.state.private.parent,
            dataType: data.state.private.dataType,
            data: source,
            meta: {
                createdAt: data.state.private.createdAt,
                updatedAt: data.state.private.updatedAt
            }
        }
    }

    const webhookEventData = JSON.parse(JSON.stringify(elasticEventData))
    const parentAttributes = await getProductParentAttributes(data.state.private.dataType, data.state.private.parent, getProductClassAccountId(data))
    webhookEventData.source.data.attributes = [...(webhookEventData.source.data.attributes || []), ...parentAttributes].filter(pa => family.attributes.find(fa => fa.attribute === pa.code))

    await Promise.all([
        sendElasticProductEvent(elasticEventData),
        sendWebhookProductEvent(webhookEventData)
    ])

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

    const [productSettings, catalogSettings] = await Promise.all([
        PIMRepository.getProductsSettings(accountId),
        PIMRepository.getCatalogSettings(accountId)
    ])

    const sourceData = data.state.private.dataSource
    PIMRepository.eliminateProductData(sourceData, productSettings, catalogSettings)

    data.response = {
        statusCode: 200,
        body: {
            axesValues: data.state.private.axesValues,
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

    if (!["AccountManager", "API", "Import"].includes(data.context.identity)) {
        await middleware.checkUserRole({accountId, userId: data.context.userId, identity: data.context.identity})
    }

    const dataType = ModelsRepository.getDataType(data.request.body.dataType)


    const [productSettings, catalogSettings] = await Promise.all([
        PIMRepository.getProductsSettings(accountId),
        PIMRepository.getCatalogSettings(accountId)
    ])

    let source: Product | ProductModel = {...data.state.private.dataSource, ...data.request.body.data};

    if (source.attributes === undefined) source.attributes = []

    switch (dataType) {
        case DataType.Enum.PRODUCT:
            if (data.request.body.parent) {
                const checkSum = await checkProductModelVariant({
                    accountId,
                    catalogSettings,
                    axesValues: data.request.body.axesValues,
                    data: source,
                    parent: data.request.body.parent,
                    productSettings
                })
                source = checkSum.childProduct
            } else {
                source = await checkProduct({
                    accountId,
                    data: source,
                    catalogSettings,
                    productSettings
                })
            }
            break
        case DataType.Enum.PRODUCT_MODEL:
            source = await checkProductModel({
                accountId,
                data: {...data.state.private.dataSource, ...data.request.body.data},
                catalogSettings,
                productSettings
            })
            break
        default:
            throw new Error("Invalid data type!")
    }

    PIMRepository.eliminateProductData(source, productSettings, catalogSettings)

    await finalizeProductOperation(data, source.attributes, productSettings)

    manipulateRequestProductAttributes(data, source, productSettings, catalogSettings)

    data.state.private.dataSource = source
    data.state.private.updateToken = randomString()
    data.state.private.updatedAt = new Date().toISOString()

    const family = productSettings.families.find(f => f.code === data.state.private.dataSource.family)

    if (!family) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Product family not found!"
            }
        }
        return data
    }

    const elasticEventData: SendEventInput = {
        instanceId: data.context.instanceId,
        method: WebhookEventOperation.Create,
        type: data.state.private.dataType === DataType.Enum.PRODUCT ? WebhookEventType.Product : WebhookEventType.ProductModel,
        source: {
            axesValues: data.state.private.axesValues,
            parent: data.state.private.parent,
            dataType: data.state.private.dataType,
            data: source,
            meta: {
                createdAt: data.state.private.createdAt,
                updatedAt: data.state.private.updatedAt
            }
        }
    }

    const webhookEventData = JSON.parse(JSON.stringify(elasticEventData))
    const parentAttributes = await getProductParentAttributes(data.state.private.dataType, data.state.private.parent, getProductClassAccountId(data))
    webhookEventData.source.data.attributes = [...(webhookEventData.source.data.attributes || []), ...parentAttributes].filter(pa => family.attributes.find(fa => fa.attribute === pa.code))

    await Promise.all([
        sendElasticProductEvent(elasticEventData),
        sendWebhookProductEvent(webhookEventData)
    ])

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
    await deleteProductClassInstanceCheck(data)

    await rdk.deleteInstance({
        classId: "Product",
        instanceId: data.context.instanceId
    })
    return data
}

export async function destroy(data: ProductData): Promise<ProductData> {

    await deleteProductClassInstanceCheck(data)

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

    await Promise.all([
        sendWebhookProductEvent({
            instanceId: data.context.instanceId,
            method: WebhookEventOperation.Delete,
            type: data.state.private.dataType === DataType.Enum.PRODUCT ? WebhookEventType.Product : WebhookEventType.ProductModel
        }),
        sendElasticProductEvent({
            instanceId: data.context.instanceId,
            method: WebhookEventOperation.Delete,
            type: data.state.private.dataType === DataType.Enum.PRODUCT ? WebhookEventType.Product : WebhookEventType.ProductModel
        })
    ])
    return data
}

async function sendWebhookProductEvent(props: SendEventInput) {
    try {
        const event: InternalDestinationEventHandlerInput = {
            eventDocument: props.source,
            eventDocumentId: props.instanceId,
            eventOperation: props.method,
            eventType: props.type
        }
        await new InternalDestination(props.instanceId.split("-").shift()).webhookEventHandler(event)
    } catch (e) {
    }

}

async function sendElasticProductEvent(props: SendEventInput) {
    try {
        const event: InternalDestinationEventHandlerInput = {
            eventDocument: props.source,
            eventDocumentId: props.instanceId,
            eventOperation: props.method,
            eventType: props.type
        }
        await new InternalDestination(props.instanceId.split("-").shift()).elasticEventHandler(event)
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

    const img: IMAGE = (attributeProperty as IMAGE)

    if (img.allowedExtensions !== undefined) {
        if (!img.allowedExtensions.includes(data.request.body.extension)) {
            data.response = {
                statusCode: 400,
                body: {
                    message: `Not allowed extension! Allowed extensions: (${img.allowedExtensions.join(", ")})`
                }
            }
            return data
        }
    }

    if (img.maxFileSizeInMB !== undefined) {
        const imageLengthInMB = (Buffer.byteLength(imageBuffer) / (1024 * 1024)).toFixed(2)
        if (parseFloat(imageLengthInMB) > img.maxFileSizeInMB) {
            data.response = {
                statusCode: 400,
                body: {
                    message: `Max image size should be ${img.maxFileSizeInMB}`
                }
            }
            return data
        }
    }

    const imageId = uuidv4().replace(new RegExp("-", "g"), "")
    const imageFileName = PIMRepository.buildImageName(accountId, imageId, data.request.body.extension)
    await rdk.setFile({body: data.request.body.image, filename: imageFileName})

    const response: ImageResponse = {
        imageId,
        extension: data.request.body.extension,
        filename: imageFileName
    }

    data.tasks.push({
        after: TEMP_IMAGE_TTL_IN_SECONDS,
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

    const result = await PIMRepository.getImageByRDK(getProductClassAccountId(data), {filename})

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

export async function updateGroups(data: ProductData): Promise<ProductData> {

    const opType = data.request.body.opType

    if (!opType || opType === "" || !["remove", "add"].includes(opType)) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid optype!"
            }
        }
        return data
    }

    const codes = Codes.safeParse(data.request.body.groups)

    if (codes.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!"
            }
        }
        return data
    }

    if (data.state.private.dataType === DataType.Enum.PRODUCT) {
        switch (opType) {
            case "remove":
                codes.data.forEach(d => {
                    (data.state.private.dataSource as Product).groups = ((data.state.private.dataSource as Product).groups || []).filter(g => g !== d)
                });
                break
            case "add":
                (data.state.private.dataSource as Product).groups = _.uniq([...((data.state.private.dataSource as Product).groups || []), ...codes.data]);
                break
            default:
                throw new Error("Invalid optype!")
        }

        data.state.private.updatedAt = new Date().toISOString()
        const eventData: SendEventInput = {
            instanceId: data.context.instanceId,
            method: WebhookEventOperation.Create,
            type: data.state.private.dataType === DataType.Enum.PRODUCT ? WebhookEventType.Product : WebhookEventType.ProductModel,
            source: {
                axesValues: data.state.private.axesValues,
                parent: data.state.private.parent,
                dataType: data.state.private.dataType,
                data: data.state.private.dataSource,
                meta: {
                    createdAt: data.state.private.createdAt,
                    updatedAt: data.state.private.updatedAt
                }
            }
        }
        await Promise.all([
            sendWebhookProductEvent(eventData),
            sendElasticProductEvent(eventData)
        ])
    }

    return data
}

import RDK, {Data, Response} from "@retter/rdk";
import {
    AttributeOption,
    AttributeTypes,
    AxesValuesList,
    BaseAttribute,
    Code,
    DataType,
    FamilyVariant,
    IMAGE,
    Product,
    ProductModel
} from "./models";
import {checkUpdateToken, getProductRemovedImages, randomString} from "./helpers";
import {Classes, ElasticProductHandlerMethod} from "./rio";
import {validateProductAttributes, validateProductUniqueAttributes} from "./validations";
import {Env} from "./env";
import {Buffer} from "buffer";
import {v4 as uuidv4} from 'uuid';
import mime from "mime-types";
import {getProductAttributeKeyMap, getProductAxeKeyMap} from "./keysets";
import {MiddlewarePackage} from "MiddlewarePackage";
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


export interface GetProductOutputData{
    dataType: DataType,
    parent: string
    data: ProductData | ProductModel
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
            if (data.context.identity === "system_user" || isDeveloper) {
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
    const accountId = data.context.instanceId.split("-").shift()

    await middleware.checkUserRole({accountId, userId: data.context.userId, identity: data.context.identity})

    const dataTypeResult = DataType.safeParse(data.request.body.dataType)

    if (dataTypeResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: dataTypeResult.error
            }
        }
        return data
    }

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

    let source: Product | ProductModel;

    if (dataTypeResult.data === DataType.Enum.PRODUCT) {

        let getProductOutput: GetProductOutputData | undefined

        const hasParent = data.request.body.parent !== undefined
        const parentResult = Code.safeParse(data.request.body.parent)
        if (hasParent && parentResult.success === false) {
            data.response = {
                statusCode: 400,
                body: {
                    message: "Invalid parent!",
                    error: parentResult.error
                }
            }
            return data
        }else if(hasParent && parentResult.success){
            const getProductResult = await new Classes.Product(accountId + "-" + parentResult.data).getProduct()
            if (getProductResult.statusCode >= 400) {
                data.response = {
                    statusCode: getProductResult.statusCode,
                    body: getProductResult.body
                }
                return data
            }
            getProductOutput = getProductResult.body
        }

        let checkData: Product = data.request.body.data
        if(hasParent && getProductOutput){
            checkData = {
                ...checkData,
                family: (getProductOutput.data as ProductModel).family
            }
        }
        const dataResult = Product.safeParse(checkData)
        if (dataResult.success === false) {
            data.response = {
                statusCode: 400,
                body: {
                    message: "Model validation error!",
                    error: dataResult.error
                }
            }
            return data
        }

        source = dataResult.data


        if (hasParent && parentResult.success && getProductOutput) {

            const parentData = getProductOutput.data as ProductModel

            const variant: FamilyVariant | undefined = getProductsSettingsResult.body.productSettings.families.find(family => family.code === parentData.family)?.variants.find(variant => variant.code === parentData.variant)

            if (!variant) {
                throw new Error("Variant not found!")
            }

            const axesValuesResult = AxesValuesList.safeParse(data.request.body.axesValues)

            if (axesValuesResult.success === false) {
                data.response = {
                    statusCode: 400,
                    body: {
                        message: "Model validation error!",
                        error: axesValuesResult.error
                    }
                }
                return data
            }

            for (const axe of variant.axes) {
                const axeVal = axesValuesResult.data.find(d => d.axe === axe)?.value
                if (axeVal === undefined || axeVal === "") {
                    throw new Error(`Axe value required! (${axe})`)
                }
            }

            for (const datum of axesValuesResult.data) {
                if(!variant.axes.includes(datum.axe)){
                    throw new Error(`Unsupported axe value! (${datum.axe})`)
                } else {
                    const axeProperty: BaseAttribute = getProductsSettingsResult.body.productSettings.attributes.find(attr=>attr.code === datum.axe)
                    if(!axeProperty){
                        throw new Error("Axe attribute property not found!")
                    }
                    if(axeProperty.type === AttributeTypes.Enum.SIMPLESELECT){
                        const selectOptions: AttributeOption = getProductsSettingsResult.body.productSettings.attributeOptions.find(opt=>opt.code === datum.axe)
                        if(!selectOptions) throw new Error("Simple select axe property options not found!")
                        if(!selectOptions.options.find(so=>so.code===datum.value)) throw new Error("Invalid simple select axe value!")
                    }
                }
            }

            for (const parentAttribute of parentData.attributes) {
                if (dataResult.data.attributes.findIndex(a => a.code === parentAttribute) !== -1) {
                    throw new Error("You can not use parent attribute in a variant!")
                }
            }

            const axesSet = await rdk.readDatabase(getProductAxeKeyMap({
                accountId,
                productModelCode: parentResult.data,
                axesValues: axesValuesResult.data
            }))
            if (axesSet.success) {
                data.response = {
                    statusCode: 400,
                    body: {
                        message: "These axes are already in use!"
                    }
                }
                return data
            }

            await rdk.writeToDatabase({
                data: {}, ...getProductAxeKeyMap({
                    accountId,
                    productModelCode: parentResult.data,
                    axesValues: axesValuesResult.data
                })
            })

            data.state.private.axesValues = axesValuesResult.data
            data.state.private.parent = parentResult.data
        }

        data.state.private.dataSource = dataResult.data
        data.state.private.dataType = DataType.Enum.PRODUCT

    } else if (dataTypeResult.data === DataType.Enum.PRODUCT_MODEL) {
        const dataResult = ProductModel.safeParse(data.request.body.data)
        if (dataResult.success === false) {
            data.response = {
                statusCode: 400,
                body: {
                    message: "Model validation error!",
                    error: dataResult.error
                }
            }
            return data
        }

        source = dataResult.data

        data.state.private.dataSource = dataResult.data
        data.state.private.dataType = DataType.Enum.PRODUCT_MODEL

    } else {
        throw new Error("Invalid data type!")
    }

    data.state.private.tempImages = []
    data.state.private.savedImages = []
    data.state.private.createdAt = new Date().toISOString()
    data.state.private.updatedAt = new Date().toISOString()
    data.state.private.updateToken = randomString()

    await sendToElastic({
        instanceId: data.context.instanceId,
        method: ElasticProductHandlerMethod.Create,
        source: {
            parent: data.state.private.parent,
            dataType: data.state.private.dataType,
            data: source,
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

export async function getProduct(data: ProductData): Promise<ProductData<any, GetProductOutputData>> {
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
    sourceData.attributes = sourceData.attributes.filter(pa => family.attributes.find(fa => fa.attribute === pa.code))

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
    const accountId = data.context.instanceId.split("-").shift()

    await middleware.checkUserRole({accountId, userId: data.context.userId, identity: data.context.identity})

    checkUpdateToken(data)

    const dataTypeResult = DataType.safeParse(data.request.body.dataType)

    if (dataTypeResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: dataTypeResult.error
            }
        }
        return data
    }

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

    let source: Product | ProductModel;

    if (dataTypeResult.data === DataType.Enum.PRODUCT) {
        const dataResult = Product.safeParse({
            ...data.state.private.dataSource,
            categories: data.request.body.data.categories,
            attributes: data.request.body.data.attributes,
            enabled: data.request.body.data.enabled
        })

        if (dataResult.success === false) {
            data.response = {
                statusCode: 400,
                body: {
                    message: "Model validation error!",
                    error: dataResult.error
                }
            }
            return data
        }

        source = dataResult.data
        data.state.private.dataSource = dataResult.data
        data.state.private.dataType = DataType.Enum.PRODUCT

    } else if (dataTypeResult.data === DataType.Enum.PRODUCT_MODEL) {
        const dataResult = ProductModel.safeParse({
            ...data.state.private.dataSource,
            categories: data.request.body.data.categories,
            attributes: data.request.body.data.attributes,
        })
        if (dataResult.success === false) {
            data.response = {
                statusCode: 400,
                body: {
                    message: "Model validation error!",
                    error: dataResult.error
                }
            }
            return data
        }

        source = dataResult.data
        data.state.private.dataSource = dataResult.data
        data.state.private.dataType = DataType.Enum.PRODUCT_MODEL

    } else {
        throw new Error("Invalid data type!")
    }

    await validateProductAttributes(source.family, source.attributes, getProductsSettingsResult.body.productSettings)

    await validateProductUniqueAttributes(source.attributes, getProductsSettingsResult.body.productSettings.attributes, accountId)

    const removedImages = getProductRemovedImages(source.attributes, data.state.private.dataSource.attributes, getProductsSettingsResult.body.productSettings.attributes)

    //remove images
    const removeImageWorkers = []
    removedImages.forEach(ri => {
        removeImageWorkers.push(rdk.deleteFile({filename: ri}))
    })
    await Promise.all(removeImageWorkers)

    for (const attribute of source.attributes) {
        const attributeProperty = getProductsSettingsResult.body.productSettings.attributes.find(ap => ap.code === attribute.code)

        if (attributeProperty.type === AttributeTypes.Enum.IMAGE) {
            const attachedImages = attribute.data.filter(d => d.value !== undefined).map(d => {
                return d.value
            })

            //activate images
            attachedImages.forEach(ai => {
                data.state.private.tempImages = data.state.private.tempImages.filter(ti => ti !== ai)
                if (!data.state.private.savedImages) data.state.private.savedImages = []
                data.state.private.savedImages.push(ai)
            })
        }

        if (attributeProperty.isUnique && attribute.data && attribute.data.length && attribute.data[0].value) {
            await rdk.writeToDatabase({
                data: {}, ...getProductAttributeKeyMap({
                    accountId,
                    attributeCode: attribute.code,
                    attributeValue: attribute.data[0].value
                })
            })
        }
    }

    data.state.private.updateToken = randomString()
    data.state.private.updatedAt = new Date().toISOString()

    await sendToElastic({
        instanceId: data.context.instanceId,
        method: ElasticProductHandlerMethod.Update,
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

    await sendToElastic({
        instanceId: data.context.instanceId,
        method: ElasticProductHandlerMethod.Delete
    })
    return data
}

async function sendToElastic(props: {
    instanceId: string,
    source?: {
        parent?: string,
        dataType: DataType,
        data: Product | ProductModel, meta: { createdAt: string, updatedAt: string }
    },
    method: ElasticProductHandlerMethod
}) {
    try {
        await new InternalDestination(props.instanceId.split("-").shift()).productHandler({
            productInstanceId: props.instanceId,
            method: props.method,
            source: props.source,
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

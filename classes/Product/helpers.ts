import {ProductData} from "./index";
import {getProductAttributeKeyMap} from "./keysets";
import {GetProductsSettingsResult} from "./classes-repository";
import RDK from "@retter/rdk";
import {AttributeTypes, BaseAttribute, DataType, Product, ProductAttribute, ProductModel} from "PIMModelsPackage";
import * as queryString from "querystring";
import {Classes} from "./rio";
import {PIMMiddlewarePackage} from "PIMMiddlewarePackage";

const middleware = new PIMMiddlewarePackage()

const rdk = new RDK();


export function getProductClassAccountId(data: ProductData) {
    return data.context.instanceId.split("-").shift()
}

export function getImageFileName(accountId: string, imageId: string, extension: string) {
    return `${accountId}-${imageId}.${extension}`
}

export function getImageURL(props: { projectId: string, accountId: string, imageName: string }) {
    return `https://${props.projectId}.api.retter.io/${props.projectId}/CALL/API/getImage/${props.accountId}?` + queryString.stringify({filename: props.imageName})
}

export function randomString(l = 10) {
    const chars = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuopasdfghjklizxcvbnm0987654321"
    let result = ''
    for (let i = 0; i < l; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}


export function checkUpdateToken(data: ProductData) {
    if (data.context.identity !== "API" && data.state.private.updateToken !== data.request.body.updateToken) {
        throw new Error("Invalid update token. Please, refresh your page and try again!")
    }
}

export async function finalizeProductOperation(data: ProductData, requestAttributes: ProductAttribute[] = [], productSettings: GetProductsSettingsResult) {
    const attachedImages = await attachUploadedProductImages(requestAttributes, productSettings)
    for (const attachedImage of attachedImages) {
        data.state.private.tempImages = data.state.private.tempImages.filter(ti => ti !== attachedImage)
        if (!data.state.private.savedImages.includes(attachedImage)) {
            data.state.private.savedImages.push(attachedImage)
        }
    }

    const removedImages = getProductRemovedImages(requestAttributes, (data.state.private.dataSource?.attributes || []), productSettings.attributes)
    if (removedImages.length) {
        //remove images
        const removeImageWorkers = []
        removedImages.forEach(ri => {
            removeImageWorkers.push(rdk.deleteFile({filename: ri}))
        })
        await Promise.all(removeImageWorkers)
    }

    for (const requestAttribute of requestAttributes) {
        const attributeProperty = productSettings.attributes.find(a => a.code === requestAttribute.code)
        //save unique attributes to db
        if (attributeProperty.isUnique && requestAttribute.data && requestAttribute.data.length && requestAttribute.data[0].value) {
            await rdk.writeToDatabase({
                data: {}, ...getProductAttributeKeyMap({
                    accountId: getProductClassAccountId(data),
                    attributeCode: requestAttribute.code,
                    attributeValue: requestAttribute.data[0].value
                })
            })
        }
    }
}

export async function attachUploadedProductImages(requestProductAttributes: ProductAttribute[], productSettings: GetProductsSettingsResult):
    Promise<string[]> {
    const attachedImages: string[] = []
    for (const attribute of requestProductAttributes) {
        const attributeProperty = productSettings.attributes.find(ap => ap.code === attribute.code)
        if (attributeProperty.type === AttributeTypes.Enum.IMAGE) {
            const image = attribute.data.find(d => d.value !== undefined)?.value
            if (image) attachedImages.push(image)
        }
    }
    return attachedImages
}


export function getProductRemovedImages(requestAttributes: ProductAttribute[], stateAttributes: ProductAttribute[], attributeProperties: BaseAttribute[]) {
    const removedImages: string[] = []
    for (const stateAttribute of stateAttributes) {
        const attributeProperty = attributeProperties.find(ap => ap.code === stateAttribute.code)
        if (attributeProperty && attributeProperty.type === AttributeTypes.Enum.IMAGE) {
            if (attributeProperty.scopable && attributeProperty.localizable) {
                stateAttribute.data.forEach(stateData => {
                    requestAttributes.find(ra => ra.code === stateAttribute.code)?.data.forEach(requestData => {
                        if (requestData.scope === stateData.scope && requestData.locale === stateData.locale && stateData.value && !requestData.value) removedImages.push(stateData.value)
                    })
                })
            } else if (attributeProperty.scopable && !attributeProperty.localizable) {
                stateAttribute.data.forEach(stateData => {
                    requestAttributes.find(ra => ra.code === stateAttribute.code)?.data.forEach(requestData => {
                        if (requestData.scope === stateData.scope && stateData.value && !requestData.value) removedImages.push(stateData.value)
                    })
                })
            } else if (!attributeProperty.scopable && attributeProperty.localizable) {
                stateAttribute.data.forEach(stateData => {
                    requestAttributes.find(ra => ra.code === stateAttribute.code)?.data.forEach(requestData => {
                        if (requestData.locale === stateData.locale && stateData.value && !requestData.value) removedImages.push(stateData.value)
                    })
                })
            } else {
                stateAttribute.data.forEach(stateData => {
                    requestAttributes.find(ra => ra.code === stateAttribute.code)?.data.forEach(requestData => {
                        if (stateData.locale === undefined && stateData.scope === undefined && stateData.value && !requestData.value) removedImages.push(stateData.value)
                    })
                })
            }
        }
    }
    return removedImages
}

export function getAttributeAsLabelValue(product: Product, productSettings: GetProductsSettingsResult): string | undefined {
    const familySettings = productSettings.families.find(f => f.code === product.family)
    if (familySettings) {
        const attr = product.attributes.find(attr => attr.code === familySettings.attributeAsLabel)
        if (attr && attr.data && attr.data.length) {
            const definedAttValue = attr.data.find(d => d.value !== undefined && d.value !== "")
            if (definedAttValue) return definedAttValue.value
        }
    }
    return undefined
}


export function manipulateRequestProductAttributes(product: Product | ProductModel, productSettings: GetProductsSettingsResult, data: ProductData) {
    if (product.attributes && product.attributes.length) {
        for (let i = 0; i < product.attributes.length; i++) {
            const attributeProperty = productSettings.attributes.find(ap => ap.code === product.attributes[i].code)
            if (attributeProperty) {
                switch (attributeProperty.type) {
                    case AttributeTypes.Enum.IMAGE:
                        for (let j = 0; j < product.attributes[i].data.length; j++) {
                            if (product.attributes[i].data[j].value) {
                                product.attributes[i].data[j].meta = {
                                    url: getImageURL({
                                        projectId: data.context.projectId,
                                        accountId: getProductClassAccountId(data),
                                        imageName: product.attributes[i].data[j].value
                                    })
                                }
                            }
                        }
                        break
                }
            }
        }
    }
}


export async function deleteProductClassInstanceCheck(data: ProductData) {
    if (!["AccountManager", "API", "Product"].includes(data.context.identity)) {
        await middleware.checkUserRole({
            accountId: getProductClassAccountId(data),
            userId: data.context.userId,
            identity: data.context.identity
        })
    }

    if (data.state.private.dataType === DataType.Enum.PRODUCT_MODEL) {
        const result = await new Classes.API(data.context.instanceId).getProducts({
            pageSize: 1,
            filters: {parent: (data.state.private.dataSource as ProductModel).code}
        })
        if (!result || !result.body || result.body.totalProducts === undefined || result.body.totalProducts > 0) {
            throw new Error("You can not delete! This product model have a product(s).")
        }
    }
}

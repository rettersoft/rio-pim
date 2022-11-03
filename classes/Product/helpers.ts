import {ProductData} from "./index";
import {getProductAttributeKeyMap} from "./keysets";
import {GetProductsSettingsResult} from "./classes-repository";
import RDK from "@retter/rdk";
import {AttributeTypes, BaseAttribute, Product, ProductAttribute} from "PIMModelsPackage";

const rdk = new RDK();


export function getProductClassAccountId(data: ProductData) {
    return data.context.instanceId.split("-").shift()
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

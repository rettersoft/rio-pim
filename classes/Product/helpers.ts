import {ProductData} from "./index";
import {getProductAttributeKeyMap} from "./keysets";
import RDK from "@retter/rdk";
import {
    AttributeTypes,
    BaseAttribute,
    BOOLEAN,
    DataType,
    Family,
    GetCatalogSettingsResult,
    GetProductsSettingsResult,
    PIMRepository,
    Product,
    ProductAttribute,
    ProductModel
} from "PIMModelsPackage";
import {Classes} from "./rio";
import {PIMMiddlewarePackage} from "PIMMiddlewarePackage";
import * as querystring from "querystring";
import _ from "lodash";

const middleware = new PIMMiddlewarePackage()

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
    if (!["API", "Import"].includes(data.context.identity) && data.state.private.updateToken !== data.request.body.updateToken) {
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
        for (const chunkElement of _.chunk(removedImages, 10)) {
            const pipeline = rdk.pipeline()
            chunkElement.forEach(ri => {
                pipeline.deleteFile({filename: ri})
            })
            await pipeline.send()
        }
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
        if ([AttributeTypes.Enum.IMAGE, AttributeTypes.Enum.IMAGE_LIST].includes(attributeProperty.type)) {
            const image = attribute.data.find(d => d.value !== undefined)?.value
            if (Array.isArray(image)) {
                image.forEach(i => attachedImages.push(i))
            } else {
                if (image) attachedImages.push(image)
            }
        }
    }
    return attachedImages
}


export function getProductRemovedImages(requestAttributes: ProductAttribute[], stateAttributes: ProductAttribute[], attributeProperties: BaseAttribute[]) {
    const removedImages: string[] = []
    for (const stateAttribute of stateAttributes) {
        const attributeProperty = attributeProperties.find(ap => ap.code === stateAttribute.code)
        if (attributeProperty && [AttributeTypes.Enum.IMAGE, AttributeTypes.Enum.IMAGE_LIST].includes(attributeProperty.type)) {
            if (attributeProperty.scopable && attributeProperty.localizable) {
                stateAttribute.data.forEach(stateData => {
                    requestAttributes.find(ra => ra.code === stateAttribute.code)?.data.forEach(requestData => {
                        if (requestData.scope === stateData.scope && requestData.locale === stateData.locale && stateData.value && !requestData.value) {
                            if (Array.isArray(stateData.value)) {
                                stateData.value.forEach(v => removedImages.push(v))
                            } else {
                                removedImages.push(stateData.value)
                            }
                        }
                    })
                })
            } else if (attributeProperty.scopable && !attributeProperty.localizable) {
                stateAttribute.data.forEach(stateData => {
                    requestAttributes.find(ra => ra.code === stateAttribute.code)?.data.forEach(requestData => {
                        if (requestData.scope === stateData.scope && stateData.value && !requestData.value) {
                            if (Array.isArray(stateData.value)) {
                                stateData.value.forEach(v => removedImages.push(v))
                            } else {
                                removedImages.push(stateData.value)
                            }
                        }
                    })
                })
            } else if (!attributeProperty.scopable && attributeProperty.localizable) {
                stateAttribute.data.forEach(stateData => {
                    requestAttributes.find(ra => ra.code === stateAttribute.code)?.data.forEach(requestData => {
                        if (requestData.locale === stateData.locale && stateData.value && !requestData.value) {
                            if (Array.isArray(stateData.value)) {
                                stateData.value.forEach(v => removedImages.push(v))
                            } else {
                                removedImages.push(stateData.value)
                            }
                        }
                    })
                })
            } else {
                stateAttribute.data.forEach(stateData => {
                    requestAttributes.find(ra => ra.code === stateAttribute.code)?.data.forEach(requestData => {
                        if (stateData.locale === undefined && stateData.scope === undefined && stateData.value && !requestData.value) {
                            if (Array.isArray(stateData.value)) {
                                stateData.value.forEach(v => removedImages.push(v))
                            } else {
                                removedImages.push(stateData.value)
                            }
                        }
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


export function manipulateRequestProductAttributes(data: ProductData, product: Product | ProductModel, productSettings: GetProductsSettingsResult, catalogSettings: GetCatalogSettingsResult) {
    if (product.attributes && product.attributes.length) {
        for (let i = 0; i < product.attributes.length; i++) {
            const attributeProperty = productSettings.attributes.find(ap => ap.code === product.attributes[i].code)
            if (attributeProperty) {
                switch (attributeProperty.type) {
                    case AttributeTypes.Enum.IMAGE:
                        for (let j = 0; j < product.attributes[i].data.length; j++) {
                            if (product.attributes[i].data[j].value) {
                                product.attributes[i].data[j].meta = {
                                    url: PIMRepository.getImageBaseURL(data.context.projectId, getProductClassAccountId(data)) + "?" + querystring.stringify({filename: product.attributes[i].data[j].value})
                                }
                            }
                        }
                        break
                    case AttributeTypes.Enum.IMAGE_LIST:
                        for (let j = 0; j < product.attributes[i].data.length; j++) {
                            if (product.attributes[i].data[j].value) {
                                product.attributes[i].data[j].meta = {
                                    baseUrl: PIMRepository.getImageBaseURL(data.context.projectId, getProductClassAccountId(data))
                                }
                            }
                        }
                        break
                }
            }
        }
    }

    // fill default BOOLEANS
    const productFamilyAttributes = productSettings.families.find(family => family.code === product.family)?.attributes || []
    productSettings.attributes.filter(a => a.type === AttributeTypes.Enum.BOOLEAN && (a as BOOLEAN).defaultValue !== undefined &&
        productFamilyAttributes.find(pfa => pfa.attribute === a.code)).forEach(attributeProperty => {
        const aIndex = (product.attributes || []).findIndex(a => a.code === attributeProperty.code)
        if (aIndex === -1) {
            const defaultValue = (attributeProperty as BOOLEAN).defaultValue
            const productAttribute: ProductAttribute = {
                code: attributeProperty.code,
                data: []
            }
            if (attributeProperty.scopable && attributeProperty.localizable) {
                if (attributeProperty.isLocaleSpecific) {
                    catalogSettings.channels.forEach(channel => {
                        attributeProperty.availableLocales.forEach(locale => {
                            if (channel.locales.includes(locale)) {
                                productAttribute.data.push({locale, scope: channel.code, value: defaultValue})
                            }
                        })
                    })
                } else {
                    catalogSettings.channels.forEach(channel => {
                        channel.locales.forEach(locale => {
                            if (channel.locales.includes(locale)) {
                                productAttribute.data.push({locale, scope: channel.code, value: defaultValue})
                            }
                        })
                    })
                }
            } else if (attributeProperty.scopable && !attributeProperty.localizable) {
                catalogSettings.channels.forEach(channel => {
                    productAttribute.data.push({scope: channel.code, value: defaultValue})
                })
            } else if (!attributeProperty.scopable && attributeProperty.localizable) {
                catalogSettings.enabledLocales.forEach(locale => {
                    productAttribute.data.push({locale, value: defaultValue})
                })
            } else {
                productAttribute.data.push({value: defaultValue})
            }
            if (!product.attributes) {
                product.attributes = [productAttribute]
            } else {
                product.attributes.push(productAttribute)
            }
        }
    })
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

export async function getProductParentAttributes(dataType: DataType, parent: string, accountId: string): Promise<ProductAttribute[]> {
    if (dataType === DataType.Enum.PRODUCT && parent) {
        const parentData = await new Classes.Product(accountId + "-" + parent).getProduct()
        if (parentData.statusCode >= 200 && parentData.statusCode < 300 && parentData.body && parentData.body.data && parentData.body.data.attributes && parentData.body.data.attributes.length) {
            return parentData.body.data.attributes
        }

    }
    return []
}


export function findAttributeAsLabel(family: Family, product: Product | ProductModel) {
    let attributeAsLabel = product.sku || product.code
    const d = (product.attributes || []).find(pa => pa.code === family.attributeAsLabel)
    if (d) {
        attributeAsLabel = d.data.find(dat => dat.value !== undefined && typeof dat.value === "string" && dat.value !== "")
    }

    return attributeAsLabel || ""
}

import {AttributeTypes, BaseAttribute, ProductAttribute} from "./models";
import {ProductData} from "./index";


export function randomString(l = 10) {
    const chars = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuopasdfghjklizxcvbnm0987654321"
    let result = ''
    for (let i = 0; i < l; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}


export function checkUpdateToken(data: ProductData) {
    if (data.state.private.updateToken !== data.request.body.updateToken) {
        throw new Error("Invalid update token. Please, refresh your page and try again!")
    }
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

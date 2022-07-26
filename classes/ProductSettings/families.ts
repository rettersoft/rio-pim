import {ProductSettingsData} from "./index";
import {checkUpdateToken, randomString, sendEvent} from "./helpers";
import {getAttribute, isAxisAttribute, isFamilyAttributeLabel,} from "./attributes.repository";
import {ALLOWED_AXE_TYPES} from "./families.repository";
import {Classes, WebhookEventOperation, WebhookEventType} from "./rio";
import {
    Code,
    Codes,
    Families,
    Family,
    FamilyVariant,
    RESERVED_ID_ATTRIBUTE_CODE, UpsertFamilyVariantsInput
} from "PIMModelsPackage";
import API = Classes.API;


export async function createFamily(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = Family.safeParse(data.request.body.family)

    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: result.error
            }
        }
        return data
    }

    result.data.attributes = [{
        attribute: RESERVED_ID_ATTRIBUTE_CODE,
        requiredChannels: []
    }]

    if (data.state.public.families.findIndex(f => f.code === result.data.code) !== -1) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Family already exists!"
            }
        }
        return data
    }

    data.state.public.families.push(result.data)
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: data.context.instanceId + "-" + result.data.code,
        eventOperation: WebhookEventOperation.Create,
        eventType: WebhookEventType.Family
    })

    return data
}

export async function updateFamily(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = Family.safeParse(data.request.body.family)

    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: result.error
            }
        }
        return data
    }

    const fIndex = data.state.public.families.findIndex(f => f.code === result.data.code)
    if (fIndex === -1) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Family not found!"
            }
        }
        return data
    }

    data.state.public.families[fIndex].label = result.data.label
    data.state.public.families[fIndex].attributeAsLabel = result.data.attributeAsLabel
    data.state.public.families[fIndex].attributeAsImage = result.data.attributeAsImage

    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: data.context.instanceId + "-" + result.data.code,
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.Family
    })

    return data
}

export async function upsertFamilies(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)
    const result = Families.safeParse(data.request.body.families)

    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: result.error
            }
        }
        return data
    }

    for (const family of result.data) {
        if (!family.attributes) family.attributes = [{attribute: RESERVED_ID_ATTRIBUTE_CODE, requiredChannels: []}]
        else family.attributes = [{
            attribute: RESERVED_ID_ATTRIBUTE_CODE,
            requiredChannels: []
        }, ...family.attributes.filter(fa => fa.attribute !== RESERVED_ID_ATTRIBUTE_CODE)]

        if (family.attributeAsLabel && (family.attributes || []).findIndex(fa => fa.attribute === family.attributeAsLabel) === -1) {
            data.response = {
                statusCode: 400,
                body: {
                    message: `Attribute as label not found in family attributes! Attribute: (${family.attributeAsLabel}) Family: ${family.code}`,
                }
            }
            return data
        }

        const oldIndex = data.state.public.families.findIndex(f => f.code === family.code)
        if (oldIndex === -1) {
            data.state.public.families.push(family)
        } else {
            // don't update variants
            data.state.public.families[oldIndex].label = family.label
            data.state.public.families[oldIndex].attributes = family.attributes
            data.state.public.families[oldIndex].attributeAsImage = family.attributeAsImage
            data.state.public.families[oldIndex].attributeAsLabel = family.attributeAsLabel
        }
    }


    data.state.public.updateToken = randomString()


    return data
}

export async function upsertFamilyVariants(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)
    const result = UpsertFamilyVariantsInput.safeParse(data.request.body)
    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: result.error
            }
        }
        return data
    }

    for (const variant of result.data.variants) {
        const familyIndex = data.state.public.families.findIndex(f=>f.code === variant.familyCode)
        if(familyIndex !== -1){
            for (const familyVariant of variant.variants) {
                const oldIndex = data.state.public.families[familyIndex].variants.findIndex(v => v.code === familyVariant.code)
                if (oldIndex === -1) {
                    data.state.public.families[familyIndex].variants.push(familyVariant)
                } else {
                    data.state.public.families[familyIndex].variants[oldIndex] = familyVariant
                }
            }
        }
    }

    data.state.public.updateToken = randomString()

    return data
}

export async function deleteFamily(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = Code.safeParse(data.request.body.code)
    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: result.error
            }
        }
        return data
    }

    const api = await API.getInstance({instanceId: data.context.instanceId})
    const response = await api.getProducts({pageSize: 1, filters: {family: result.data}})

    if (response.body.totalProducts > 0) {
        data.response = {
            statusCode: 400,
            body: {
                message: "You can not delete! This family have a product."
            }
        }
        return data
    }

    data.state.public.families = data.state.public.families.filter(f => f.code !== result.data)
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocumentId: data.context.instanceId + "-" + result.data,
        eventOperation: WebhookEventOperation.Delete,
        eventType: WebhookEventType.Family
    })

    return data
}

export async function addAttributesToFamily(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const attributeCodesResult = Codes.safeParse(data.request.body.attributeCodes)
    const familyCodeResult = Code.safeParse(data.request.body.familyCode)

    if (attributeCodesResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: attributeCodesResult.error
            }
        }
        return data
    }

    if (familyCodeResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: familyCodeResult.error
            }
        }
        return data
    }

    const familyIndex = data.state.public.families.findIndex(f => f.code === familyCodeResult.data)
    if (familyIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Family not found!"
            }
        }
        return data
    }

    for (const attributeCode of attributeCodesResult.data) {
        if (data.state.public.attributes.findIndex(a => a.code === attributeCode) === -1) {
            data.response = {
                statusCode: 404,
                body: {
                    message: `"Attribute not found!" (${attributeCode})`
                }
            }
            return data
        }
        if (data.state.public.families[familyIndex].attributes.findIndex(fa => fa.attribute === attributeCode) !== -1) {
            data.response = {
                statusCode: 400,
                body: {
                    message: `"Attribute already exist!" (${attributeCode})`
                }
            }
            return data
        }
        data.state.public.families[familyIndex].attributes.push({
            attribute: attributeCode,
            requiredChannels: []
        })
    }

    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: data.state.public.families[familyIndex],
        eventDocumentId: data.context.instanceId + "-" + data.state.public.families[familyIndex].code,
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.Family
    })

    return data
}

export async function removeAttributesFromFamily(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const attributeCodesResult = Codes.safeParse(data.request.body.attributeCodes)
    const familyCodeResult = Code.safeParse(data.request.body.familyCode)

    if (attributeCodesResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: attributeCodesResult.error
            }
        }
        return data
    }

    if (familyCodeResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: familyCodeResult.error
            }
        }
        return data
    }

    const familyIndex = data.state.public.families.findIndex(f => f.code === familyCodeResult.data)
    if (familyIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Family not found!"
            }
        }
        return data
    }

    for (const attributeCode of attributeCodesResult.data) {
        if (data.state.public.attributes.findIndex(a => a.code === attributeCode) === -1) {
            data.response = {
                statusCode: 404,
                body: {
                    message: `"Attribute not found!" (${attributeCode})`
                }
            }
            return data
        }

        if (isAxisAttribute(attributeCode, data)) {
            data.response = {
                statusCode: 400,
                body: {
                    message: `This attribute used as a variant axis in a family variant! (${attributeCode})`
                }
            }
            return data
        }

        if (isFamilyAttributeLabel(attributeCode, data)) {
            data.response = {
                statusCode: 400,
                body: {
                    message: `This attribute used as label! (${attributeCode})`
                }
            }
            return data
        }

        data.state.public.families[familyIndex].attributes = data.state.public.families[familyIndex].attributes.filter(a => a.attribute !== attributeCode)
    }

    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: data.state.public.families[familyIndex],
        eventDocumentId: data.context.instanceId + "-" + data.state.public.families[familyIndex].code,
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.Family
    })

    return data
}

export async function toggleRequiredStatusFamilyAttribute(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const attributeCodeResult = Code.safeParse(data.request.body.attributeCode)
    const familyCodeResult = Code.safeParse(data.request.body.familyCode)
    const channelCodeResult = Code.safeParse(data.request.body.channelCode)

    if (attributeCodeResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: attributeCodeResult.error
            }
        }
        return data
    }

    if (familyCodeResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: familyCodeResult.error
            }
        }
        return data
    }

    if (channelCodeResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: channelCodeResult.error
            }
        }
        return data
    }
    const familyIndex = data.state.public.families.findIndex(f => f.code === familyCodeResult.data)
    if (familyIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Family not found!"
            }
        }
        return data
    }

    const familyAttributeIndex = data.state.public.families[familyIndex].attributes.findIndex(a => a.attribute === attributeCodeResult.data)
    if (familyAttributeIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Attribute is not member of this family!"
            }
        }
        return data
    }

    const attributeProperty = data.state.public.attributes.find(a => a.code === attributeCodeResult.data)
    if (!attributeProperty) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Attribute property not found!"
            }
        }
        return data
    }

    if (!attributeProperty.scopable) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Only scopable attributes can be required per channel!"
            }
        }
        return data
    }

    if (data.state.public.families[familyIndex].attributes[familyAttributeIndex].requiredChannels.includes(channelCodeResult.data)) {
        data.state.public.families[familyIndex].attributes[familyAttributeIndex].requiredChannels =
            data.state.public.families[familyIndex].attributes[familyAttributeIndex].requiredChannels.filter(rc => rc !== channelCodeResult.data)
    } else {
        data.state.public.families[familyIndex].attributes[familyAttributeIndex].requiredChannels.push(channelCodeResult.data)
    }
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: data.state.public.families[familyIndex],
        eventDocumentId: data.context.instanceId + "-" + data.state.public.families[familyIndex].code,
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.Family
    })

    return data
}

export async function addVariant(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const familyCodeResult = Code.safeParse(data.request.body.familyCode)

    if (familyCodeResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: familyCodeResult.error
            }
        }
        return data
    }

    const result = FamilyVariant.safeParse(data.request.body.variant)
    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: result.error
            }
        }
        return data
    }

    for (const axe of result.data.axes) {
        const attribute = getAttribute(axe, data)
        if (!ALLOWED_AXE_TYPES.includes(attribute.type)) {
            throw new Error("Not allowed attribute type!")
        }
    }

    const fIndex = data.state.public.families.findIndex(f => f.code === familyCodeResult.data)

    if (fIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Family not found!"
            }
        }
        return data
    }

    const fvIndex = data.state.public.families[fIndex].variants.findIndex(fv => fv.code === result.data.code)
    if (fvIndex !== -1) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Family variant already exits!"
            }
        }
        return data
    }

    data.state.public.families[fIndex].variants.push(result.data)
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: data.state.public.families[fIndex],
        eventDocumentId: data.context.instanceId + "-" + data.state.public.families[fIndex].code,
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.Family
    })

    return data
}

export async function deleteVariant(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const familyVariantCodeResult = Code.safeParse(data.request.body.familyVariantCode)
    const familyCodeResult = Code.safeParse(data.request.body.familyCode)

    if (familyVariantCodeResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: familyVariantCodeResult.error
            }
        }
        return data
    }

    if (familyCodeResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: familyCodeResult.error
            }
        }
        return data
    }

    const familyIndex = data.state.public.families.findIndex(f => f.code === familyCodeResult.data)
    if (familyIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Family not found!"
            }
        }
        return data
    }

    const api = await API.getInstance({instanceId: data.context.instanceId})
    const response = await api.getProducts({
        pageSize: 1,
        filters: {family: familyCodeResult.data, variant: familyVariantCodeResult.data}
    })

    if (response.body.totalProducts > 0) {
        data.response = {
            statusCode: 400,
            body: {
                message: "You can not delete! This family variant have a product."
            }
        }
        return data
    }

    if (data.state.public.families[familyIndex].variants.findIndex(a => a.code === familyVariantCodeResult.data) !== -1) {
        data.state.public.families[familyIndex].variants = data.state.public.families[familyIndex].variants
            .filter(fv => fv.code !== familyVariantCodeResult.data)
        data.state.public.updateToken = randomString()
    }

    await sendEvent(data.context.instanceId, {
        eventDocument: data.state.public.families[familyIndex],
        eventDocumentId: data.context.instanceId + "-" + data.state.public.families[familyIndex].code,
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.Family
    })

    return data
}

export async function updateVariant(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)
    const familyCodeResult = Code.safeParse(data.request.body.familyCode)

    if (familyCodeResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: familyCodeResult.error
            }
        }
        return data
    }

    const result = FamilyVariant.safeParse(data.request.body.variant)
    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation fail!",
                error: result.error
            }
        }
        return data
    }

    for (const axe of result.data.axes) {
        const attribute = getAttribute(axe, data)
        if (!ALLOWED_AXE_TYPES.includes(attribute.type)) {
            throw new Error("Not allowed attribute type!")
        }
    }

    const fIndex = data.state.public.families.findIndex(f => f.code === familyCodeResult.data)

    if (fIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Family not found!"
            }
        }
        return data
    }

    const fvIndex = data.state.public.families[fIndex].variants.findIndex(fv => fv.code === result.data.code)
    if (fvIndex === -1) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Family variant not found!"
            }
        }
        return data
    }

    // update specific fields
    data.state.public.families[fIndex].variants[fvIndex].attributes = result.data.attributes
    data.state.public.families[fIndex].variants[fvIndex].label = result.data.label

    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: data.state.public.families[fIndex],
        eventDocumentId: data.context.instanceId + "-" + data.state.public.families[fIndex].code,
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.Family
    })

    return data
}

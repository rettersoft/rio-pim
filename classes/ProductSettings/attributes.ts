import {ProductSettingsData} from "./index";
import {checkUpdateToken, randomString, sendEvent} from "./helpers";
import {
    checkReservedIdAttribute,
    getAttribute,
    isAxisAttribute,
    isFamilyAttributeLabel,
    specificAttributeValidation
} from "./attributes.repository";
import {WebhookEventOperation, WebhookEventType} from "./rio";
import {
    AttributeOptions,
    AttributeTypes,
    BaseAttribute,
    BaseAttributes,
    Code,
    Family,
    FamilyVariant,
    AttributeOptionItem,
    SpecificAttributes
} from "PIMModelsPackage";


export async function createAttribute(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const baseAttribute = BaseAttribute.safeParse(data.request.body.attribute)
    if (baseAttribute.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: baseAttribute.error
            }
        }
        return data
    }

    const result = SpecificAttributes[baseAttribute.data.type].safeParse(data.request.body.attribute)

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

    checkReservedIdAttribute(result.data.code)

    specificAttributeValidation(result.data)

    if (result.data.type === AttributeTypes.Enum.IDENTIFIER && data.state.public.attributes.findIndex(a => a.type === AttributeTypes.Enum.IDENTIFIER) !== -1) {
        data.response = {
            statusCode: 400,
            body: {
                message: "An identifier attribute already exists!"
            }
        }
        return data
    }

    if (data.state.public.attributes.findIndex(a => a.code === baseAttribute.data.code) !== -1) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Attribute already exist!"
            }
        }
        return data
    }

    const agIndex = data.state.public.attributeGroups.findIndex(ag => ag.code === baseAttribute.data.group)

    if (agIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Attribute group not found!"
            }
        }
        return data
    }

    data.state.public.attributes.push(result.data)
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: data.context.instanceId + "-" + result.data.code,
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.Attribute
    })

    return data
}

export async function updateAttribute(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const baseAttribute = BaseAttribute.safeParse(data.request.body.attribute)
    if (baseAttribute.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: baseAttribute.error
            }
        }
        return data
    }

    const result = SpecificAttributes[baseAttribute.data.type].safeParse(data.request.body.attribute)

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

    checkReservedIdAttribute(result.data.code)

    specificAttributeValidation(result.data)

    const aIndex = data.state.public.attributes.findIndex(a => a.code === baseAttribute.data.code)

    if (aIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Attribute not found!"
            }
        }
        return data
    }

    const attribute = data.state.public.attributes[aIndex]

    if (attribute.group !== result.data.group) {
        const agIndexNew = data.state.public.attributeGroups.findIndex(ag => ag.code === result.data.group)

        if (agIndexNew === -1) {
            data.response = {
                statusCode: 404,
                body: {
                    message: "Attribute group not found!"
                }
            }
            return data
        }
    }

    result.data.type = attribute.type // Dont change
    result.data.localizable = attribute.localizable // Dont change
    result.data.scopable = attribute.scopable // Dont change
    result.data.isUnique = attribute.isUnique // Dont change

    data.state.public.attributes[aIndex] = result.data
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: data.state.public.attributes[aIndex],
        eventDocumentId: data.context.instanceId + "-" + data.state.public.attributes[aIndex].code,
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.Attribute
    })

    return data
}

export async function upsertAttributes(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = BaseAttributes.safeParse(data.request.body.attributes)
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

    result.data.forEach(attribute => {
        const result = SpecificAttributes[attribute.type].safeParse(attribute)

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

        checkReservedIdAttribute(result.data.code)

        specificAttributeValidation(result.data)

        const oldIndex = data.state.public.attributes.findIndex(attr => attr.code === attribute.code)
        if (oldIndex === -1) {
            data.state.public.attributes.push(attribute)
        } else {
            data.state.public.attributes[oldIndex] = attribute
        }
    })

    data.state.public.updateToken = randomString()


    return data
}

export async function deleteAttribute(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const attributeCode = data.request.body.attributeCode

    if (!attributeCode) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid attribute code!"
            }
        }
        return data
    }

    checkReservedIdAttribute(attributeCode)

    if (isAxisAttribute(attributeCode, data)) {
        data.response = {
            statusCode: 400,
            body: {
                message: "This attribute used as a variant axis in a family variant!"
            }
        }
        return data
    }

    if (isFamilyAttributeLabel(attributeCode, data)) {
        data.response = {
            statusCode: 400,
            body: {
                message: "This attribute used as label!"
            }
        }
        return data
    }

    data.state.public.families = data.state.public.families = data.state.public.families.reduce<Family[]>((acc, val) => {
        val.attributes = val.attributes.filter(a => a.attribute !== attributeCode)
        val.variants = val.variants.reduce<FamilyVariant[]>((acc, varVal) => {
            varVal.attributes === varVal.attributes.filter(a => a !== attributeCode)
            acc.push(varVal)
            return acc
        }, [])
        acc.push(val)
        return acc
    }, [])

    data.state.public.attributes = data.state.public.attributes.filter(a => a.code !== attributeCode)
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocumentId: data.context.instanceId + "-" + attributeCode,
        eventOperation: WebhookEventOperation.Delete,
        eventType: WebhookEventType.Attribute
    })

    return data
}

export async function upsertSelectOption(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = AttributeOptionItem.safeParse(data.request.body.option)
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

    const attribute = getAttribute(data.request.body.attributeCode, data)

    if (![AttributeTypes.Enum.SIMPLESELECT, AttributeTypes.Enum.MULTISELECT].includes(attribute.type)) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid attribute type!"
            }
        }
        return data
    }

    const attributeOptionsIndex = data.state.public.attributeOptions.findIndex(ao => ao.code === attribute.code)

    let webhookOperation: WebhookEventOperation;

    if (attributeOptionsIndex === -1) {
        data.state.public.attributeOptions.push({
            code: attribute.code,
            options: [result.data]
        })
        webhookOperation = WebhookEventOperation.Create
    } else {
        const optionIndex = data.state.public.attributeOptions[attributeOptionsIndex].options.findIndex(o => o.code === result.data.code)
        if (optionIndex === -1) {
            data.state.public.attributeOptions[attributeOptionsIndex].options.push(result.data)
            webhookOperation = WebhookEventOperation.Create
        } else {
            data.state.public.attributeOptions[attributeOptionsIndex].options[optionIndex] = result.data
            webhookOperation = WebhookEventOperation.Update
        }
    }

    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: [data.context.instanceId, attribute.code, result.data.code].join("-"),
        eventOperation: webhookOperation,
        eventType: WebhookEventType.AttributeOption
    })

    return data
}

export async function upsertAttributeSelectOptions(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = AttributeOptions.safeParse(data.request.body.attributeOptions)
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

    for (const datum of result.data) {
        const attribute = getAttribute(datum.code, data)
        if (![AttributeTypes.Enum.SIMPLESELECT, AttributeTypes.Enum.MULTISELECT].includes(attribute.type)) {
            data.response = {
                statusCode: 400,
                body: {
                    message: "Invalid attribute type!"
                }
            }
            return data
        }

        const oldIndex = data.state.public.attributeOptions.findIndex(ao => ao.code === datum.code)
        if (oldIndex == -1) {
            data.state.public.attributeOptions.push(datum)
        } else {
            for (const option of datum.options) {
                const oldOptionIndex = data.state.public.attributeOptions[oldIndex].options.findIndex(o => o.code === option.code)
                if (oldOptionIndex === -1) {
                    data.state.public.attributeOptions[oldIndex].options.push(option)
                } else {
                    data.state.public.attributeOptions[oldIndex].options[oldOptionIndex] = option
                }
            }
        }
    }

    return data
}

export async function deleteSelectOption(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const attributeOptionCodeModel = Code.safeParse(data.request.body.attributeOptionCode)
    if (attributeOptionCodeModel.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: attributeOptionCodeModel.error
            }
        }
        return data
    }

    const attribute = getAttribute(data.request.body.attributeCode, data)

    if (![AttributeTypes.Enum.SIMPLESELECT, AttributeTypes.Enum.MULTISELECT].includes(attribute.type)) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid attribute type!"
            }
        }
        return data
    }

    const aoIndex = data.state.public.attributeOptions.findIndex(ao => ao.code === attribute.code)
    if (aoIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Attribute option not found!"
            }
        }
        return data
    }

    data.state.public.attributeOptions[aoIndex].options = data.state.public.attributeOptions[aoIndex].options.filter(o => o.code !== attributeOptionCodeModel.data)
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocumentId: [data.context.instanceId, attribute.code, attributeOptionCodeModel.data].join("-"),
        eventOperation: WebhookEventOperation.Delete,
        eventType: WebhookEventType.AttributeOption
    })

    return data
}

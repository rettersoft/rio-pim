import {ProductSettingsData} from "./index";
import {checkUpdateToken, randomString, sendEvent} from "./helpers";
import {checkReservedAttributeGroup} from "./attribute-groups.repository";
import {WebhookEventOperation, WebhookEventType} from "./rio";
import {AttributeGroup, AttributeGroups, BaseAttribute, Code, RESERVED_ATTRIBUTE_GROUP_CODE} from "PIMModelsPackage";


export async function addAttributeGroup(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = AttributeGroup.safeParse(data.request.body.attributeGroup)
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

    if (data.state.public.attributeGroups.findIndex(ag => ag.code === result.data.code) !== -1) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Attribute group already exist!"
            }
        }
        return data
    }

    data.state.public.attributeGroups.push(result.data)
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: [data.context.instanceId, result.data.code].join("-"),
        eventOperation: WebhookEventOperation.Create,
        eventType: WebhookEventType.AttributeGroup
    })

    return data
}

export async function updateAttributeGroup(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = AttributeGroup.safeParse(data.request.body.attributeGroup)
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

    checkReservedAttributeGroup(result.data.code)

    const agIndex = data.state.public.attributeGroups.findIndex(ag => ag.code === result.data.code)

    if (agIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Attribute group not found!"
            }
        }
        return data
    }

    data.state.public.attributeGroups[agIndex] = result.data
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: [data.context.instanceId, result.data.code].join("-"),
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.AttributeGroup
    })

    return data
}

export async function upsertAttributeGroups(data: ProductSettingsData): Promise<ProductSettingsData> {

    checkUpdateToken(data)

    const result = AttributeGroups.safeParse(data.request.body.attributeGroups)
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
        const agIndex = data.state.public.attributeGroups.findIndex(ag => ag.code === datum.code)
        if (agIndex === -1) {
            data.state.public.attributeGroups.push(datum)
        } else {
            data.state.public.attributeGroups[agIndex] = datum
        }
    }

    data.state.public.updateToken = randomString()

    return data
}

export async function deleteAttributeGroup(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const attributeGroupCodeModel = Code.safeParse(data.request.body.attributeGroupCode)

    if (attributeGroupCodeModel.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: attributeGroupCodeModel.error
            }
        }
        return data
    }

    checkReservedAttributeGroup(attributeGroupCodeModel.data)

    data.state.public.attributes = data.state.public.attributes.reduce<BaseAttribute[]>((acc, val) => {
        if (val.group === attributeGroupCodeModel.data) val.group = RESERVED_ATTRIBUTE_GROUP_CODE
        acc.push(val)
        return acc
    }, [])

    data.state.public.attributeGroups = data.state.public.attributeGroups.filter(ag => ag.code !== attributeGroupCodeModel.data)
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocumentId: [data.context.instanceId, attributeGroupCodeModel.data].join("-"),
        eventOperation: WebhookEventOperation.Delete,
        eventType: WebhookEventType.AttributeGroup
    })

    return data
}

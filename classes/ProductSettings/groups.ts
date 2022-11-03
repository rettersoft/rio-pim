import {ProductSettingsData} from "./index";
import {checkUpdateToken, randomString, sendEvent} from "./helpers";
import {WebhookEventOperation, WebhookEventType} from "./rio";
import {Code, Group, Groups, GroupType, GroupTypes} from "PIMModelsPackage";


export async function createGroupType(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = GroupType.safeParse(data.request.body.groupType)
    if (result.success === false) {
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
    }

    if (data.state.public.groupTypes.findIndex(gt => gt.code === result.data.code) !== -1) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Group type already exist!"
            }
        }
        return data
    }

    data.state.public.groupTypes.push(result.data)
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: data.context.instanceId + "-" + result.data.code,
        eventOperation: WebhookEventOperation.Create,
        eventType: WebhookEventType.GroupType
    })

    return data
}

export async function updateGroupType(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = GroupType.safeParse(data.request.body.groupType)
    if (result.success === false) {
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
    }

    const gtIndex = data.state.public.groupTypes.findIndex(gt => gt.code === result.data.code)
    if (gtIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Group type not found!"
            }
        }
        return data
    }

    data.state.public.groupTypes[gtIndex].label = result.data.label
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: data.context.instanceId + "-" + result.data.code,
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.GroupType
    })

    return data
}

export async function upsertGroupTypes(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = GroupTypes.safeParse(data.request.body.groupTypes)
    if (result.success === false) {
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
    }

    result.data.forEach(gt => {
        let oldGTIndex = data.state.public.groupTypes.findIndex(oldGT => oldGT.code === gt.code)
        if (oldGTIndex === -1) {
            data.state.public.groupTypes.push(gt)
        } else {
            data.state.public.groupTypes[oldGTIndex] = gt
        }
    })

    data.state.public.updateToken = randomString()
    return data
}

export async function deleteGroupType(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const groupTypeCodeResult = Code.safeParse(data.request.body.code)
    if (groupTypeCodeResult.success === false) {
        if (groupTypeCodeResult.success === false) {
            data.response = {
                statusCode: 400,
                body: {
                    message: "Model validation error!",
                    error: groupTypeCodeResult.error
                }
            }
            return data
        }
    }

    data.state.public.groupTypes = data.state.public.groupTypes.filter(gt => gt.code !== groupTypeCodeResult.data)
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocumentId: data.context.instanceId + "-" + groupTypeCodeResult.data,
        eventOperation: WebhookEventOperation.Delete,
        eventType: WebhookEventType.GroupType
    })

    return data
}

export async function createGroup(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = Group.safeParse(data.request.body.group)
    if (result.success === false) {
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
    }

    if (data.state.public.groups.findIndex(gt => gt.code === result.data.code) !== -1) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Group already exist!"
            }
        }
        return data
    }

    if (data.state.public.groupTypes.findIndex(gt => gt.code === result.data.type) === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Group type not found!"
            }
        }
        return data
    }

    data.state.public.groups.push(result.data)
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: data.context.instanceId + "-" + result.data.code,
        eventOperation: WebhookEventOperation.Create,
        eventType: WebhookEventType.Group
    })

    return data
}

export async function updateGroup(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = Group.safeParse(data.request.body.group)
    if (result.success === false) {
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
    }

    const gIndex = data.state.public.groups.findIndex(gt => gt.code === result.data.code)
    if (gIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Group not found!"
            }
        }
        return data
    }

    data.state.public.groups[gIndex].label = result.data.label
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: data.context.instanceId + "-" + result.data.code,
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.Group
    })

    return data
}

export async function upsertGroups(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = Groups.safeParse(data.request.body.groups)
    if (result.success === false) {
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
    }

    result.data.forEach(group => {
        const oldIndex = data.state.public.groups.findIndex(g => g.code == group.code)
        if (oldIndex === -1) {
            data.state.public.groups.push(group)
        } else {
            data.state.public.groups[oldIndex] = group
        }
    })

    data.state.public.updateToken = randomString()

    return data
}

export async function deleteGroup(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const groupCodeResult = Code.safeParse(data.request.body.code)
    if (groupCodeResult.success === false) {
        if (groupCodeResult.success === false) {
            data.response = {
                statusCode: 400,
                body: {
                    message: "Model validation error!",
                    error: groupCodeResult.error
                }
            }
            return data
        }
    }

    data.state.public.groups = data.state.public.groups.filter(gt => gt.code !== groupCodeResult.data)
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocumentId: data.context.instanceId + "-" + groupCodeResult.data,
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.Group
    })

    return data
}

export async function addProductToGroup(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    //TODO when product ready

    return data
}


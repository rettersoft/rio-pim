import {CatalogSettingsData} from "./index";
import {Channel} from "./models";
import {checkUpdateToken, randomString, sendEvent} from "./helpers";
import {WebhookEventOperation, WebhookEventType} from "./rio";


export async function upsertChannel(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    checkUpdateToken(data)

    const result = Channel.safeParse(data.request.body.channel)
    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: 'Model validation failed!',
                error: result.error
            }
        }
        return data
    }

    if(!data.state.public.channels) data.state.public.channels = []

    let eventOperation: WebhookEventOperation;

    const channelIndex = data.state.public.channels.findIndex(c => c.code === result.data.code)
    if (channelIndex === -1) {
        data.state.public.channels.push(result.data)
        eventOperation = WebhookEventOperation.Create
    } else {
        data.state.public.channels[channelIndex] = result.data
        eventOperation = WebhookEventOperation.Update
    }

    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: data.context.instanceId + "-" + result.data.code,
        eventOperation,
        eventType: WebhookEventType.Channel
    })

    data.state.public.updateToken = randomString()

    return data
}


export async function deleteChannel(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    checkUpdateToken(data)

    const channelCode = data.request.body.code

    if(!data.state.public.channels) data.state.public.channels = []

    const channelIndex = data.state.public.channels.findIndex(c => c.code === channelCode)
    if (channelIndex !== -1) {
        data.state.public.channels = data.state.public.channels.filter(c=>c.code !== channelCode)
    }
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocumentId: data.context.instanceId + "-" + channelCode,
        eventOperation: WebhookEventOperation.Delete,
        eventType: WebhookEventType.Channel
    })

    return data
}

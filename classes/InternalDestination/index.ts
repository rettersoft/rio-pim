import {Data, Response} from "@retter/rdk";
import {AccountIDInput, InternalDestinationEventHandlerInput} from "./rio";
import {Webhook} from "./models";
import {sendToElastic, sendWebhookEvent} from "./helpers";
import {v4 as uuidv4} from "uuid"


export interface InternalDestinationPrivateState {
    webhook: Webhook
}

export type InternalDestinationData<Input = any, Output = any> = Data<Input, Output, any, InternalDestinationPrivateState>

export async function authorizer(data: InternalDestinationData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"
    let canSendEvent = false

    if (["Product", "CatalogSettings", "ProductSettings"].includes(data.context.identity)) {
        if (data.context.identity === "Product" && data.context.userId.split("-").shift() === data.context.instanceId) {
            canSendEvent = true
        } else {
            canSendEvent = true
        }
    }

    if ([
        "getWebhook",
        "upsertWebhook"
    ].includes(data.context.methodName)) {
        return {statusCode: 200}
    }

    switch (data.context.methodName) {
        case 'eventHandler':
            if (canSendEvent) {
                return {statusCode: 200}
            }
            break
        case 'DESTROY':
            if(data.context.identity === "AccountManager"){
                return {statusCode: 200}
            }
            break
        case 'STATE':
            if (isDeveloper) return {statusCode: 200}
            break
        case 'GET':
            return {statusCode: 200}
        case 'INIT':
            if (data.context.identity === "AccountManager" || isDeveloper) {
                return {statusCode: 200}
            }
            break
    }
    return {statusCode: 401};
}

export async function getInstanceId(data: InternalDestinationData<AccountIDInput>): Promise<string> {
    return data.request.body.accountId
}

export async function init(data: InternalDestinationData): Promise<InternalDestinationData> {
    let webhook: Webhook = {
        apiKey: uuidv4().replace(new RegExp("-", "g"), ""),
        enabled: true,
    };
    data.state.private = {
        webhook
    }
    return data
}

export async function getState(data: InternalDestinationData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

export async function eventHandler(data: InternalDestinationData<InternalDestinationEventHandlerInput>): Promise<InternalDestinationData> {
    await Promise.all([
        sendWebhookEvent(data.state.private.webhook, data.request.body),
        sendToElastic(data.request.body, data.context.instanceId)
    ])
    return data
}

export async function upsertWebhook(data: InternalDestinationData): Promise<InternalDestinationData> {
    const webhookData = Webhook.safeParse(data.request.body.webhook)
    if (webhookData.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: 'Model validation failed!',
                error: webhookData.error
            }
        }
        return data
    }

    data.state.private.webhook = webhookData.data

    return data
}

export async function getWebhook(data: InternalDestinationData): Promise<InternalDestinationData> {
    data.response = {
        statusCode: 200,
        body: {
            webhook: data.state.private.webhook
        }
    }
    return data
}

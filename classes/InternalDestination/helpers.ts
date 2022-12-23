import axios from "axios";
import {InternalDestinationEventHandlerInput, WebhookEventOperation, WebhookEventType} from "./rio";
import {Client} from "@elastic/elasticsearch";
import {Env} from "./env";
import {Webhook} from "PIMModelsPackage";

const client = new Client({
    cloud: {
        id: Env.get("ELASTIC_CLOUD_ID")
    },
    auth: {
        username: Env.get("ELASTIC_CLOUD_USERNAME"),
        password: Env.get("ELASTIC_CLOUD_PASSWORD")
    }
})

const ELASTIC_INDEX_PREFIX = "search"

export async function sendWebhookEvent(webhook: Webhook, event: InternalDestinationEventHandlerInput) {
    try {
        if (!webhook.enabled) return false;

        let url = ""
        switch (event.eventType) {
            case WebhookEventType.ProductModel:
                url = webhook.handlers.productModel
                break
            case WebhookEventType.Product:
                url = webhook.handlers.product
                break
            case WebhookEventType.AttributeGroup:
                url = webhook.handlers.attributeGroup
                break
            case WebhookEventType.AttributeOption:
                url = webhook.handlers.attributeOption
                break
            case WebhookEventType.Attribute:
                url = webhook.handlers.attribute
                break
            case WebhookEventType.Category:
                url = webhook.handlers.category
                break
            case WebhookEventType.Channel:
                url = webhook.handlers.channel
                break
            case WebhookEventType.Currencies:
                url = webhook.handlers.currencies
                break
            case WebhookEventType.Family:
                url = webhook.handlers.family
                break
            case WebhookEventType.GroupType:
                url = webhook.handlers.groupType
                break
            case WebhookEventType.Group:
                url = webhook.handlers.group
                break
            case WebhookEventType.Locales:
                url = webhook.handlers.locales
                break
            default:
                console.warn("Invalid webhook event type!")
                return false
        }

        if (!url || url === "") {
            return false
        }

        const response = await axios({
            url,
            method: "post",
            headers: {
                "x-api-key": webhook.apiKey
            },
            data: event
        })

        console.log(JSON.stringify({
            status: response.status
        }))
    } catch (e) {
        console.warn(e)
    }
}

export async function sendToElastic(event: InternalDestinationEventHandlerInput, accountId: string) {
    try {
        if ([WebhookEventType.Product, WebhookEventType.ProductModel].includes(event.eventType)) {
            switch (event.eventOperation) {
                case WebhookEventOperation.Create:
                    if (!event.eventDocument) return false
                    await client.create({
                        index: ELASTIC_INDEX_PREFIX + "-" + accountId,
                        id: event.eventDocumentId,
                        document: event.eventDocument
                    })
                    break
                case WebhookEventOperation.Update:
                    if (!event.eventDocument) return false
                    await client.update({
                        index: ELASTIC_INDEX_PREFIX + "-" + accountId,
                        id: event.eventDocumentId,
                        doc: event.eventDocument,
                        doc_as_upsert: true
                    })
                    break
                case WebhookEventOperation.Delete:
                    await client.delete({
                        index: ELASTIC_INDEX_PREFIX + "-" + accountId,
                        id: event.eventDocumentId,
                    })
                    break
                default:
                    console.warn("Invalid handler method!")
                    return false
            }
        }
    } catch (e) {
        console.warn(e)
    }
}


export function randomString(l = 10) {
    const chars = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuopasdfghjklizxcvbnm0987654321"
    let result = ''
    for (let i = 0; i < l; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

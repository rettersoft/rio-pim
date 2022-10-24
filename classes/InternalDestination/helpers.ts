import {Webhook} from "./models";
import axios from "axios";
import {InternalDestinationEventHandlerInput, WebhookEventOperation, WebhookEventType} from "./rio";
import {Client} from "@elastic/elasticsearch";
import {Env} from "./env";

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
            case WebhookEventType.AttributeGroups:
                url = webhook.handlers.attributeGroups
                break
            case WebhookEventType.AttributeOptions:
                url = webhook.handlers.attributeOptions
                break
            case WebhookEventType.Attributes:
                url = webhook.handlers.attributes
                break
            case WebhookEventType.Categories:
                url = webhook.handlers.categories
                break
            case WebhookEventType.Channels:
                url = webhook.handlers.channels
                break
            case WebhookEventType.Currencies:
                url = webhook.handlers.currencies
                break
            case WebhookEventType.Families:
                url = webhook.handlers.families
                break
            case WebhookEventType.GroupTypes:
                url = webhook.handlers.groupTypes
                break
            case WebhookEventType.Groups:
                url = webhook.handlers.groups
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
                "x-pim-api-key": webhook.apiKey
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
                        doc: event.eventDocument
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

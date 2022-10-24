import {CatalogSettingsData} from "./index";
import {checkUpdateToken, randomString, sendEvent} from "./helpers";
import {Locales} from "./consts";
import {WebhookEventOperation, WebhookEventType} from "./rio";


export async function toggleLocale(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    checkUpdateToken(data)

    const localeId = data.request.body.localeId
    if (!localeId || !Locales.map(c => c.id).includes(localeId)) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid locale id!"
            }
        }
        return data
    }

    if(!data.state.public.enabledLocales) data.state.public.enabledLocales = []

    const isEnabled = data.state.public.enabledLocales.includes(localeId)

    if (isEnabled) {
        if (data.state.public.enabledLocales.length === 1) {
            data.response = {
                statusCode: 400,
                body: {
                    message: "Must have at least one locale"
                }
            }
            return data
        }
        data.state.public.enabledLocales = data.state.public.enabledLocales.filter(id => id !== localeId)
    } else {
        data.state.public.enabledLocales.push(localeId)
    }
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: data.state.public.enabledLocales,
        eventDocumentId: data.context.instanceId + "-" + "LOCALES",
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.Locales
    })

    return data
}

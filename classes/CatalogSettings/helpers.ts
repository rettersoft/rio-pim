import {CatalogSettingsData} from "./index";
import {Classes, InternalDestinationEventHandlerInput} from "./rio";


export function randomString(l = 10) {
    const chars = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuopasdfghjklizxcvbnm0987654321"
    let result = ''
    for (let i = 0; i < l; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}


export function checkUpdateToken(data: CatalogSettingsData) {
    if (data.state.public.updateToken !== data.request.body.updateToken) {
        throw new Error("Invalid update token. Please, refresh your page and try again!")
    }
}

export async function sendEvent(accountId: string, event: InternalDestinationEventHandlerInput){
    try{
        await Promise.all([
            new Classes.InternalDestination(accountId).webhookEventHandler(event),
            new Classes.InternalDestination(accountId).elasticEventHandler(event)
        ])
    }catch (e) {
        console.warn(e)
    }
}

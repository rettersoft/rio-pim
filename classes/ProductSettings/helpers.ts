import {ProductSettingsData} from "./index";
import {Classes, InternalDestinationEventHandlerInput} from "./rio";


export function randomString(l = 10) {
    const chars = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuopasdfghjklizxcvbnm0987654321"
    let result = ''
    for (let i = 0; i < l; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}


export function checkUpdateToken(data: ProductSettingsData) {
    if (!["API", "Import"].includes(data.context.identity) && data.state.private.updateToken !== data.request.body.updateToken) {
        throw new Error("Invalid update token. Please, refresh your page and try again!")
    }
}


export async function sendEvent(accountId: string, event: InternalDestinationEventHandlerInput){
    try{
        await (await Classes.InternalDestination.getInstance({instanceId: accountId})).eventHandler(event)
    }catch (e) {
        console.warn(e)
    }
}

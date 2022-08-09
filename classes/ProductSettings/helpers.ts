import {ProductSettingsData} from "./index";


export function randomString(l = 10) {
    const chars = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuopasdfghjklizxcvbnm0987654321"
    let result = ''
    for (let i = 0; i < l; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}


export function checkUpdateToken(data: ProductSettingsData) {
    if (data.state.public.updateToken !== data.request.body.updateToken) {
        throw new Error("Invalid update token. Please, refresh your page and try again!")
    }
}

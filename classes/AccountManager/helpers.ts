import {v4 as uuidv4} from "uuid"

export function randomString(l = 10) {
    const chars = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuopasdfghjklizxcvbnm0987654321"
    let result = ''
    for (let i = 0; i < l; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}


export function generateAccountId() {
    return uuidv4().replace(new RegExp("-", "g"), "")
}

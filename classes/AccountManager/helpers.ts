import {customAlphabet} from "nanoid";

export function randomString(l = 10) {
    const chars = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuopasdfghjklizxcvbnm0987654321"
    let result = ''
    for (let i = 0; i < l; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}


export function generateAccountId() {
    const alphabet = '346789abcdefghjkmnpqrtwxy';
    const nanoid = customAlphabet(alphabet, 14);
    return nanoid()
}

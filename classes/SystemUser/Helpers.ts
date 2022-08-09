import * as crypto from "crypto"
export class Helpers {
    static generateOtp(length = 6) {
        const characters = '0123456789';
        let result = '';
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }
}


export function md5(data: string) {
    return crypto.createHash('md5').update(data).digest().toString("hex")
}

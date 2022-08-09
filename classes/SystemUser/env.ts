export interface Envs {
    ACCESS_KEY_ID: string
    SECRET_ACCESS_KEY: string
    FROM_EMAIL_ADDRESS: string
    TEST_EMAIL_OTP: string
}

export class Env {
    static get(key: keyof Envs, defaultValue?: string) {
        const env = process.env[key] || defaultValue
        if (env === undefined)
            throw new Error('Environment not found')
        return env
    }

    static getOrUndefined(key: keyof Envs, defaultValue?: string) {
        const env = process.env[key] || defaultValue
        if (env === undefined)
            return undefined
        return env
    }
}

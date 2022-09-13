export interface Envs {
    INTERNAL_API_KEY: string
    TEMP_IMAGE_TTL_IN_SECONDS: string
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

export interface Envs {
    ELASTIC_CLOUD_ID: string
    ELASTIC_CLOUD_USERNAME: string
    ELASTIC_CLOUD_PASSWORD: string
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

import {CatalogSettingsData} from "./index";
import {Channel} from "./models";
import {checkUpdateToken, randomString} from "./helpers";


export async function upsertChannel(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    checkUpdateToken(data)

    const result = Channel.safeParse(data.request.body.channel)
    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: 'Model validation failed!',
                error: result.error
            }
        }
        return data
    }

    if(!data.state.public.channels) data.state.public.channels = []

    const channelIndex = data.state.public.channels.findIndex(c => c.code === result.data.code)
    if (channelIndex === -1) {
        data.state.public.channels.push(result.data)
    } else {
        data.state.public.channels[channelIndex] = result.data
    }
    data.state.public.updateToken = randomString()

    return data
}


export async function deleteChannel(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    checkUpdateToken(data)

    const channelCode= data.request.body.code

    if(!data.state.public.channels) data.state.public.channels = []

    const channelIndex = data.state.public.channels.findIndex(c => c.code === channelCode)
    if (channelIndex !== -1) {
        data.state.public.channels = data.state.public.channels.filter(c=>c.code !== channelCode)
    }
    data.state.public.updateToken = randomString()

    return data
}

import {ProductSettingsData} from "./index";
import {checkUpdateToken, randomString} from "./helpers";
import {AttributeGroup} from "./models";


export async function addAttributeGroup(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = AttributeGroup.safeParse(data.request.body.attributeGroup)
    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: result.error
            }
        }
        return data
    }

    if (data.state.public.attributeGroups.findIndex(ag => ag.code === result.data.code) !== -1) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Attribute group already exist!"
            }
        }
        return data
    }

    result.data.attributes = []

    data.state.public.attributeGroups.push(result.data)
    data.state.public.updateToken = randomString()

    return data
}

export async function updateAttributeGroup(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)


    const result = AttributeGroup.safeParse(data.request.body.attributeGroup)
    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: result.error
            }
        }
        return data
    }

    const agIndex = data.state.public.attributeGroups.findIndex(ag => ag.code === result.data.code)

    if (agIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Attribute group not found!"
            }
        }
        return data
    }

    data.state.public.attributeGroups[agIndex] = result.data
    data.state.public.updateToken = randomString()

    return data
}

export async function deleteAttributeGroup(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    if(!data.request.body.attributeGroupCode){
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid attribute group code!"
            }
        }
        return data
    }

    data.state.public.attributeGroups = data.state.public.attributeGroups.filter(ag=>ag.code !== data.request.body.attributeGroupCode)
    data.state.public.updateToken = randomString()

    return data
}

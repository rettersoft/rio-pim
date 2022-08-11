import {ProductSettingsData} from "./index";
import {checkUpdateToken, randomString} from "./helpers";
import {AttributeGroup, BaseAttribute, Code} from "./models";

export const RESERVED_ATTRIBUTE_GROUP_CODE = "other"


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

    checkReservedAttributeGroup(result.data.code)

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

    const attributeGroupCodeModel = Code.safeParse(data.request.body.attributeGroupCode)

    if (attributeGroupCodeModel.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: attributeGroupCodeModel.error
            }
        }
        return data
    }

    checkReservedAttributeGroup(attributeGroupCodeModel.data)

    data.state.public.attributes = data.state.public.attributes.reduce<BaseAttribute[]>((acc, val) => {
        if (val.group === attributeGroupCodeModel.data) val.group = RESERVED_ATTRIBUTE_GROUP_CODE
        acc.push(val)
        return acc
    }, [])

    data.state.public.attributeGroups = data.state.public.attributeGroups.filter(ag => ag.code !== attributeGroupCodeModel.data)
    data.state.public.updateToken = randomString()

    return data
}

function checkReservedAttributeGroup(code: string) {
    if (RESERVED_ATTRIBUTE_GROUP_CODE === code) throw new Error("This is reserved attribute group!")
}

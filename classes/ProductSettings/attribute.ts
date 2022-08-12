import {ProductSettingsData} from "./index";
import {checkUpdateToken, randomString} from "./helpers";
import {AttributeTypes, BaseAttribute, Code, SelectOption, SpecificAttributes} from "./models";


export async function createAttribute(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const baseAttribute = BaseAttribute.safeParse(data.request.body.attribute)
    if (baseAttribute.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: baseAttribute.error
            }
        }
        return data
    }

    const result = SpecificAttributes[baseAttribute.data.type].safeParse(data.request.body.attribute)

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

    specificAttributeValidation(result.data)

    if (data.state.public.attributes.findIndex(a => a.code === baseAttribute.data.code) !== -1) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Attribute already exist!"
            }
        }
        return data
    }

    const agIndex = data.state.public.attributeGroups.findIndex(ag => ag.code === baseAttribute.data.group)

    if (agIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Attribute group not found!"
            }
        }
        return data
    }

    data.state.public.attributes.push(result.data)
    data.state.public.updateToken = randomString()

    return data
}

export async function updateAttribute(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const baseAttribute = BaseAttribute.safeParse(data.request.body.attribute)
    if (baseAttribute.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: baseAttribute.error
            }
        }
        return data
    }

    const result = SpecificAttributes[baseAttribute.data.type].safeParse(data.request.body.attribute)

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

    specificAttributeValidation(result.data)

    const aIndex = data.state.public.attributes.findIndex(a => a.code === baseAttribute.data.code)

    if (aIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Attribute not found!"
            }
        }
        return data
    }

    const attribute = data.state.public.attributes[aIndex]

    if (attribute.group !== result.data.group) {
        const agIndexNew = data.state.public.attributeGroups.findIndex(ag => ag.code === result.data.group)

        if (agIndexNew === -1) {
            data.response = {
                statusCode: 404,
                body: {
                    message: "Attribute group not found!"
                }
            }
            return data
        }
    }

    result.data.type = attribute.type // Dont change
    result.data.localizable = attribute.localizable // Dont change
    result.data.scopable = attribute.scopable // Dont change
    result.data.isUnique = attribute.isUnique // Dont change

    data.state.public.attributes[aIndex] = result.data
    data.state.public.updateToken = randomString()

    return data
}

export async function deleteAttribute(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    if (!data.request.body.attributeCode) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid attribute code!"
            }
        }
        return data
    }

    data.state.public.attributes = data.state.public.attributes.filter(a => a.code !== data.request.body.attributeCode)
    data.state.public.updateToken = randomString()

    return data
}

export async function upsertSelectOption(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const result = SelectOption.safeParse(data.request.body.option)
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

    const attribute = getAttribute(data.request.body.attributeCode, data)

    if (![AttributeTypes.Enum.SIMPLESELECT, AttributeTypes.Enum.MULTISELECT].includes(attribute.type)) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid attribute type!"
            }
        }
        return data
    }

    const attributeOptionsIndex = data.state.public.attributeOptions.findIndex(ao => ao.code === attribute.code)

    if (attributeOptionsIndex === -1) {
        data.state.public.attributeOptions.push({
            code: attribute.code,
            options: [result.data]
        })
    } else {
        const optionIndex = data.state.public.attributeOptions[attributeOptionsIndex].options.findIndex(o => o.code === result.data.code)
        if (optionIndex === -1) {
            data.state.public.attributeOptions[attributeOptionsIndex].options.push(result.data)
        } else {
            data.state.public.attributeOptions[attributeOptionsIndex].options[optionIndex] = result.data
        }
    }

    data.state.public.updateToken = randomString()

    return data
}

export async function deleteSelectOption(data: ProductSettingsData): Promise<ProductSettingsData> {
    checkUpdateToken(data)

    const attributeOptionCodeModel = Code.safeParse(data.request.body.attributeOptionCode)
    if (attributeOptionCodeModel.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: attributeOptionCodeModel.error
            }
        }
        return data
    }

    const attribute = getAttribute(data.request.body.attributeCode, data)

    if (![AttributeTypes.Enum.SIMPLESELECT, AttributeTypes.Enum.MULTISELECT].includes(attribute.type)) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid attribute type!"
            }
        }
        return data
    }


    return data
}


function getAttribute(code: string | undefined, data: ProductSettingsData) {
    const attributeCodeModel = Code.safeParse(code)
    if (attributeCodeModel.success === false) throw new Error("Invalid attribute code!")

    const attribute = data.state.public.attributes.find(a => a.code === attributeCodeModel.data)

    if (!attribute) throw new Error("Attribute not found!")

    return attribute
}

function specificAttributeValidation(attribute: BaseAttribute) {
    if (
        [AttributeTypes.Enum.BOOLEAN, AttributeTypes.Enum.DATE, AttributeTypes.Enum.IMAGE, AttributeTypes.Enum.MULTISELECT,
            AttributeTypes.Enum.MULTISELECT, AttributeTypes.Enum.SIMPLESELECT, AttributeTypes.Enum.PRICE,
            AttributeTypes.Enum.TEXTAREA].includes(attribute.type)
    ) {
        if (attribute.isUnique === true) throw new Error('Attribute can not be unique!')
    }
}

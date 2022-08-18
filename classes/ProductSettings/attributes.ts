import {ProductSettingsData} from "./index";
import {checkUpdateToken, randomString} from "./helpers";
import {AttributeTypes, BaseAttribute, Code, Family, FamilyVariant, SelectOption, SpecificAttributes} from "./models";
import {
    checkReservedIdAttribute,
    getAttribute,
    isAxisAttribute, isFamilyAttributeLabel,
    specificAttributeValidation
} from "./attributes.repository";


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

    checkReservedIdAttribute(result.data.code)

    specificAttributeValidation(result.data)

    if(result.data.type === AttributeTypes.Enum.IDENTIFIER && data.state.public.attributes.findIndex(a=>a.type=== AttributeTypes.Enum.IDENTIFIER) !== -1){
        data.response = {
            statusCode: 400,
            body: {
                message: "An identifier attribute already exists!"
            }
        }
        return data
    }

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

    checkReservedIdAttribute(result.data.code)

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

    const attributeCode = data.request.body.attributeCode

    if (!attributeCode) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid attribute code!"
            }
        }
        return data
    }

    checkReservedIdAttribute(attributeCode)

    if(isAxisAttribute(attributeCode, data)){
        data.response = {
            statusCode: 400,
            body: {
                message: "This attribute used as a variant axis in a family variant!"
            }
        }
        return data
    }

    if(isFamilyAttributeLabel(attributeCode, data)){
        data.response = {
            statusCode: 400,
            body: {
                message: "This attribute used as label!"
            }
        }
        return data
    }

    data.state.public.families = data.state.public.families = data.state.public.families.reduce<Family[]>((acc, val)=>{
        val.attributes = val.attributes.filter(a=>a.attribute !== attributeCode)
        val.variants = val.variants.reduce<FamilyVariant[]>((acc, varVal)=>{
            varVal.attributes === varVal.attributes.filter(a=>a !== attributeCode)
            acc.push(varVal)
            return acc
        },[])
        acc.push(val)
        return acc
    }, [])

    data.state.public.attributes = data.state.public.attributes.filter(a => a.code !== attributeCode)
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
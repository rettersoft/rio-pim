import {ProductSettingsData} from "./index";
import {AttributeTypes, BaseAttribute, Code} from "./models";

export const RESERVED_ID_ATTRIBUTE_CODE = "sku"

export function getAttribute(code: string | undefined, data: ProductSettingsData) {
    const attributeCodeModel = Code.safeParse(code)
    if (attributeCodeModel.success === false) throw new Error("Invalid attribute code!")

    const attribute = data.state.public.attributes.find(a => a.code === attributeCodeModel.data)

    if (!attribute) throw new Error("Attribute not found!")

    return attribute
}

export function specificAttributeValidation(attribute: BaseAttribute) {
    if (
        [AttributeTypes.Enum.BOOLEAN, AttributeTypes.Enum.DATE, AttributeTypes.Enum.IMAGE, AttributeTypes.Enum.MULTISELECT,
            AttributeTypes.Enum.MULTISELECT, AttributeTypes.Enum.SIMPLESELECT, AttributeTypes.Enum.PRICE,
            AttributeTypes.Enum.TEXTAREA].includes(attribute.type)
    ) {
        if (attribute.isUnique === true) throw new Error('Attribute can not be unique!')
    }
}

export function checkReservedIdAttribute(code: string) {
    if (RESERVED_ID_ATTRIBUTE_CODE === code) throw new Error("This is reserved attribute!")
}

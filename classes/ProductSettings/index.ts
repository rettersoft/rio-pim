import {Data, Response} from "@retter/rdk";
import {AccountIDInput} from "./rio";
import {randomString} from "./helpers";
import {AttributeGroup, AttributeTypes, BaseAttribute, Family, SelectOption} from "./models";
import {RESERVED_ID_ATTRIBUTE_CODE} from "./attributes.repository";
import {RESERVED_ATTRIBUTE_GROUP_CODE} from "./attribute-groups.repository";


export interface AttributeOption {
    code: string
    options: SelectOption[]
}

export interface ProductSettingsPublicState {
    attributeGroups: AttributeGroup[]
    attributes: BaseAttribute[]
    attributeOptions: AttributeOption[]
    families: Family[]
    updateToken: string
}

export type ProductSettingsData<Input = any, Output = any> = Data<Input, Output, ProductSettingsPublicState>

export async function authorizer(data: ProductSettingsData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"

    if ([
        "addAttributeGroup",
        "updateAttributeGroup",
        "deleteAttributeGroup",
        "createAttribute",
        "updateAttribute",
        "deleteAttribute",
        "upsertSelectOption",
        "deleteSelectOption",
        "createFamily",
        "updateFamily",
        "deleteFamily",
        "addAttributeToFamily",
        "removeAttributeFromFamily",
        "addVariant",
        "updateVariant",
        "deleteVariant",
        "toggleRequiredStatusFamilyAttribute"
    ].includes(data.context.methodName)) {
        return {statusCode: 200}
    }

    switch (data.context.methodName) {
        case 'STATE':
            if (isDeveloper) return {statusCode: 200}
            break
        case 'GET':
            return {statusCode: 200}
        case 'INIT':
            if (data.context.identity === "AccountManager" || isDeveloper) {
                return {statusCode: 200}
            }
            break
    }
    return {statusCode: 401};
}

export async function getInstanceId(data: ProductSettingsData<AccountIDInput>): Promise<string> {
    return data.request.body.accountId
}

export async function init(data: ProductSettingsData): Promise<ProductSettingsData> {
    data.state.public = {
        families: [],
        attributeOptions: [],
        attributes: [{
            code: RESERVED_ID_ATTRIBUTE_CODE,
            type: AttributeTypes.Enum.IDENTIFIER,
            group: RESERVED_ATTRIBUTE_GROUP_CODE,
            isUnique: true,
            label: [{
                locale: "en_US",
                value: "SKU",
            }]
        }],
        attributeGroups: [{
            code: RESERVED_ATTRIBUTE_GROUP_CODE,
            label: [{
                locale: "en_US",
                value: "Other",
            }]
        }],
        updateToken: randomString()
    }
    return data
}

export async function getState(data: ProductSettingsData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

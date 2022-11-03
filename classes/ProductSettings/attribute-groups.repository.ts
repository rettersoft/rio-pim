import {RESERVED_ATTRIBUTE_GROUP_CODE} from "PIMModelsPackage";


export function checkReservedAttributeGroup(code: string) {
    if (RESERVED_ATTRIBUTE_GROUP_CODE === code) throw new Error("This is reserved attribute group!")
}

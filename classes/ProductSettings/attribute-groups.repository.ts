export const RESERVED_ATTRIBUTE_GROUP_CODE = "other"

export function checkReservedAttributeGroup(code: string) {
    if (RESERVED_ATTRIBUTE_GROUP_CODE === code) throw new Error("This is reserved attribute group!")
}

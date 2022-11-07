import Z from "zod";
import {Code, Label, Locale} from "./common-models";
import {RESERVED_ID_ATTRIBUTE_CODE} from "./constants";

export const AttributeTypes = Z.enum([
    "TEXT",
    "TEXTAREA",
    "BOOLEAN",
    "IDENTIFIER",
    "NUMBER",
    "IMAGE",
    "MULTISELECT",
    "SIMPLESELECT",
    "DATE",
    "PRICE",
])

export const PimImageExtensions = Z.enum([
    "jpeg",
    "jpg",
    "png",
    "tiff"
])

export const PimValidationRules = Z.enum([
    "REGEXP",
    "EMAIL",
    "URL",
])

export const AttributeOptionItem = Z.object({
    code: Code,
    label: Label
})
export type AttributeOptionItem = Z.infer<typeof AttributeOptionItem>

export const AttributeOption = Z.object({
    code: Code,
    options: Z.array(AttributeOptionItem)
})
export type AttributeOption = Z.infer<typeof AttributeOption>
export const AttributeOptions = Z.array(AttributeOption).default([])

export const BaseAttribute = Z.object({
    code: Code,
    type: AttributeTypes,
    group: Z.string().min(1).max(100),
    localizable: Z.boolean().default(false),
    scopable: Z.boolean().default(false),
    label: Label,
    isLocaleSpecific: Z.boolean().default(false),
    availableLocales: Z.array(Locale).default([]),
    isUnique: Z.boolean().default(false),
})
export type BaseAttribute = Z.infer<typeof BaseAttribute>
export const BaseAttributes = Z.array(BaseAttribute)
/**
 * uniqable units : TEXT, IDENTIFIER, NUMBER
 */

/**
 * ATTRIBUTE MODELS - START
 */

export const SpecificAttributes = {
    TEXT: BaseAttribute.extend({
        maxCharacters: Z.number().min(0).max(255).optional(),
        validationRule: PimValidationRules.optional(),
        validationRegexp: Z.string().optional(),
    }),
    TEXTAREA: BaseAttribute.extend({
        maxCharacters: Z.number().min(0).max(65535).optional()
    }),
    BOOLEAN: BaseAttribute.extend({
        defaultValue: Z.boolean().default(false)
    }),
    IDENTIFIER: BaseAttribute.extend({
        maxCharacters: Z.number().min(0).max(255).optional(),
        validationRule: Z.enum<any, any>(["REGEXP"]).optional(),
        validationRegexp: Z.string().optional(),
    }),
    NUMBER: BaseAttribute.extend({
        negativeAllowed: Z.boolean().default(false),
        decimalsAllowed: Z.boolean().default(false),
        minNumber: Z.number().min(Number.MIN_SAFE_INTEGER).optional(),
        maxNumber: Z.number().max(Number.MAX_SAFE_INTEGER).optional(),
    }),
    IMAGE: BaseAttribute.extend({
        maxFileSizeInMB: Z.number().min(0).max(5).default(5),
        allowedExtensions: Z.array(PimImageExtensions).optional()
    }),
    MULTISELECT: BaseAttribute.extend({}),
    SIMPLESELECT: BaseAttribute.extend({}),
    DATE: BaseAttribute.extend({
        minDate: Z.preprocess((arg: Date | string) => {
            return new Date(new Date(arg.toString()).toISOString().slice(0,10))
        }, Z.date()).optional(),
        maxDate: Z.preprocess((arg: Date | string) => {
            return new Date(new Date(arg.toString()).toISOString().slice(0,10))
        }, Z.date()).optional(),
    }),
    PRICE: BaseAttribute.extend({
        decimalsAllowed: Z.boolean().default(true),
        minNumber: Z.number().min(0).optional(),
        maxNumber: Z.number().max(Number.MAX_SAFE_INTEGER).optional(),
    }),
}

export type IDENTIFIER = Z.infer<typeof SpecificAttributes.IDENTIFIER>
export type IMAGE = Z.infer<typeof SpecificAttributes.IMAGE>
export type TEXT = Z.infer<typeof SpecificAttributes.TEXT>
export type TEXTAREA = Z.infer<typeof SpecificAttributes.TEXTAREA>
export type BOOLEAN = Z.infer<typeof SpecificAttributes.BOOLEAN>
export type NUMBER = Z.infer<typeof SpecificAttributes.NUMBER>
export type MULTISELECT = Z.infer<typeof SpecificAttributes.MULTISELECT>
export type SIMPLESELECT = Z.infer<typeof SpecificAttributes.SIMPLESELECT>
export type DATE = Z.infer<typeof SpecificAttributes.DATE>
export type PRICE = Z.infer<typeof SpecificAttributes.PRICE>

/**
 * ATTRIBUTE MODELS - END
 */


export const AttributeGroup = Z.object({
    code: Code,
    label: Label
})
export type AttributeGroup = Z.infer<typeof AttributeGroup>
export const AttributeGroups = Z.array(AttributeGroup)

const FamilyAttribute = Z.object({
    attribute: Code,
    requiredChannels: Z.array(Code)
})
export type FamilyAttribute = Z.infer<typeof FamilyAttribute>

export const FamilyVariant = Z.object({
    code: Code,
    label: Label,
    axes: Z.array(Code),
    attributes: Z.array(Code).default([])
})
export type FamilyVariant = Z.infer<typeof FamilyVariant>
export const FamilyVariants = Z.array(FamilyVariant).default([])


export const Family = Z.object({
    code: Code,
    label: Label,
    attributeAsLabel: Z.string().default(RESERVED_ID_ATTRIBUTE_CODE),
    attributeAsImage: Z.string().optional(),
    attributes: Z.array(FamilyAttribute).default([]),
    variants: FamilyVariants
})
export type Family = Z.infer<typeof Family>
export const Families = Z.array(Family)


export const GroupType = Z.object({
    code: Code,
    label: Label
})
export type GroupType = Z.infer<typeof GroupType>
export const GroupTypes = Z.array(GroupType)

export const Group = Z.object({
    code: Code,
    type: Code,
    label: Label
})
export type Group = Z.infer<typeof Group>
export const Groups = Z.array(Group)

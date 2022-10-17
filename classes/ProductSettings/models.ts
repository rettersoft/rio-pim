import Z from "zod"
import {RESERVED_ID_ATTRIBUTE_CODE} from "./attributes.repository";
import {Locales} from "ConstantsPackage";

export const Locale = Z.string().refine((val) => Locales.findIndex(l => l.id === val) !== -1,
    "Invalid locale value!")

export const LocaleSet = Z.object({
    locale: Locale,
    value: Z.string()
})
export type Locale = Z.infer<typeof LocaleSet>

export const Label = Z.array(LocaleSet).default([])
export type Label = Z.infer<typeof Label>

export const Code = Z.string().min(1).max(100).regex(new RegExp(/^([A-Za-z0-9_])*$/g))

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

export const SelectOption = Z.object({
    code: Code,
    label: Label
})
export type SelectOption = Z.infer<typeof SelectOption>

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
        defaultValue: Z.boolean().optional()
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
        minDate: Z.preprocess((arg) => {
            if (typeof arg === "string") return new Date(arg)
        }, Z.date()).optional(),
        maxDate: Z.preprocess((arg) => {
            if (typeof arg === "string") return new Date(arg)
        }, Z.date()).optional(),
    }),
    PRICE: BaseAttribute.extend({
        decimalsAllowed: Z.boolean().default(true),
        minNumber: Z.number().min(0).optional(),
        maxNumber: Z.number().max(Number.MAX_SAFE_INTEGER).optional(),
    }),
}

export type IDENTIFIER = Z.infer<typeof SpecificAttributes.IDENTIFIER>

/**
 * ATTRIBUTE MODELS - END
 */


export const AttributeGroup = Z.object({
    code: Code,
    label: Label
})
export type AttributeGroup = Z.infer<typeof AttributeGroup>


const FamilyAttribute = Z.object({
    attribute: Code,
    requiredChannels: Z.array(Code)
})

export const FamilyVariant = Z.object({
    code: Code,
    label: Label,
    axes: Z.array(Code),
    attributes: Z.array(Code).default([])
})
export type FamilyVariant = Z.infer<typeof FamilyVariant>

export const Family = Z.object({
    code: Code,
    label: Label,
    attributeAsLabel: Z.string().default(RESERVED_ID_ATTRIBUTE_CODE),
    attributeAsImage: Z.string().optional(),
    attributes: Z.array(FamilyAttribute).default([]),
    variants: Z.array(FamilyVariant).default([])
})
export type Family = Z.infer<typeof Family>


export const GroupType = Z.object({
    code: Code,
    label: Label
})
export type GroupType = Z.infer<typeof GroupType>

export const Group = Z.object({
    code: Code,
    type: Code,
    label: Label
})
export type Group = Z.infer<typeof Group>

import Z from "zod"
import {Locales} from "./consts";

export const Locale = Z.string().refine((val) => Locales.findIndex(l => l.id === val) !== -1,
    "Invalid locale value!")

export const LocaleSet = Z.object({
    locale: Locale,
    value: Z.string()
})
export type Locale = Z.infer<typeof LocaleSet>

export const Label = Z.array(LocaleSet).optional()
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
    localizable: Z.boolean(),
    scopable: Z.oboolean(),
    label: Label,
    isLocaleSpecific: Z.boolean(),
    availableLocales: Z.array(Locale).default([]),
    unique: Z.boolean().default(false),
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
        maxCharacters: Z.number().min(0).max(255),
        validationRule: PimValidationRules,
        validationRegexp: Z.string().optional(),
    }),
    TEXTAREA: BaseAttribute.extend({
        maxCharacters: Z.number().min(0).max(65535)
    }),
    BOOLEAN: BaseAttribute.extend({
        maxCharacters: Z.number().min(0).max(65535),
        defaultValue: Z.boolean().optional()
    }),
    IDENTIFIER: BaseAttribute.extend({
        maxCharacters: Z.number().min(0).max(65535),
        validationRule: Z.enum<any, any>(["REGEXP"]).optional(),
        validationRegexp: Z.string().optional(),
    }),
    NUMBER: BaseAttribute.extend({
        negativeAllowed: Z.boolean(),
        decimalsAllowed: Z.boolean(),
        minNumber: Z.number().optional(),
        maxNumber: Z.number().optional(),
    }),
    IMAGE: BaseAttribute.extend({
        maxFileSizeInMB: Z.number().max(5).min(0),
        allowedExtensions: Z.array(PimImageExtensions)
    }),
    MULTISELECT: BaseAttribute.extend({}),
    SIMPLESELECT: BaseAttribute.extend({}),
    DATE: BaseAttribute.extend({
        minDate: Z.date(),
        maxDate: Z.date(),
    }),
    PRICE: BaseAttribute.extend({
        decimalsAllowed: Z.boolean(),
        minNumber: Z.number().optional(),
        maxNumber: Z.number().optional(),
    }),
}

/**
 * ATTRIBUTE MODELS - END
 */


export const AttributeGroup = Z.object({
    code: Code,
    attributes: Z.array(Code).default([]),
    label: Label
})
export type AttributeGroup = Z.infer<typeof AttributeGroup>


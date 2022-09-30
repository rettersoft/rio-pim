import Z from "zod"

export const Code = Z.string().min(1).max(100).regex(new RegExp(/^([A-Za-z0-9_])*$/g))
export const ProductCategoryCode = Z.string().min(1).max(500).regex(new RegExp(/^([A-Za-z0-9_#])*$/g))


/**
 *  Product settings models
 */
export const Locale = Z.string()
export const LocaleSet = Z.object({
    locale: Locale,
    value: Z.string()
})
export const Label = Z.array(LocaleSet).default([])
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

export const SelectOption = Z.object({
    code: Code,
    label: Label
})
export type SelectOption = Z.infer<typeof SelectOption>

export const AttributeOption = Z.object({
    code: Code,
    options: Z.array(SelectOption)
})

export const ProductProperties = Z.object({
    attributes: Z.array(BaseAttribute),
    attributeOptions: Z.array(AttributeOption)
})
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

export type TEXT = Z.infer<typeof SpecificAttributes.TEXT>
export type TEXTAREA = Z.infer<typeof SpecificAttributes.TEXTAREA>
export type BOOLEAN = Z.infer<typeof SpecificAttributes.BOOLEAN>
export type IDENTIFIER = Z.infer<typeof SpecificAttributes.IDENTIFIER>
export type NUMBER = Z.infer<typeof SpecificAttributes.NUMBER>
export type IMAGE = Z.infer<typeof SpecificAttributes.IMAGE>
export type MULTISELECT = Z.infer<typeof SpecificAttributes.MULTISELECT>
export type SIMPLESELECT = Z.infer<typeof SpecificAttributes.SIMPLESELECT>
export type DATE = Z.infer<typeof SpecificAttributes.DATE>
export type PRICE = Z.infer<typeof SpecificAttributes.PRICE>


export const ProductAttributeData = Z.object({
    scope: Code.optional(),
    locale: Code.optional(),
    value: Z.any()
})

export const ProductAttribute = Z.object({
    code: Code,
    data: Z.array(ProductAttributeData).default([])
})
export type ProductAttribute = Z.infer<typeof ProductAttribute>

export const Product = Z.object({
    sku: Z.string().max(255).min(1).regex(new RegExp("^([A-Za-z0-9_])*$", "g")),
    family: Code,
    enabled: Z.boolean().default(false),
    groups: Z.array(Code).default([]),
    categories: Z.array(ProductCategoryCode).default([]),
    attributes: Z.array(ProductAttribute).default([])
})
export type Product = Z.infer<typeof Product>

export const DataType = Z.enum([
    "PRODUCT",
    "PRODUCT_MODEL"
])
export type DataType = Z.infer<typeof DataType>

export const ProductModel = Z.object({
    code: Code,
    family: Code,
    variant: Code,
    categories: Z.array(ProductCategoryCode).default([]),
    attributes: Z.array(ProductAttribute).default([])
})
export type ProductModel = Z.infer<typeof ProductModel>


export const AxeValueItem = Z.object({
    axe: Code,
    value: Z.string()
})
export const AxesValuesList = Z.array(AxeValueItem)
export type AxesValuesList = Z.infer<typeof AxesValuesList>


export interface FamilyAttribute {
    attribute: string
    requiredChannels: string[]
}

export interface FamilyVariant{
    code: string
    label: string
    axes: string[]
    attributes: string[]
}

export interface Family {
    code: string
    label: string
    attributeAsLabel: string
    attributeAsImage?: string
    attributes: FamilyAttribute[]
    variants: FamilyVariant[]
}

export interface AttributeOption {
    code: string
    options: SelectOption[]
}


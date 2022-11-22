/**
 * CUSTOM IMPORT MODELS
 *
 */
import {Code} from "PIMModelsPackage";
import Z from "zod";

export const ProductImportItem = Z.object({
    sku: Z.string().max(255).min(1).regex(new RegExp("^([A-Za-z0-9_])*$", "g")),
    family: Code,
    enabled: Z.boolean(),
    groups: Z.string(),
    categories: Z.string()
})

export const ProductModelImportItem = Z.object({
    code: Code,
    family: Code,
    variant: Code,
    categories: Z.string()
})

export const AttributeGroupImportItem = Z.object({
    code: Code
})

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

export const PimValidationRules = Z.enum([
    "REGEXP",
    "EMAIL",
    "URL",
])

export const BaseAttributeImportModel = Z.object({
    code: Code,
    type: AttributeTypes,
    group: Z.string().min(1).max(100),
    localizable: Z.boolean(),
    scopable: Z.boolean(),
    isLocaleSpecific: Z.boolean(),
    availableLocales: Z.string().optional(),
    isUnique: Z.boolean()
})
export const SpecificAttributesImportModel = {
    TEXT: BaseAttributeImportModel.extend({
        maxCharacters: Z.number().min(0).max(255).optional(),
        validationRule: PimValidationRules.optional(),
        validationRegexp: Z.string().optional(),
    }),
    TEXTAREA: BaseAttributeImportModel.extend({
        maxCharacters: Z.number().min(0).max(65535).optional()
    }),
    BOOLEAN: BaseAttributeImportModel.extend({
        defaultValue: Z.boolean().optional()
    }),
    IDENTIFIER: BaseAttributeImportModel.extend({
        maxCharacters: Z.number().min(0).max(255).optional(),
        validationRule: Z.enum<any, any>(["REGEXP"]).optional(),
        validationRegexp: Z.string().optional(),
    }),
    NUMBER: BaseAttributeImportModel.extend({
        negativeAllowed: Z.boolean().default(false),
        decimalsAllowed: Z.boolean().default(false),
        minNumber: Z.number().min(Number.MIN_SAFE_INTEGER).optional(),
        maxNumber: Z.number().max(Number.MAX_SAFE_INTEGER).optional(),
    }),
    IMAGE: BaseAttributeImportModel.extend({
        maxFileSizeInMB: Z.number().min(0).max(5).default(5),
        allowedExtensions: Z.string().optional()
    }),
    MULTISELECT: BaseAttributeImportModel.extend({}),
    SIMPLESELECT: BaseAttributeImportModel.extend({}),
    DATE: BaseAttributeImportModel.extend({
        minDate: Z.preprocess((arg) => {
            if (typeof arg === "string") return new Date(arg)
        }, Z.date()).optional(),
        maxDate: Z.preprocess((arg) => {
            if (typeof arg === "string") return new Date(arg)
        }, Z.date()).optional(),
    }),
    PRICE: BaseAttributeImportModel.extend({
        decimalsAllowed: Z.boolean().default(true),
        minNumber: Z.number().min(0).optional(),
        maxNumber: Z.number().max(Number.MAX_SAFE_INTEGER).optional(),
    }),
}

export const AttributeOptionImportItem = Z.object({
    code: Code
})

export const GroupTypeImportItem = Z.object({
    code: Code
})

export const GroupImportItem = Z.object({
    code: Code,
    type: Code
})

export const FamilyImportItem = Z.object({
    code: Code,
    attributeAsLabel: Z.string().optional(),
    attributeAsImage: Z.string().optional(),
    attributes: Z.string(),
})

export const FamilyVariantImportItem = Z.object({
    code: Code,
    axes: Z.string(),
    attributes: Z.string(),
})

export const CategoryImportItem = Z.object({
    code: Code,
    parent: Z.string().optional(),
})

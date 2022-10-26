import Z from "zod";

export const Code = Z.string().min(1).max(100).regex(new RegExp(/^([A-Za-z0-9_])*$/g))

export const ImportJobs = Z.enum([
    "product_import",
    "product_model_import",
    "group_import",
    "category_import",
    "attribute_import",
    "attribute_option_import",
    "attribute_group_import",
    "family_import",
    "family_variant_import",
    "group_type_import",
])

export const ImportConnectors = Z.enum([
    "xlsx",
    "csv",
])

export const GlobalProductModelImportSettings = Z.object({
    decimalSeparator: Z.enum([",", "."]).default("."),
    dateFormat: Z.enum([
        "yyyy/MM/dd",
        "MM/dd/yyyy",
        "dd/MM/yyyy",
        "yyyy-MM-dd",
        "dd.MM.yyyy"
    ]).default("yyyy-MM-dd"),
    enableTheProduct: Z.boolean().default(false),
    categoriesColumn: Z.string().regex(new RegExp(/^([A-Za-z0-9])*$/g)).default("categories"),
    familyColumn: Z.string().regex(new RegExp(/^([A-Za-z0-9])*$/g)).default("family"),
    groupsColumn: Z.string().regex(new RegExp(/^([A-Za-z0-9])*$/g)).default("groups"),
    compareValues: Z.boolean().default(true)
})

export const GlobalProductImportSettings = GlobalProductModelImportSettings.extend({
    convertVariantToSimple: Z.boolean().default(false),
})

export const ProductImportXLSXSettings = GlobalProductImportSettings.extend({})
export type ProductImportXLSXSettings = Z.infer<typeof ProductImportXLSXSettings>

export const ProductImportCSVSettings = GlobalProductImportSettings.extend({
    delimiter: Z.string().default(";"),
    enclosure: Z.string().default("\"")
})
export type ProductImportCSVSettings = Z.infer<typeof ProductImportCSVSettings>


export const ProductModelImportXLSXSettings = GlobalProductModelImportSettings.extend({})
export type ProductModelImportXLSXSettings = Z.infer<typeof ProductModelImportXLSXSettings>

export const ProductModelImportCSVSettings = GlobalProductModelImportSettings.extend({
    delimiter: Z.string().default(";"),
    enclosure: Z.string().default("\"")
})
export type ProductModelImportCSVSettings = Z.infer<typeof ProductModelImportCSVSettings>


export const ImportProfile = Z.object({
    code: Code,
    job: ImportJobs,
    connector: ImportConnectors,
    label: Z.string().min(1).max(180),
    globalSettings: Z.any().optional(), // manual validation at business logic level
    createdAt: Z.date().default(new Date()),
})
export type ImportProfile = Z.infer<typeof ImportProfile>



export const JobStatus = Z.enum([
    "RUNNING",
    "FAILED",
    "DONE"
])
export type JobStatus = Z.infer<typeof JobStatus>

export const Job = Z.object({
    uid: Z.string().min(32).max(32),
    code: Code,
    connector: ImportConnectors,
    status: JobStatus,
    total: Z.number().min(0).optional(),
    processed: Z.number().min(0),
    failed: Z.number().min(0),
    failReason: Z.string().optional(),
    startedAt: Z.preprocess((arg) => {
        if (typeof arg === "string") return new Date(arg)
    }, Z.date()),
    finishedAt: Z.preprocess((arg) => {
        if (typeof arg === "string") return new Date(arg)
    }, Z.date()).optional()
})
export type Job = Z.infer<typeof Job>


/**
 * IMPORT MODELS
 */
export const ProductCategoryCode = Z.string().min(1).max(500).regex(new RegExp(/^([A-Za-z0-9_#])*$/g))

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
    availableLocales: Z.string(),
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

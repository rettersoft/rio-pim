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
    status: JobStatus,
    total: Z.number().min(0),
    processed: Z.number().min(0),
    failed: Z.number().min(0),
    startedAt: Z.preprocess((arg) => {
        if (typeof arg === "string") return new Date(arg)
    }, Z.date()),
    finishedAt: Z.preprocess((arg) => {
        if (typeof arg === "string") return new Date(arg)
    }, Z.date()).optional()
})
export type Job = Z.infer<typeof Job>

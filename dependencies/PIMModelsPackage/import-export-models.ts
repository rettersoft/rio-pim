import Z from "zod";
import {Code, Locale} from "./common-models";

export const Connectors = Z.enum([
    "xlsx",
    "csv",
])

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

export const ExportJobs = Z.enum([
    "product_export",
    "product_model_export",
    "group_export",
    "category_export",
    "attribute_export",
    "attribute_option_export",
    "attribute_group_export",
    "family_export",
    "family_variant_export",
    "group_type_export",
])

export const JobStatus = Z.enum([
    "RUNNING",
    "FAILED",
    "DONE"
])
export type JobStatus = Z.infer<typeof JobStatus>


const BaseJob = Z.object({
    uid: Z.string().min(32).max(32),
    code: Code,
    connector: Connectors,
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

const BaseJobProfile = Z.object({
    code: Code,
    connector: Connectors,
    label: Z.string().min(1).max(180),
    globalSettings: Z.any().optional(), // manual validation at business logic level
    createdAt: Z.date().default(new Date()),
})

const ImportExportDateFormat = Z.enum([
    "yyyy/MM/dd",
    "MM/dd/yyyy",
    "dd/MM/yyyy",
    "yyyy-MM-dd",
    "dd.MM.yyyy"
]).default("yyyy-MM-dd")

const ImportExportDecimalSeparator = Z.enum([",", "."]).default(".")


/**
 * IMPORT MODELS - START
 */
export const GlobalProductModelImportSettings = Z.object({
    decimalSeparator: ImportExportDecimalSeparator,
    dateFormat: ImportExportDateFormat,
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

export const ImportProfile = BaseJobProfile.extend({
    job: ImportJobs
})
export type ImportProfile = Z.infer<typeof ImportProfile>

export const ImportJob = BaseJob.extend({
    job: ImportJobs
})
export type ImportJob = Z.infer<typeof ImportJob>
/**
 * IMPORT MODELS - END
 */


/**
 * EXPORT MODELS - START
 */
export const ExportProfileContent = Z.object({
    channel: Code,
    locales: Z.array(Locale).min(1),
    attributes: Z.array(Code).default([])
})

export const GlobalProductModelExportSettings = Z.object({
    decimalSeparator: ImportExportDecimalSeparator,
    dateFormat: ImportExportDateFormat,
    numberOfLinesPerFile: Z.number().min(1).default(10000),
    withHeader: Z.boolean().default(true),
    content: ExportProfileContent
})
export type GlobalProductModelExportSettings = Z.infer<typeof GlobalProductModelExportSettings>

export const GlobalProductExportSettings = GlobalProductModelExportSettings.extend({})

export const ProductExportXLSXSettings = GlobalProductExportSettings.extend({})
export type ProductExportXLSXSettings = Z.infer<typeof ProductExportXLSXSettings>

export const ProductExportCSVSettings = GlobalProductExportSettings.extend({
    delimiter: Z.string().default(";"),
    enclosure: Z.string().default("\"")
})
export type ProductExportCSVSettings = Z.infer<typeof ProductExportCSVSettings>

export const ProductModelExportXLSXSettings = GlobalProductModelExportSettings.extend({})
export type ProductModelExportXLSXSettings = Z.infer<typeof ProductModelExportXLSXSettings>

export const ProductModelExportCSVSettings = GlobalProductModelExportSettings.extend({
    delimiter: Z.string().default(";"),
    enclosure: Z.string().default("\"")
})
export type ProductModelExportCSVSettings = Z.infer<typeof ProductModelExportCSVSettings>

export const ExportProfile = BaseJobProfile.extend({
    job: ExportJobs,
})
export type ExportProfile = Z.infer<typeof ExportProfile>

export const ExportJob = BaseJob.extend({
    job: ExportJobs
})
export type ExportJob = Z.infer<typeof ExportJob>
/**
 * EXPORT MODELS - END
 */

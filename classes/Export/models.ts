import Z from "zod";
import {Locales} from "ConstantsPackage";

export const Code = Z.string().min(1).max(100).regex(new RegExp(/^([A-Za-z0-9_])*$/g))

export const Locale = Z.string().refine((val) => Locales.findIndex(l => l.id === val) !== -1,
    "Invalid locale value!")

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

export const ExportConnectors = Z.enum([
    "xlsx",
    "csv"
])

export const ExportProfileContent = Z.object({
    channel: Code,
    locales: Z.array(Locale).min(1),
    attributes: Z.array(Code).default([])
})

export const GlobalProductModelExportSettings = Z.object({
    decimalSeparator: Z.enum([",", "."]).default("."),
    dateFormat: Z.enum([
        "yyyy/MM/dd",
        "MM/dd/yyyy",
        "dd/MM/yyyy",
        "yyyy-MM-dd",
        "dd.MM.yyyy"
    ]).default("yyyy-MM-dd"),
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


export const ExportProfile = Z.object({
    code: Code,
    job: ExportJobs,
    connector: ExportConnectors,
    label: Z.string().min(1).max(180),
    globalSettings: Z.any().optional(), // manual validation at business logic level
    createdAt: Z.date().default(new Date())
})
export type ExportProfile = Z.infer<typeof ExportProfile>


export const JobStatus = Z.enum([
    "RUNNING",
    "FAILED",
    "DONE"
])
export type JobStatus = Z.infer<typeof JobStatus>

export const Job = Z.object({
    uid: Z.string().min(32).max(32),
    code: Code,
    connector: ExportConnectors,
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
 *
 *
 */
export interface AttributeOptionLabelItem {
    locale: string
    value: string
}

export interface AttributeOptionItem {
    code: string,
    label: AttributeOptionLabelItem[]
}

export interface AttributeOption {
    code: string
    options: AttributeOptionItem[]
}

interface ProductAttributeItem {
    scope: string
    locale: string
    value: any
}

export interface ProductItem {
    parent?: string
    dataType: string
    data: {
        sku: string
        family: string
        enabled: boolean
        attributes?: { code: string, data: ProductAttributeItem[] }[]
        categories: any[]
        groups: any[]
    }
    meta: {
        createdAt: string,
        updatedAt: string
    }
}


export interface ProductModelItem {
    dataType: string
    data: {
        code: string
        family: string
        variant: string
        attributes?: { code: string, data: ProductAttributeItem[] }[]
        categories: any[]
    }
    meta: {
        createdAt: string,
        updatedAt: string
    }
}


export interface AttributeSettings {
    code: string
    type: "TEXT" | "TEXTAREA" | "BOOLEAN" | "IDENTIFIER" | "NUMBER" | "IMAGE" | "MULTISELECT" | "SIMPLESELECT" | "DATE" | "PRICE"
    group: string
    localizable: boolean
    scopable: boolean
    isLocaleSpecific: boolean
    availableLocales: string[]
    isUnique: boolean
}


export interface Category {
    code: string
    label: { locale: string, value: string }[]
    subCategories: Category[]
}

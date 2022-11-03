import Z from "zod"
import {Code, ProductCategoryCode} from "./common-models";


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
    attributes: Z.array(ProductAttribute).optional()
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
    attributes: Z.array(ProductAttribute).optional()
})
export type ProductModel = Z.infer<typeof ProductModel>


export const AxeValueItem = Z.object({
    axe: Code,
    value: Z.string()
})
export const AxesValuesList = Z.array(AxeValueItem)
export type AxesValuesList = Z.infer<typeof AxesValuesList>

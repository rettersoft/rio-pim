import * as XLSX from "xlsx";
import RDK from "@retter/rdk";
import {Classes, DataType} from "./rio";
import {ExportJob, Product, ProductModel} from "PIMModelsPackage";

const rdk = new RDK();
const JOB_PART_KEY_PREFIX = "ExportJob"
const EXECUTION_LOCK_KEY = "EXPORT_EXECUTION_TASK"


export interface ProductItem {
    parent?: string
    dataType: string
    data: Product
    meta: {
        createdAt: string,
        updatedAt: string
    }
}


export interface ProductModelItem {
    dataType: string
    data: ProductModel
    meta: {
        createdAt: string,
        updatedAt: string
    }
}


export function getJobPartKey(accountId: string, profileCode: string) {
    return [JOB_PART_KEY_PREFIX, accountId, profileCode].join("!")
}

export function generateJobId() {
    return Date.now().toString(36)
}

export async function json2XLSX(json: object[]): Promise<Buffer> {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(json, {})
    XLSX.utils.book_append_sheet(workbook, worksheet)
    return XLSX.write(workbook, {type: "buffer"})
}

export async function json2CSV(json: object[]): Promise<Buffer> {
    const worksheet = XLSX.utils.json_to_sheet(json, {})
    const result = XLSX.utils.sheet_to_csv(worksheet, {})
    return Buffer.from(result)
}

export async function getCurrentExecution(): Promise<ExportJob> {
    const res = await rdk.getMemory({key: EXECUTION_LOCK_KEY})
    if (!res.success) {
        return undefined
    } else {
        return res.data
    }
}

export async function lockExecution(job: ExportJob) {
    await rdk.setMemory({key: EXECUTION_LOCK_KEY, value: job})
}

export async function unlockExecution() {
    await rdk.deleteMemory({key: EXECUTION_LOCK_KEY})
}


export async function saveJobToDB(job: ExportJob, accountId: string) {
    await rdk.writeToDatabase({
        data: job, partKey: getJobPartKey(accountId, job.code), sortKey: job.uid
    })
}

export async function getJobFromDB(accountId: string, jobCode: string, jobId: string): Promise<ExportJob | undefined> {
    const resp = await rdk.readDatabase({
        partKey: getJobPartKey(accountId, jobCode), sortKey: jobId
    })
    if (resp.success) {
        return resp.data.data
    } else {
        return undefined
    }
}

export function getExportFileName(accountId: string, jobCode: string, jobId: string, connector: string) {
    return [accountId, jobCode, jobId].join('-') + '.' + connector
}


export async function getAllProducts(accountId: string): Promise<ProductItem[]> {
    let products = []
    let next = true
    while (next) {
        const res = await getProductsFromAPI(accountId, products.length)
        if (!res || !res.products || res.products.length === 0) {
            next = false
        } else {
            products = [...products, ...res.products]
        }
    }
    return products.map(p => p.source)
}

async function getProductsFromAPI(accountId: string, pageFrom = 0): Promise<{
    pageFrom: null
    pageSize: null
    totalProducts: number
    products: object[]
}> {
    const res = await new Classes.API(accountId).getProducts({pageFrom, filters: {dataType: DataType.Product}})
    if (res.statusCode >= 400) {
        throw new Error("Product get error!")
    }
    return res.body
}


export async function getAllProductModels(accountId: string): Promise<ProductModelItem[]> {
    let products = []
    let next = true
    while (next) {
        const res = await getProductModelsFromAPI(accountId, products.length)
        if (!res || !res.products || res.products.length === 0) {
            next = false
        } else {
            products = [...products, ...res.products]
        }
    }
    return products.map(p => p.source)
}

async function getProductModelsFromAPI(accountId: string, pageFrom = 0): Promise<{
    pageFrom: null
    pageSize: null
    totalProducts: number
    products: object[]
}> {
    const res = await new Classes.API(accountId).getProducts({pageFrom, filters: {dataType: DataType.ProductModel}})
    if (res.statusCode >= 400) {
        throw new Error("Product get error!")
    }
    return res.body
}


export async function getCatalogSettings(accountId: string): Promise<{
    categories: any[]
    enabledCurrencies: string[]
    enabledLocales: string[]
    channels: any[]
}> {
    const result = await new Classes.CatalogSettings(accountId).getCatalogSettings()
    if (result.statusCode >= 400) {
        throw new Error("Catalog settings error!")
    }

    return result.body
}

export async function getExecutionsByJobCode(accountId: string, jobCode: string): Promise<ExportJob[] | undefined> {
    const results = await rdk.queryDatabase({
        partKey: getJobPartKey(accountId, jobCode)
    })

    if (results.success && results.data.items && results.data.items.length) {
        return results.data.items.map(i => i.data)
    } else {
        return undefined
    }
}

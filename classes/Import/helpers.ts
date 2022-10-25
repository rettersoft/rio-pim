import * as XLSX from "xlsx";
import RDK from "@retter/rdk";
import {Job} from "./models";
import {Classes} from "./rio";

const rdk = new RDK();
const JOB_PART_KEY_PREFIX = "ImportJob"
const EXECUTION_LOCK_KEY = "IMPORT_EXECUTION_TASK"


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

export async function getCurrentExecution(): Promise<Job> {
    const res = await rdk.getMemory({key: EXECUTION_LOCK_KEY})
    if (!res.success) {
        return undefined
    } else {
        return res.data
    }
}

export async function lockExecution(job: Job) {
    await rdk.setMemory({key: EXECUTION_LOCK_KEY, value: job})
}

export async function unlockExecution() {
    await rdk.deleteMemory({key: EXECUTION_LOCK_KEY})
}


export async function saveJobToDB(job: Job, accountId: string) {
    await rdk.writeToDatabase({
        data: job, partKey: getJobPartKey(accountId, job.code), sortKey: job.uid
    })
}

export async function getJobFromDB(accountId: string, jobCode: string, jobId: string): Promise<Job | undefined> {
    const resp = await rdk.readDatabase({
        partKey: getJobPartKey(accountId, jobCode), sortKey: jobId
    })
    if (resp.success) {
        return resp.data.data
    } else {
        return undefined
    }
}

export function getImportFileName(accountId: string, jobCode: string, jobId: string, connector: string) {
    return [accountId, jobCode, jobId].join('-') + '.' + connector
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

export async function getExecutionsByJobCode(accountId: string, jobCode: string): Promise<Job[] | undefined> {
    const results = await rdk.queryDatabase({
        partKey: getJobPartKey(accountId, jobCode)
    })

    if (results.success && results.data.items && results.data.items.length) {
        return results.data.items.map(i => i.data)
    } else {
        return undefined
    }
}

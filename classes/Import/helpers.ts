import * as XLSX from "xlsx";
import RDK from "@retter/rdk";
import {Classes} from "./rio";
import {ImportJob, Label} from "PIMModelsPackage";

const rdk = new RDK();
const JOB_PART_KEY_PREFIX = "ImportJob"
const EXECUTION_LOCK_KEY = "IMPORT_EXECUTION_TASK"


export function getJobPartKey(accountId: string, profileCode: string) {
    return [JOB_PART_KEY_PREFIX, accountId, profileCode].join("!")
}

export function generateJobId() {
    return Date.now().toString(36)
}

export async function XLSX2Json(data: Buffer) {
    const workbook = XLSX.read(data)
    return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
}

export async function CSV2Json(data: Buffer) {
    const workbook = XLSX.read(data)
    return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
}

export async function getCurrentExecution(): Promise<ImportJob> {
    const res = await rdk.getMemory({key: EXECUTION_LOCK_KEY})
    if (!res.success) {
        return undefined
    } else {
        return res.data
    }
}

export async function lockExecution(job: ImportJob) {
    await rdk.setMemory({key: EXECUTION_LOCK_KEY, value: job})
}

export async function unlockExecution() {
    await rdk.deleteMemory({key: EXECUTION_LOCK_KEY})
}


export async function saveJobToDB(job: ImportJob, accountId: string) {
    await rdk.writeToDatabase({
        data: job, partKey: getJobPartKey(accountId, job.code), sortKey: job.uid
    })
}

export async function getJobFromDB(accountId: string, jobCode: string, jobId: string): Promise<ImportJob | undefined> {
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

export async function getExecutionsByJobCode(accountId: string, jobCode: string): Promise<ImportJob[] | undefined> {
    const results = await rdk.queryDatabase({
        partKey: getJobPartKey(accountId, jobCode)
    })

    if (results.success && results.data.items && results.data.items.length) {
        return results.data.items.map(i => i.data)
    } else {
        return undefined
    }
}

export function getLabelsFromImportedFileItem(item: any) {
    const label: Label = []
    for (const key of Object.keys(item)) {
        if (key.startsWith("label-")) {
            const splits = key.split("-")
            if (splits.length === 0 || splits.length === 1) {
                throw new Error("Invalid label format!")
            }
            label.push({
                locale: splits[1],
                value: item[key]
            })
        }
    }
    return label
}

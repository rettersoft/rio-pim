import * as XLSX from "xlsx";
import RDK from "@retter/rdk";
import {Job} from "./models";

const rdk = new RDK();
const JOB_PART_KEY_PREFIX = "ExportJob"
const EXECUTION_LOCK_KEY = "EXPORT_EXECUTION"


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
        return resp.data
    } else {
        return undefined
    }
}

export function getExportFileName(accountId: string, jobCode: string, jobId: string, connector: string) {
    return [accountId, jobCode, jobId].join('-') + '.' + connector
}

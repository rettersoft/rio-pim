import RDK, {Data, Response} from "@retter/rdk";
import {AccountIDInput, Classes} from "./rio";
import {
    AttributeGroupImportItem,
    AttributeOptionImportItem,
    BaseAttributeImportModel,
    CategoryImportItem,
    Code, FamilyImportItem, FamilyVariantImportItem,
    GlobalProductImportSettings,
    GlobalProductModelImportSettings, GroupImportItem, GroupTypeImportItem,
    ImportConnectors,
    ImportJobs,
    ImportProfile,
    Job,
    JobStatus,
    ProductImportCSVSettings,
    ProductImportItem,
    ProductImportXLSXSettings,
    ProductModelImportCSVSettings, ProductModelImportItem,
    ProductModelImportXLSXSettings
} from "./models";
import {
    CSV2Json,
    generateJobId,
    getCurrentExecution,
    getExecutionsByJobCode,
    getImportFileName,
    getJobFromDB,
    getJobPartKey,
    lockExecution,
    saveJobToDB,
    unlockExecution,
    XLSX2Json
} from "./helpers";

const rdk = new RDK();

export interface ImportPrivateState {
    profiles: ImportProfile[]
}

export interface ImportPublicState {
}

export type ImportData<Input = any, Output = any> = Data<Input, Output, ImportPublicState, ImportPrivateState>

export async function authorizer(data: ImportData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"
    const isThisClassInstance = data.context.identity === 'Import' && data.context.userId === data.context.instanceId

    if (isDeveloper) {
        return {statusCode: 200}
    }

    if ([
        "upsertImportProfile",
        "deleteImportProfile",
        "getImportProfiles",
        "getImportProfileExecutions",
        "startImport",
        "executeImport",
        "getExecution",
        "getUploadedFile",
    ].includes(data.context.methodName)) {
        return {statusCode: 200}
    }

    switch (data.context.methodName) {
        case 'executeImport':
            if (isThisClassInstance) {
                return {statusCode: 200}
            }
            break
        case 'DESTROY':
            if (data.context.identity === "AccountManager") {
                return {statusCode: 200}
            }
            break
        case 'STATE':
            if (isDeveloper) return {statusCode: 200}
            break
        case 'GET':
            return {statusCode: 200}
        case 'INIT':
            if (data.context.identity === "AccountManager" || isDeveloper) {
                return {statusCode: 200}
            }
            break
    }
    return {statusCode: 401};
}

export async function getInstanceId(data: ImportData<AccountIDInput>): Promise<string> {
    return data.request.body.accountId
}

export async function init(data: ImportData): Promise<ImportData> {
    data.state.private = {
        profiles: [],
    }
    return data
}

export async function getState(data: ImportData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

export async function upsertImportProfile(data: ImportData): Promise<ImportData> {
    const result = ImportProfile.safeParse(data.request.body.profile)
    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: result.error
            }
        }
        return data
    }

    switch (result.data.job) {
        case ImportJobs.Enum.product_import:
            const globalSettingsResultForProduct = GlobalProductImportSettings.safeParse(result.data.globalSettings || {})
            if (globalSettingsResultForProduct.success === false) {
                data.response = {
                    statusCode: 400,
                    body: {
                        message: "Model validation error! (Global Settings)",
                        error: globalSettingsResultForProduct.error
                    }
                }
                return data
            }

            if (result.data.connector === ImportConnectors.Enum.xlsx) {
                const checkSettings = ProductImportXLSXSettings.safeParse(globalSettingsResultForProduct.data)
                if (checkSettings.success === false) {
                    data.response = {
                        statusCode: 400,
                        body: {
                            message: "Model validation error! (Product XLSX Settings)",
                            error: checkSettings.error
                        }
                    }
                    return data
                }
                result.data.globalSettings = checkSettings.data
            } else if (result.data.connector === ImportConnectors.Enum.csv) {
                const checkSettings = ProductImportCSVSettings.safeParse(globalSettingsResultForProduct.data)
                if (checkSettings.success === false) {
                    data.response = {
                        statusCode: 400,
                        body: {
                            message: "Model validation error! (Product CSV Settings)",
                            error: checkSettings.error
                        }
                    }
                    return data
                }
                result.data.globalSettings = checkSettings.data
            }
            break
        case ImportJobs.Enum.product_model_import:
            const globalSettingsResultForProductModel = GlobalProductModelImportSettings.safeParse(result.data.globalSettings || {})
            if (globalSettingsResultForProductModel.success === false) {
                data.response = {
                    statusCode: 400,
                    body: {
                        message: "Model validation error! (Global Settings)",
                        error: globalSettingsResultForProductModel.error
                    }
                }
                return data
            }


            if (result.data.connector === ImportConnectors.Enum.xlsx) {
                const checkSettings = ProductModelImportXLSXSettings.safeParse(globalSettingsResultForProductModel.data)
                if (checkSettings.success === false) {
                    data.response = {
                        statusCode: 400,
                        body: {
                            message: "Model validation error! (Product Model XLSX Settings)",
                            error: checkSettings.error
                        }
                    }
                    return data
                }
                result.data.globalSettings = checkSettings.data
            } else if (result.data.connector === ImportConnectors.Enum.csv) {
                const checkSettings = ProductModelImportCSVSettings.safeParse(globalSettingsResultForProductModel.data)
                if (checkSettings.success === false) {
                    data.response = {
                        statusCode: 400,
                        body: {
                            message: "Model validation error! (Product Model CSV Settings)",
                            error: checkSettings.error
                        }
                    }
                    return data
                }
                result.data.globalSettings = checkSettings.data
            }
            break
        case ImportJobs.Enum.group_import:
        case ImportJobs.Enum.category_import:
        case ImportJobs.Enum.attribute_import:
        case ImportJobs.Enum.attribute_option_import:
        case ImportJobs.Enum.attribute_group_import:
        case ImportJobs.Enum.family_import:
        case ImportJobs.Enum.family_variant_import:
        case ImportJobs.Enum.group_type_import:
            result.data.globalSettings = undefined
            break
        default:
            throw new Error("Invalid job!")
    }

    const profileIndex = data.state.private.profiles.findIndex(p => p.code === result.data.code)

    if (profileIndex === -1) {
        data.state.private.profiles.push(result.data)
    } else {
        data.state.private.profiles[profileIndex] = result.data
    }

    return data
}

export async function deleteImportProfile(data: ImportData): Promise<ImportData> {
    const codeResult = Code.safeParse(data.request.body.code)
    if (codeResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: codeResult.error
            }
        }
        return data
    }

    const executions = await getExecutionsByJobCode(data.context.instanceId, codeResult.data)

    const currentExecution = await getCurrentExecution()
    if (currentExecution && currentExecution.code === codeResult.data) {
        await unlockExecution()
    }

    try {
        if (executions.length) {
            const workers = []
            for (const execution of executions) {
                workers.push(rdk.removeFromDatabase({
                    partKey: getJobPartKey(data.context.instanceId, execution.code),
                    sortKey: execution.uid
                }))
                workers.push(rdk.deleteFile({filename: getImportFileName(data.context.instanceId, execution.code, execution.uid, execution.connector)}))
            }
            await Promise.all(workers)
        }
    } catch (e) {
        console.log(e)
    }

    data.state.private.profiles = data.state.private.profiles.filter(p => p.code !== codeResult.data)

    return data
}

export async function getImportProfiles(data: ImportData): Promise<ImportData> {
    data.response = {
        statusCode: 200,
        body: {
            profiles: data.state.private.profiles
        }
    }
    return data
}

export async function getImportProfileExecutions(data: ImportData): Promise<ImportData> {
    const codeResult = Code.safeParse(data.request.body.code)
    if (codeResult.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: codeResult.error
            }
        }
        return data
    }

    const profile = data.state.private.profiles.find(p => p.code === codeResult.data)
    if (!profile) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Profile not found!",
            }
        }
        return data
    }

    let executions = await getExecutionsByJobCode(data.context.instanceId, codeResult.data)

    data.response = {
        statusCode: 200,
        body: {
            profile,
            executions
        }
    }
    return data
}


export async function getExecution(data: ImportData): Promise<ImportData> {
    const jobId = data.request.body.jobId
    const jobCode = data.request.body.jobCode
    if (!jobId || jobId === "") {
        data.response = {
            statusCode: 400,
            body: {
                message: "Job id is required!",
            }
        }
        return data
    }
    if (!jobCode || jobCode === "") {
        data.response = {
            statusCode: 400,
            body: {
                message: "Job code is required!",
            }
        }
        return data
    }


    const result = await getJobFromDB(data.context.instanceId, jobCode, jobId)

    if (!result) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Job not found!"
            }
        }
        return data
    }

    data.response = {
        statusCode: 200,
        body: result
    }

    return data
}


export async function startImport(data: ImportData): Promise<ImportData> {
    const jobCode = Code.safeParse(data.request.body.code)
    if (jobCode.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Model validation error!",
                error: jobCode.error
            }
        }
        return data
    }

    const currentExecution = await getCurrentExecution()

    if (!!currentExecution) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Execution already in use!"
            }
        }
        return data
    }

    const jobSettings = data.state.private.profiles.find(p => p.code === jobCode.data)
    if (!jobSettings) {
        throw new Error("Job settings not found!")
    }

    const job: Job = {
        uid: generateJobId(),
        status: JobStatus.Enum.RUNNING,
        connector: jobSettings.connector,
        code: jobCode.data,
        startedAt: new Date(),
        failed: 0,
        processed: 0,
    }

    await lockExecution(job)
    await saveJobToDB(job, data.context.instanceId)

    await rdk.setFile({
        filename: getImportFileName(data.context.instanceId, jobCode.data, job.uid, job.connector),
        body: data.request.body.file
    })

    const result: any = await new Classes.Import(data.context.instanceId).executeImport()

    if (result.statusCode >= 400) {
        data.response = {
            statusCode: result.statusCode,
            body: result.body
        }
        job.status = JobStatus.Enum.FAILED
        await saveJobToDB(job, data.context.instanceId)
        await unlockExecution()
        return data
    }

    data.response = {
        statusCode: 200,
        body: job
    }

    return data
}

export async function executeImport(data: ImportData): Promise<ImportData> {
    const job: Job = await getCurrentExecution()

    const jobSettings = data.state.private.profiles.find(p => p.code === job.code)
    if (!jobSettings) {
        throw new Error("Job settings not found!")
    }

    try {
        const importFile = await rdk.getFile({filename: getImportFileName(data.context.instanceId, job.code, job.uid, job.connector)})
        if (!importFile.success) {
            throw new Error("Import file not found!")
        }

        let importData: any[] = [];
        switch (jobSettings.connector) {
            case ImportConnectors.Enum.csv:
                importData = await CSV2Json(importFile.data)
                break
            case ImportConnectors.Enum.xlsx:
                importData = await XLSX2Json(importFile.data)
                break
            default:
                throw new Error("invalid job connector!")
        }

        job.total = importData.length

        if (importData.length) {
            switch (jobSettings.job) {
                case ImportJobs.Enum.product_import:
                    for (const item of importData) {
                        const itemModel = ProductImportItem.safeParse(item)
                        if (itemModel.success === false) {
                            job.failed += 1
                        }
                    }
                    break
                case ImportJobs.Enum.product_model_import:
                    for (const item of importData) {
                        const itemModel = ProductModelImportItem.safeParse(item)
                        if (itemModel.success === false) {
                            job.failed += 1
                        }
                    }
                    break
                case ImportJobs.Enum.group_type_import:
                    for (const item of importData) {
                        const itemModel = GroupTypeImportItem.safeParse(item)
                        if (itemModel.success === false) {
                            job.failed += 1
                        }
                    }
                    break
                case ImportJobs.Enum.group_import:
                    for (const item of importData) {
                        const itemModel = GroupImportItem.safeParse(item)
                        if (itemModel.success === false) {
                            job.failed += 1
                        }
                    }
                    break
                case ImportJobs.Enum.category_import:
                    for (const item of importData) {
                        const itemModel = CategoryImportItem.safeParse(item)
                        if (itemModel.success === false) {
                            job.failed += 1
                        }
                    }
                    break
                case ImportJobs.Enum.attribute_import:
                    for (const item of importData) {
                        const itemModel = BaseAttributeImportModel.safeParse(item)
                        if (itemModel.success === false) {
                            job.failed += 1
                        }
                    }
                    break
                case ImportJobs.Enum.attribute_option_import:
                    for (const item of importData) {
                        const itemModel = AttributeOptionImportItem.safeParse(item)
                        if (itemModel.success === false) {
                            job.failed += 1
                        }
                    }
                    break
                case ImportJobs.Enum.attribute_group_import:
                    for (const item of importData) {
                        const itemModel = AttributeGroupImportItem.safeParse(item)
                        if (itemModel.success === false) {
                            job.failed += 1
                        }
                    }
                    break
                case ImportJobs.Enum.family_import:
                    for (const item of importData) {
                        const itemModel = FamilyImportItem.safeParse(item)
                        if (itemModel.success === false) {
                            job.failed += 1
                        }
                    }
                    break
                case ImportJobs.Enum.family_variant_import:
                    for (const item of importData) {
                        const itemModel = FamilyVariantImportItem.safeParse(item)
                        if (itemModel.success === false) {
                            job.failed += 1
                        }
                    }
                    break
                default:
                    throw new Error("Invalid job!")
            }

        } else {
            job.status = JobStatus.Enum.DONE
            job.finishedAt = new Date()
        }

        await saveJobToDB(job, data.context.instanceId)
        await unlockExecution()

        data.response = {
            statusCode: 200,
            body: {
                job
            }
        }

    } catch (e) {
        job.processed = 0
        job.failed = job.total
        job.failReason = e.toString()
        job.status = JobStatus.Enum.FAILED
        job.finishedAt = new Date()

        await saveJobToDB(job, data.context.instanceId)
        await unlockExecution()

        data.response = {
            statusCode: 200,
            body: {
                status: "FAILED",
                job,
                message: e.toString()
            }
        }
    }

    return data
}

export async function getUploadedFile(data: ImportData): Promise<ImportData> {
    const jobId = data.request.queryStringParams.jobId
    const jobCode = data.request.queryStringParams.jobCode
    if (!jobId || jobId === "") {
        data.response = {
            statusCode: 400,
            body: {
                message: "Job id is required!",
            }
        }
        return data
    }
    if (!jobCode || jobCode === "") {
        data.response = {
            statusCode: 400,
            body: {
                message: "Job code is required!",
            }
        }
        return data
    }


    const jobSettings = data.state.private.profiles.find(p => p.code === jobCode)
    if (!jobSettings) {
        throw new Error("Job settings not found!")
    }

    const jobDetail = await getJobFromDB(data.context.instanceId, jobCode, jobId)

    if (!jobDetail) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Job detail not found!"
            }
        }
        return data
    }

    const filename = getImportFileName(data.context.instanceId, jobCode, jobId, jobSettings.connector)

    const file = await rdk.getFile({filename})

    if (!file.success) {
        data.response = {
            statusCode: 404,
            body: {
                message: "File not found!"
            }
        }
        return data
    }

    data.response = {
        statusCode: 200,
        isBase64Encoded: true,
        body: file.data.toString("base64"),
        headers: {
            "Content-Type": jobSettings.connector === ImportConnectors.Enum.xlsx ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv",
            "Content-Disposition": `attachment; filename="${filename}"`
        }

    }

    return data
}

import {Data, Response} from "@retter/rdk";
import {AccountIDInput} from "./rio";
import {
    Code,
    GlobalProductImportSettings, GlobalProductModelImportSettings,
    ImportConnectors,
    ImportJobs,
    ImportProfile,
    JobStatus,
    ProductImportCSVSettings,
    ProductImportXLSXSettings,
    ProductModelImportCSVSettings,
    ProductModelImportXLSXSettings
} from "./models";
import RDK from "@retter/rdk";
import {getExecutionPartKey} from "./helpers";
const rdk = new RDK();

export interface ImportPrivateState {
    profiles: ImportProfile[]
}

export interface ImportPublicState {
    runningJob?: {
        code: string
        startedAt: string
        status: JobStatus
        total: number
        processed: number
        failed: number
    }
}

export type ImportData<Input = any, Output = any> = Data<Input, Output, ImportPublicState, ImportPrivateState>

export async function authorizer(data: ImportData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"
    const isThisClassInstance =  data.context.identity === 'Import' && data.context.userId === data.context.instanceId

    if (isDeveloper) {
        return {statusCode: 200}
    }

    if ([
        "upsertImportProfile",
        "deleteImportProfile",
        "getImportProfiles",
        "getImportProfileExecutions",
        "startImport"
    ].includes(data.context.methodName)) {
        return {statusCode: 200}
    }

    switch (data.context.methodName) {
        case 'executeImport':
            if(isThisClassInstance){
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

    const dbResults = await rdk.queryDatabase({
        partKey: getExecutionPartKey(data.context.instanceId, codeResult.data),
        reverse: true
    })

    if(dbResults && dbResults.data && dbResults.data.items){
        //TODO delete execution
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

    const results = await rdk.queryDatabase({
        partKey: getExecutionPartKey(data.context.instanceId, codeResult.data),
        reverse: true
    })

    data.response = {
        statusCode: 200,
        body: {
            profile,
            executions: results.data
        }
    }
    return data
}

export async function startImport(data: ImportData): Promise<ImportData> {
    if(data.state.public.runningJob){
        data.response = {
            statusCode: 400,
            body: {
                message: `Import execution already in use! (${data.state.public.runningJob.code})`
            }
        }
        return data
    }

    // TODO set file - update state -  call execute import

    return data
}

export async function executeImport(data: ImportData): Promise<ImportData> {

    const runningJonDetail = data.state.private.profiles.find(p=>p.code === data.state.public.runningJob.code)
    if(!runningJonDetail){
        data.state.public.runningJob = undefined
        return data
    }

    //TODO import file

    switch (data.state.public.runningJob.code) {
        case ImportJobs.Enum.product_import:
            break
        case ImportJobs.Enum.product_model_import:
            break
        case ImportJobs.Enum.group_import:
        case ImportJobs.Enum.category_import:
        case ImportJobs.Enum.attribute_import:
        case ImportJobs.Enum.attribute_option_import:
        case ImportJobs.Enum.attribute_group_import:
        case ImportJobs.Enum.family_import:
        case ImportJobs.Enum.family_variant_import:
        case ImportJobs.Enum.group_type_import:
            break
        default:
            throw new Error("Invalid job!")
    }

    return data
}

import RDK, {Data, Response} from "@retter/rdk";
import {AccountIDInput, Classes} from "./rio";
import {
    CSV2Json,
    generateJobId,
    getCurrentExecution,
    getExecutionsByJobCode,
    getImportFileName,
    getJobFromDB,
    getJobPartKey,
    getLabelsFromImportedFileItem,
    lockExecution,
    saveJobToDB,
    unlockExecution,
    XLSX2Json
} from "./helpers";
import {
    AttributeGroup,
    AttributeOption,
    AttributeOptionItem,
    AttributeTypes,
    BaseAttribute,
    Category,
    Code,
    Connectors,
    DataType,
    Family,
    FamilyAttribute,
    FamilyVariant,
    GlobalProductImportSettings,
    GlobalProductModelImportSettings,
    Group,
    GroupType,
    ImportJob,
    ImportJobs,
    ImportProfile,
    JobStatus,
    Product,
    ProductAttribute,
    ProductImportCSVSettings,
    ProductImportXLSXSettings,
    ProductModel,
    ProductModelImportCSVSettings,
    ProductModelImportXLSXSettings,
    SpecificAttributes
} from "PIMModelsPackage";
import {
    AttributeGroupImportItem,
    AttributeOptionImportItem,
    BaseAttributeImportModel,
    CategoryImportItem,
    FamilyImportItem,
    FamilyVariantImportItem,
    GroupImportItem,
    GroupTypeImportItem,
    ProductImportItem,
    ProductModelImportItem,
    SpecificAttributesImportModel
} from "./custom-models";
import _ from "lodash";

const rdk = new RDK();

export interface ImportPrivateState {
    profiles: ImportProfile[]
}

export interface ImportPublicState {
    runningJob?: ImportJob
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
        case 'importProcess':
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
        profiles: [
            {
                code: "attribute_import_xlsx",
                job: ImportJobs.Enum.attribute_import,
                label: "Attributes Import XLSX",
                connector: Connectors.Enum.xlsx,
                createdAt: new Date()
            },
            {
                code: "attribute_group_import_xlsx",
                job: ImportJobs.Enum.attribute_group_import,
                label: "Attribute Groups Import XLSX",
                connector: Connectors.Enum.xlsx,
                createdAt: new Date()
            },
            {
                code: "attribute_option_import_xlsx",
                job: ImportJobs.Enum.attribute_option_import,
                label: "Attribute Options Import XLSX",
                connector: Connectors.Enum.xlsx,
                createdAt: new Date()
            },
            {
                code: "category_import_xlsx",
                job: ImportJobs.Enum.category_import,
                label: "Categories Import XLSX",
                connector: Connectors.Enum.xlsx,
                createdAt: new Date()
            },
            {
                code: "group_import_xlsx",
                job: ImportJobs.Enum.group_import,
                label: "Groups Import XLSX",
                connector: Connectors.Enum.xlsx,
                createdAt: new Date()
            },
            {
                code: "group_type_import_xlsx",
                job: ImportJobs.Enum.group_type_import,
                label: "Group Types Import XLSX",
                connector: Connectors.Enum.xlsx,
                createdAt: new Date()
            },
            {
                code: "family_import_xlsx",
                job: ImportJobs.Enum.family_import,
                label: "Families Import XLSX",
                connector: Connectors.Enum.xlsx,
                createdAt: new Date()
            },
            {
                code: "family_variant_import_xlsx",
                job: ImportJobs.Enum.family_variant_import,
                label: "Family Variants Import XLSX",
                connector: Connectors.Enum.xlsx,
                createdAt: new Date()
            },

            {
                code: "attribute_import_csv",
                job: ImportJobs.Enum.attribute_import,
                label: "Attributes Import CSV",
                connector: Connectors.Enum.csv,
                createdAt: new Date()
            },
            {
                code: "attribute_group_import_csv",
                job: ImportJobs.Enum.attribute_group_import,
                label: "Attribute Groups Import CSV",
                connector: Connectors.Enum.csv,
                createdAt: new Date()
            },
            {
                code: "attribute_option_import_csv",
                job: ImportJobs.Enum.attribute_option_import,
                label: "Attribute Options Import CSV",
                connector: Connectors.Enum.csv,
                createdAt: new Date()
            },
            {
                code: "category_import_csv",
                job: ImportJobs.Enum.category_import,
                label: "Categories Import CSV",
                connector: Connectors.Enum.csv,
                createdAt: new Date()
            },
            {
                code: "group_import_csv",
                job: ImportJobs.Enum.group_import,
                label: "Groups Import CSV",
                connector: Connectors.Enum.csv,
                createdAt: new Date()
            },
            {
                code: "group_type_import_csv",
                job: ImportJobs.Enum.group_type_import,
                label: "Group Types Import CSV",
                connector: Connectors.Enum.csv,
                createdAt: new Date()
            },
            {
                code: "family_import_csv",
                job: ImportJobs.Enum.family_import,
                label: "Families Import CSV",
                connector: Connectors.Enum.csv,
                createdAt: new Date()
            },
            {
                code: "family_variant_import_csv",
                job: ImportJobs.Enum.family_variant_import,
                label: "Family Variants Import CSV",
                connector: Connectors.Enum.csv,
                createdAt: new Date()
            },
        ],
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

            if (result.data.connector === Connectors.Enum.xlsx) {
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
            } else if (result.data.connector === Connectors.Enum.csv) {
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


            if (result.data.connector === Connectors.Enum.xlsx) {
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
            } else if (result.data.connector === Connectors.Enum.csv) {
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

    const job: ImportJob = {
        uid: generateJobId(),
        job: jobSettings.job,
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
    const job: ImportJob = await getCurrentExecution()

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
            case Connectors.Enum.csv:
                importData = await CSV2Json(importFile.data)
                break
            case Connectors.Enum.xlsx:
                importData = await XLSX2Json(importFile.data)
                break
            default:
                throw new Error("invalid job connector!")
        }

        job.total = importData.length

        let getProductsSettingsResult;

        if ([ImportJobs.Enum.product_import, ImportJobs.Enum.product_model_import].includes(jobSettings.job)) {
            const res = await new Classes.ProductSettings(data.context.instanceId).getProductSettings()
            if (res.statusCode >= 400) {
                throw new Error("Product settings error!")
            } else {
                getProductsSettingsResult = res.body
            }
        }

        if (importData.length) {
            switch (jobSettings.job) {
                case ImportJobs.Enum.product_import:
                    for (const item of importData) {
                        const itemModel = ProductImportItem.safeParse(item)
                        if (itemModel.success === false) {
                            job.failed += 1
                        } else {
                            await new Classes.Import(data.context.instanceId).importProcess({
                                item,
                                attributes: getProductsSettingsResult.productSettings.attributes,
                                job
                            })
                        }
                    }
                    break
                case ImportJobs.Enum.product_model_import:
                    for (const item of importData) {
                        const itemModel = ProductModelImportItem.safeParse(item)
                        if (itemModel.success === false) {
                            job.failed += 1
                        } else {
                            await new Classes.Import(data.context.instanceId).importProcess({
                                item,
                                attributes: getProductsSettingsResult.productSettings.attributes,
                                job
                            })
                        }
                    }
                    break
                case ImportJobs.Enum.group_type_import:
                    const groupTypesRequestData: GroupType[] = []
                    for (const item of importData) {
                        const groupTypeImportItem = GroupTypeImportItem.safeParse(item)
                        if (groupTypeImportItem.success === false) {
                            job.failed += 1
                        } else {
                            const groupTypeData = GroupType.safeParse({
                                code: groupTypeImportItem.data.code,
                                label: getLabelsFromImportedFileItem(item)
                            })
                            if (groupTypeData.success === false) {
                                job.failed += 1
                            } else {
                                groupTypesRequestData.push(groupTypeData.data)
                            }
                        }
                    }
                    if (groupTypesRequestData.length) {
                        try {
                            const res = await new Classes.ProductSettings(data.context.instanceId).upsertGroupTypes({
                                groupTypes: groupTypesRequestData
                            })
                            if (res.statusCode >= 400) {
                                job.failed += groupTypesRequestData.length
                                job.failReason = res.body.message || "unhandled error"
                                job.status = JobStatus.Enum.FAILED
                            } else {
                                job.processed = groupTypesRequestData.length
                                job.status = JobStatus.Enum.DONE
                            }
                        } catch (e) {
                            job.failed += groupTypesRequestData.length
                            job.failReason = e.toString()
                            job.status = JobStatus.Enum.FAILED
                        }
                    }
                    break
                case ImportJobs.Enum.group_import:
                    const groupsRequestData: Group[] = []
                    for (const item of importData) {
                        const groupImportItem = GroupImportItem.safeParse(item)
                        if (groupImportItem.success === false) {
                            job.failed += 1
                        } else {
                            const groupData = Group.safeParse({
                                code: groupImportItem.data.code,
                                type: groupImportItem.data.type,
                                label: getLabelsFromImportedFileItem(item)
                            })
                            if (groupData.success === false) {
                                job.failed += 1
                            } else {
                                groupsRequestData.push(groupData.data)
                            }
                        }
                    }
                    if (groupsRequestData.length) {
                        try {
                            const res = await new Classes.ProductSettings(data.context.instanceId).upsertGroups({
                                groups: groupsRequestData
                            })
                            if (res.statusCode >= 400) {
                                job.failed += groupsRequestData.length
                                job.failReason = res.body.message || "unhandled error"
                                job.status = JobStatus.Enum.FAILED
                            } else {
                                job.processed = groupsRequestData.length
                                job.status = JobStatus.Enum.DONE
                            }
                        } catch (e) {
                            job.failed += groupsRequestData.length
                            job.failReason = e.toString()
                            job.status = JobStatus.Enum.FAILED
                        }
                    }
                    break
                case ImportJobs.Enum.category_import:
                    const preVerifiedData = []
                    for (const item of importData) {
                        const categoryImportItem = CategoryImportItem.safeParse(item)
                        if (categoryImportItem.success === false) {
                            job.failed += 1
                        } else {
                            preVerifiedData.push(item)
                        }
                    }
                    const buildCategoryTree = (items, parent) => {
                        return items.map(item => {
                            if (item.parent === parent) {
                                return {
                                    code: item.code.split("#").pop(),
                                    subCategories: buildCategoryTree(items, item.code).filter(Boolean)
                                }
                            }
                        }).filter(Boolean)
                    }
                    const categoryTrees = preVerifiedData.filter(item => !item.parent).map(item => {
                        return {
                            code: item.code,
                            subCategories: buildCategoryTree(preVerifiedData.filter(item => item.parent), item.code)
                        }
                    })

                    const categoriesRequestData: Category[] = []
                    for (const categoryTree of categoryTrees) {
                        const categoryData = Category.safeParse(categoryTree)
                        if (categoryData.success === false) {
                            job.failed += 1
                        } else {
                            categoriesRequestData.push(categoryData.data)
                        }
                    }

                    if (categoriesRequestData.length) {
                        try {
                            const res = await new Classes.CatalogSettings(data.context.instanceId).upsertCategories({
                                categories: categoriesRequestData
                            })
                            if (res.statusCode >= 400) {
                                job.failed += categoriesRequestData.length
                                job.failReason = res.body.message || "unhandled error"
                                job.status = JobStatus.Enum.FAILED
                            } else {
                                job.processed = categoriesRequestData.length
                                job.status = JobStatus.Enum.DONE
                            }
                        } catch (e) {
                            job.failed += categoriesRequestData.length
                            job.failReason = e.toString()
                            job.status = JobStatus.Enum.FAILED
                        }
                    }
                    break
                case ImportJobs.Enum.attribute_import:
                    const attributesRequestData: BaseAttribute[] = []
                    for (const item of importData) {
                        const attributeImportItem = BaseAttributeImportModel.safeParse(item)
                        if (attributeImportItem.success === false) {
                            job.failed += 1
                        } else {
                            switch (attributeImportItem.data.type) {
                                case AttributeTypes.Enum.SIMPLESELECT:
                                    const simpleselectImportModel = SpecificAttributesImportModel.SIMPLESELECT.safeParse({...item, ...attributeImportItem.data})
                                    if (simpleselectImportModel.success === false) {
                                        job.failed += 1
                                    } else {
                                        const simpleselectSpecificAttributeModel = SpecificAttributes.SIMPLESELECT.safeParse({
                                            code: simpleselectImportModel.data.code,
                                            type: simpleselectImportModel.data.type,
                                            group: simpleselectImportModel.data.group,
                                            localizable: simpleselectImportModel.data.localizable,
                                            scopable: simpleselectImportModel.data.scopable,
                                            label: getLabelsFromImportedFileItem(simpleselectImportModel),
                                            isLocaleSpecific: simpleselectImportModel.data.isLocaleSpecific,
                                            availableLocales: simpleselectImportModel.data.availableLocales ? simpleselectImportModel.data.availableLocales.split(",") : [],
                                            isUnique: simpleselectImportModel.data.isUnique,
                                        })
                                        if (simpleselectSpecificAttributeModel.success === false) {
                                            job.failed += 1
                                        } else {
                                            attributesRequestData.push(simpleselectSpecificAttributeModel.data)
                                        }
                                    }
                                    break
                                case AttributeTypes.Enum.IMAGE:
                                    const imageImportModel = SpecificAttributesImportModel.IMAGE.safeParse({...item, ...attributeImportItem.data})
                                    if (imageImportModel.success === false) {
                                        job.failed += 1
                                    } else {
                                        const imageSpecificAttributeModel = SpecificAttributes.IMAGE.safeParse({
                                            code: imageImportModel.data.code,
                                            type: imageImportModel.data.type,
                                            group: imageImportModel.data.group,
                                            localizable: imageImportModel.data.localizable,
                                            scopable: imageImportModel.data.scopable,
                                            label: getLabelsFromImportedFileItem(imageImportModel),
                                            isLocaleSpecific: imageImportModel.data.isLocaleSpecific,
                                            availableLocales: imageImportModel.data.availableLocales ? imageImportModel.data.availableLocales.split(",") : [],
                                            isUnique: imageImportModel.data.isUnique,
                                            maxFileSizeInMB: imageImportModel.data.maxFileSizeInMB,
                                            allowedExtensions: imageImportModel.data.allowedExtensions.split(",")
                                        })
                                        if (imageSpecificAttributeModel.success === false) {
                                            job.failed += 1
                                        } else {
                                            attributesRequestData.push(imageSpecificAttributeModel.data)
                                        }
                                    }
                                    break
                                case AttributeTypes.Enum.BOOLEAN:
                                    const booleanImportModel = SpecificAttributesImportModel.BOOLEAN.safeParse({...item, ...attributeImportItem.data})
                                    if (booleanImportModel.success === false) {
                                        job.failed += 1
                                    } else {
                                        const booleanSpecificAttributeModel = SpecificAttributes.BOOLEAN.safeParse({
                                            code: booleanImportModel.data.code,
                                            type: booleanImportModel.data.type,
                                            group: booleanImportModel.data.group,
                                            localizable: booleanImportModel.data.localizable,
                                            scopable: booleanImportModel.data.scopable,
                                            label: getLabelsFromImportedFileItem(booleanImportModel),
                                            isLocaleSpecific: booleanImportModel.data.isLocaleSpecific,
                                            availableLocales: booleanImportModel.data.availableLocales ? booleanImportModel.data.availableLocales.split(",") : [],
                                            isUnique: booleanImportModel.data.isUnique,
                                            defaultValue: booleanImportModel.data.defaultValue
                                        })
                                        if (booleanSpecificAttributeModel.success === false) {
                                            job.failed += 1
                                        } else {
                                            attributesRequestData.push(booleanSpecificAttributeModel.data)
                                        }
                                    }
                                    break
                                case AttributeTypes.Enum.MULTISELECT:
                                    const multiselectImportModel = SpecificAttributesImportModel.MULTISELECT.safeParse({...item, ...attributeImportItem.data})
                                    if (multiselectImportModel.success === false) {
                                        job.failed += 1
                                    } else {
                                        const booleanSpecificAttributeModel = SpecificAttributes.MULTISELECT.safeParse({
                                            code: multiselectImportModel.data.code,
                                            type: multiselectImportModel.data.type,
                                            group: multiselectImportModel.data.group,
                                            localizable: multiselectImportModel.data.localizable,
                                            scopable: multiselectImportModel.data.scopable,
                                            label: getLabelsFromImportedFileItem(multiselectImportModel),
                                            isLocaleSpecific: multiselectImportModel.data.isLocaleSpecific,
                                            availableLocales: multiselectImportModel.data.availableLocales ? multiselectImportModel.data.availableLocales.split(",") : [],
                                            isUnique: multiselectImportModel.data.isUnique,
                                        })
                                        if (booleanSpecificAttributeModel.success === false) {
                                            job.failed += 1
                                        } else {
                                            attributesRequestData.push(booleanSpecificAttributeModel.data)
                                        }
                                    }
                                    break
                                case AttributeTypes.Enum.IDENTIFIER:
                                    const identifierImportModel = SpecificAttributesImportModel.IDENTIFIER.safeParse({...item, ...attributeImportItem.data})
                                    if (identifierImportModel.success === false) {
                                        job.failed += 1
                                    } else {
                                        const identifierSpecificAttributeModel = SpecificAttributes.IDENTIFIER.safeParse({
                                            code: identifierImportModel.data.code,
                                            type: identifierImportModel.data.type,
                                            group: identifierImportModel.data.group,
                                            localizable: identifierImportModel.data.localizable,
                                            scopable: identifierImportModel.data.scopable,
                                            label: getLabelsFromImportedFileItem(identifierImportModel),
                                            isLocaleSpecific: identifierImportModel.data.isLocaleSpecific,
                                            availableLocales: identifierImportModel.data.availableLocales ? identifierImportModel.data.availableLocales.split(",") : [],
                                            isUnique: identifierImportModel.data.isUnique,
                                            maxCharacters: identifierImportModel.data.maxCharacters,
                                            validationRule: identifierImportModel.data.validationRule,
                                            validationRegexp: identifierImportModel.data.validationRegexp,
                                        })
                                        if (identifierSpecificAttributeModel.success === false) {
                                            job.failed += 1
                                        } else {
                                            attributesRequestData.push(identifierSpecificAttributeModel.data)
                                        }
                                    }
                                    break
                                case AttributeTypes.Enum.TEXTAREA:
                                    const textareaImportModel = SpecificAttributesImportModel.TEXTAREA.safeParse({...item, ...attributeImportItem.data})
                                    if (textareaImportModel.success === false) {
                                        job.failed += 1
                                    } else {
                                        const textareaSpecificAttributeModel = SpecificAttributes.TEXTAREA.safeParse({
                                            code: textareaImportModel.data.code,
                                            type: textareaImportModel.data.type,
                                            group: textareaImportModel.data.group,
                                            localizable: textareaImportModel.data.localizable,
                                            scopable: textareaImportModel.data.scopable,
                                            label: getLabelsFromImportedFileItem(textareaImportModel),
                                            isLocaleSpecific: textareaImportModel.data.isLocaleSpecific,
                                            availableLocales: textareaImportModel.data.availableLocales ? textareaImportModel.data.availableLocales.split(",") : [],
                                            isUnique: textareaImportModel.data.isUnique,
                                            maxCharacters: textareaImportModel.data.maxCharacters,
                                        })
                                        if (textareaSpecificAttributeModel.success === false) {
                                            job.failed += 1
                                        } else {
                                            attributesRequestData.push(textareaSpecificAttributeModel.data)
                                        }
                                    }
                                    break
                                case AttributeTypes.Enum.PRICE:
                                    const priceImportModel = SpecificAttributesImportModel.PRICE.safeParse({...item, ...attributeImportItem.data})
                                    if (priceImportModel.success === false) {
                                        job.failed += 1
                                    } else {
                                        const priceSpecificAttributeModel = SpecificAttributes.PRICE.safeParse({
                                            code: priceImportModel.data.code,
                                            type: priceImportModel.data.type,
                                            group: priceImportModel.data.group,
                                            localizable: priceImportModel.data.localizable,
                                            scopable: priceImportModel.data.scopable,
                                            label: getLabelsFromImportedFileItem(priceImportModel),
                                            isLocaleSpecific: priceImportModel.data.isLocaleSpecific,
                                            availableLocales: priceImportModel.data.availableLocales ? priceImportModel.data.availableLocales.split(",") : [],
                                            isUnique: priceImportModel.data.isUnique,
                                            decimalsAllowed: priceImportModel.data.decimalsAllowed,
                                            minNumber: priceImportModel.data.minNumber,
                                            maxNumber: priceImportModel.data.maxNumber,
                                        })
                                        if (priceSpecificAttributeModel.success === false) {
                                            job.failed += 1
                                        } else {
                                            attributesRequestData.push(priceSpecificAttributeModel.data)
                                        }
                                    }
                                    break
                                case AttributeTypes.Enum.DATE:
                                    const dateImportModel = SpecificAttributesImportModel.DATE.safeParse({...item, ...attributeImportItem.data})
                                    if (dateImportModel.success === false) {
                                        job.failed += 1
                                    } else {
                                        const dateSpecificAttributeModel = SpecificAttributes.DATE.safeParse({
                                            code: dateImportModel.data.code,
                                            type: dateImportModel.data.type,
                                            group: dateImportModel.data.group,
                                            localizable: dateImportModel.data.localizable,
                                            scopable: dateImportModel.data.scopable,
                                            label: getLabelsFromImportedFileItem(dateImportModel),
                                            isLocaleSpecific: dateImportModel.data.isLocaleSpecific,
                                            availableLocales: dateImportModel.data.availableLocales ? dateImportModel.data.availableLocales.split(",") : [],
                                            isUnique: dateImportModel.data.isUnique,
                                            minDate: dateImportModel.data.minDate,
                                            maxDate: dateImportModel.data.maxDate,
                                        })
                                        if (dateSpecificAttributeModel.success === false) {
                                            job.failed += 1
                                        } else {
                                            attributesRequestData.push(dateSpecificAttributeModel.data)
                                        }
                                    }
                                    break
                                case AttributeTypes.Enum.NUMBER:
                                    const numberImportModel = SpecificAttributesImportModel.NUMBER.safeParse({...item, ...attributeImportItem.data})
                                    if (numberImportModel.success === false) {
                                        job.failed += 1
                                    } else {
                                        const numberSpecificAttributeModel = SpecificAttributes.NUMBER.safeParse({
                                            code: numberImportModel.data.code,
                                            type: numberImportModel.data.type,
                                            group: numberImportModel.data.group,
                                            localizable: numberImportModel.data.localizable,
                                            scopable: numberImportModel.data.scopable,
                                            label: getLabelsFromImportedFileItem(numberImportModel),
                                            isLocaleSpecific: numberImportModel.data.isLocaleSpecific,
                                            availableLocales: numberImportModel.data.availableLocales ? numberImportModel.data.availableLocales.split(",") : [],
                                            isUnique: numberImportModel.data.isUnique,
                                            negativeAllowed: numberImportModel.data.negativeAllowed,
                                            decimalsAllowed: numberImportModel.data.decimalsAllowed,
                                            minNumber: numberImportModel.data.minNumber,
                                            maxNumber: numberImportModel.data.maxNumber,
                                        })
                                        if (numberSpecificAttributeModel.success === false) {
                                            job.failed += 1
                                        } else {
                                            attributesRequestData.push(numberSpecificAttributeModel.data)
                                        }
                                    }
                                    break
                                case AttributeTypes.Enum.TEXT:
                                    const textImportModel = SpecificAttributesImportModel.TEXT.safeParse({...item, ...attributeImportItem.data})
                                    if (textImportModel.success === false) {
                                        job.failed += 1
                                    } else {
                                        const textSpecificAttributeModel = SpecificAttributes.TEXT.safeParse({
                                            code: textImportModel.data.code,
                                            type: textImportModel.data.type,
                                            group: textImportModel.data.group,
                                            localizable: textImportModel.data.localizable,
                                            scopable: textImportModel.data.scopable,
                                            label: getLabelsFromImportedFileItem(textImportModel),
                                            isLocaleSpecific: textImportModel.data.isLocaleSpecific,
                                            availableLocales: textImportModel.data.availableLocales ? textImportModel.data.availableLocales.split(",") : [],
                                            isUnique: textImportModel.data.isUnique,
                                            maxCharacters: textImportModel.data.maxCharacters,
                                            validationRule: textImportModel.data.validationRule,
                                            validationRegexp: textImportModel.data.validationRegexp,
                                        })
                                        if (textSpecificAttributeModel.success === false) {
                                            job.failed += 1
                                        } else {
                                            attributesRequestData.push(textSpecificAttributeModel.data)
                                        }
                                    }
                                    break
                                default:
                                    job.failed += 1
                                    break
                            }
                        }
                    }
                    if (attributesRequestData.length) {
                        try {
                            const res = await new Classes.ProductSettings(data.context.instanceId).upsertAttributes({
                                attributes: attributesRequestData
                            })
                            if (res.statusCode >= 400) {
                                job.failed += attributesRequestData.length
                                job.failReason = res.body.message || "unhandled error"
                                job.status = JobStatus.Enum.FAILED
                            } else {
                                job.processed = attributesRequestData.length
                                job.status = JobStatus.Enum.DONE
                            }
                        } catch (e) {
                            job.failed += attributesRequestData.length
                            job.failReason = e.toString()
                            job.status = JobStatus.Enum.FAILED
                        }
                    }
                    break
                case ImportJobs.Enum.attribute_option_import:
                    const attributeOptionsPreVerifiedItems = []

                    for (const item of importData) {
                        const attributeOptionImportItem = AttributeOptionImportItem.safeParse(item)
                        if (attributeOptionImportItem.success === false) {
                            job.failed += 1
                        } else {
                            const attributeOptionItemData = AttributeOptionItem.safeParse({
                                code: attributeOptionImportItem.data.code,
                                label: getLabelsFromImportedFileItem(item)
                            })
                            if (attributeOptionItemData.success === false) {
                                job.failed += 1
                            } else {
                                attributeOptionsPreVerifiedItems.push(item)
                            }
                        }
                    }
                    if (attributeOptionsPreVerifiedItems.length) {
                        const groupedByAttribute = _.groupBy(attributeOptionsPreVerifiedItems, "attribute")
                        if (Object.keys(groupedByAttribute).length) {
                            const requestData: AttributeOption[] = []

                            Object.keys(groupedByAttribute).forEach(key => {
                                let attributeOptionObject: AttributeOption = {
                                    code: key, options: []
                                }
                                groupedByAttribute[key].forEach(option => {
                                    const attributeOptionItemData = AttributeOptionItem.safeParse({
                                        code: option.code,
                                        label: getLabelsFromImportedFileItem(option)
                                    })
                                    if (attributeOptionItemData.success === false) {
                                        job.failed += 1
                                    } else {
                                        attributeOptionObject.options.push(attributeOptionItemData.data)
                                    }
                                })
                                const attributeOptionModel = AttributeOption.safeParse(attributeOptionObject)
                                if (attributeOptionModel.success === false) {
                                    job.failed += 1
                                } else {
                                    requestData.push(attributeOptionModel.data)
                                }
                            })
                            if (requestData.length) {
                                try {
                                    const res = await new Classes.ProductSettings(data.context.instanceId).upsertAttributeSelectOptions({
                                        attributeOptions: requestData
                                    })
                                    if (res.statusCode >= 400) {
                                        job.failed += requestData.reduce<number>((acc, val) => {
                                            acc += val.options.length
                                            return acc
                                        }, 0)
                                        job.failReason = res.body.message || "unhandled error"
                                        job.status = JobStatus.Enum.FAILED
                                    } else {
                                        job.processed = requestData.reduce<number>((acc, val) => {
                                            acc += val.options.length
                                            return acc
                                        }, 0)
                                        job.status = JobStatus.Enum.DONE
                                    }
                                } catch (e) {
                                    job.failed += requestData.reduce<number>((acc, val) => {
                                        acc += val.options.length
                                        return acc
                                    }, 0)
                                    job.failReason = e.toString()
                                    job.status = JobStatus.Enum.FAILED
                                }
                            }
                        } else {
                            job.failed += attributeOptionsPreVerifiedItems.length
                            job.failReason = "Grouped by attribute data is empty"
                        }
                    }
                    break
                case ImportJobs.Enum.attribute_group_import:
                    const attributeGroupsRequestData: AttributeGroup[] = []
                    for (const item of importData) {
                        const attributeGroupImportItem = AttributeGroupImportItem.safeParse(item)
                        if (attributeGroupImportItem.success === false) {
                            job.failed += 1
                        } else {
                            const attributeGroupData = AttributeGroup.safeParse({
                                code: attributeGroupImportItem.data.code,
                                label: getLabelsFromImportedFileItem(item)
                            })
                            if (attributeGroupData.success === false) {
                                job.failed += 1
                            } else {
                                attributeGroupsRequestData.push(attributeGroupData.data)
                            }
                        }
                    }
                    if (attributeGroupsRequestData.length) {
                        try {
                            const res = await new Classes.ProductSettings(data.context.instanceId).upsertAttributeGroups({
                                attributeGroups: attributeGroupsRequestData
                            })
                            if (res.statusCode >= 400) {
                                job.failed += attributeGroupsRequestData.length
                                job.failReason = res.body.message || "unhandled error"
                                job.status = JobStatus.Enum.FAILED
                            } else {
                                job.processed = attributeGroupsRequestData.length
                                job.status = JobStatus.Enum.DONE
                            }
                        } catch (e) {
                            job.failed += attributeGroupsRequestData.length
                            job.failReason = e.toString()
                            job.status = JobStatus.Enum.FAILED
                        }
                    }
                    break
                case ImportJobs.Enum.family_import:
                    const familiesRequestData: Family[] = []
                    for (const item of importData) {
                        const familyImportItem = FamilyImportItem.safeParse(item)
                        if (familyImportItem.success === false) {
                            job.failed += 1
                        } else {
                            const familyAttributes: FamilyAttribute[] = [];
                            (familyImportItem.data.attributes || "").split(",").forEach(a => {
                                familyAttributes.push({
                                    attribute: a,
                                    requiredChannels: []
                                })
                            })
                            //get family attribute required channels from item
                            Object.keys(item).forEach(key => {
                                if (key.startsWith("requirements-")) {
                                    const splits = key.split("-")
                                    if (splits.length === 2) {
                                        const channel: string = splits[1]
                                        const attributes: string[] = item[key].split(",")
                                        attributes.forEach(att => {
                                            const oldIndex = familyAttributes.findIndex(fa => fa.attribute === att)
                                            if (oldIndex !== -1) {
                                                familyAttributes[oldIndex].requiredChannels.push(channel)
                                            }
                                        })
                                    }
                                }
                            })
                            const familyData = Family.safeParse({
                                code: familyImportItem.data.code,
                                label: getLabelsFromImportedFileItem(item),
                                attributeAsLabel: familyImportItem.data.attributeAsLabel,
                                attributeAsImage: familyImportItem.data.attributeAsImage,
                                attributes: familyAttributes,
                            })
                            if (familyData.success === false) {
                                job.failed += 1
                            } else {
                                familiesRequestData.push(familyData.data)
                            }
                        }
                    }
                    if (familiesRequestData.length) {
                        try {
                            const res = await new Classes.ProductSettings(data.context.instanceId).upsertFamilies({
                                families: familiesRequestData
                            })
                            if (res.statusCode >= 400) {
                                job.failed += familiesRequestData.length
                                job.failReason = res.body.message || "unhandled error"
                                job.status = JobStatus.Enum.FAILED
                            } else {
                                job.processed = familiesRequestData.length
                                job.status = JobStatus.Enum.DONE
                            }
                        } catch (e) {
                            job.failed += familiesRequestData.length
                            job.failReason = e.toString()
                            job.status = JobStatus.Enum.FAILED
                        }
                    }
                    break
                case ImportJobs.Enum.family_variant_import:
                    const familyVariantsRequestData: FamilyVariant[] = []
                    for (const item of importData) {
                        const familyVariantImportItem = FamilyVariantImportItem.safeParse(item)
                        if (familyVariantImportItem.success === false) {
                            job.failed += 1
                        } else {
                            const familyVariantData = FamilyVariant.safeParse({
                                code: familyVariantImportItem.data.code,
                                label: getLabelsFromImportedFileItem(item),
                                axes: familyVariantImportItem.data.axes.split(","),
                                attributes: familyVariantImportItem.data.attributes.split(","),
                            })
                            if (familyVariantData.success === false) {
                                job.failed += 1
                            } else {
                                familyVariantsRequestData.push(familyVariantData.data)
                            }
                        }
                    }
                    if (familyVariantsRequestData.length) {
                        try {
                            const res = await new Classes.ProductSettings(data.context.instanceId).upsertFamilyVariants({
                                familyVariants: familyVariantsRequestData
                            })
                            if (res.statusCode >= 400) {
                                job.failed += familyVariantsRequestData.length
                                job.failReason = res.body.message || "unhandled error"
                                job.status = JobStatus.Enum.FAILED
                            } else {
                                job.processed = familyVariantsRequestData.length
                                job.status = JobStatus.Enum.DONE
                            }
                        } catch (e) {
                            job.failed += familyVariantsRequestData.length
                            job.failReason = e.toString()
                            job.status = JobStatus.Enum.FAILED
                        }
                    }
                    break
                default:
                    throw new Error("Invalid job!")
            }
        } else {
            job.processed = 0
            job.failed = 0
            job.failReason = "empty data"
            job.status = JobStatus.Enum.DONE
        }

        if (![ImportJobs.Enum.product_import, ImportJobs.Enum.product_model_import].includes(jobSettings.job)) {
            job.finishedAt = new Date()
            await unlockExecution()
        }

        if (job.status === JobStatus.Enum.RUNNING) job.status = JobStatus.Enum.DONE

        await saveJobToDB(job, data.context.instanceId)

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

export async function importProcess(data: ImportData): Promise<ImportData> {
    let job: ImportJob;

    const attributes: BaseAttribute[] = data.request.body.attributes || []

    if (data.state.public.runningJob) {
        job = data.state.public.runningJob
    } else {
        const jobData = ImportJob.safeParse(data.request.body.job)
        if (jobData.success === false) {
            throw new Error("Invalid job data!")
        }
        data.state.public.runningJob = jobData.data
    }

    const item = data.request.body.item

    switch (job.code) {
        case ImportJobs.Enum.product_import:
            const productImportItem = ProductImportItem.safeParse(item)
            if (productImportItem.success === false) {
                job.failed += 1
            } else {
                const productAttributes: ProductAttribute[] = []
                for (const key of Object.keys(item)) {
                    if (key.startsWith("attributes-")) {
                        const splits = key.split("-")
                        const attributeCode = splits[1]
                        if (splits.length === 0 || !attributeCode) {
                            job.failed += 1
                        } else {
                            const attributeSettings: BaseAttribute = attributes.find(a => a.code === attributeCode)
                            const productAttribute: ProductAttribute = {
                                code: attributeCode,
                                data: []
                            }
                            if (attributeSettings.localizable && attributeSettings.scopable) {
                                // Note: export `attribute-${productAttribute.code}-${globalSettings.content.channel}-${locale}`
                                productAttribute.data.push({
                                    locale: splits[3], scope: splits[2], value: item[key]
                                })
                            } else if (attributeSettings.localizable && !attributeSettings.scopable) {
                                // Note: export `attribute-${productAttribute.code}-${locale}`
                                productAttribute.data.push({
                                    locale: splits[2], value: item[key]
                                })
                            } else if (!attributeSettings.localizable && attributeSettings.scopable) {
                                // Note: export `attribute-${productAttribute.code}-${globalSettings.content.channel}`
                                productAttribute.data.push({
                                    scope: splits[2], value: item[key]
                                })
                            } else {
                                // Note: export `attribute-${productAttribute.code}`
                                productAttribute.data.push({
                                    value: item[key]
                                })
                            }
                            productAttributes.push(productAttribute)
                        }
                    }
                }

                const productRequestData = Product.safeParse({
                    sku: productImportItem.data.sku,
                    family: productImportItem.data.family,
                    enabled: productImportItem.data.enabled,
                    groups: productImportItem.data.groups.split(","),
                    categories: productImportItem.data.groups.split(","),
                    attributes: productAttributes.length ? productAttributes : undefined,
                })
                if (productRequestData.success === false) {
                    job.failed += 1
                } else {
                    try {
                        await Classes.Product.getInstance({
                            body: {
                                dataType: DataType.Enum.PRODUCT,
                                data: productRequestData
                            }
                        })
                        job.processed += 1
                    } catch (e) {
                        job.failed += 1
                    }
                }
            }
            break
        case ImportJobs.Enum.product_model_import:
            const productModelImportItem = ProductModelImportItem.safeParse(item)
            if (productModelImportItem.success === false) {
                job.failed += 1
            } else {
                const productModelAttributes: ProductAttribute[] = []
                for (const key of Object.keys(item)) {
                    if (key.startsWith("attributes-")) {
                        const splits = key.split("-")
                        const attributeCode = splits[1]
                        if (splits.length === 0 || !attributeCode) {
                            job.failed += 1
                        } else {
                            const attributeSettings: BaseAttribute = attributes.find(a => a.code === attributeCode)
                            const productModelAttribute: ProductAttribute = {
                                code: attributeCode,
                                data: []
                            }
                            if (attributeSettings.localizable && attributeSettings.scopable) {
                                // Note: export `attribute-${productAttribute.code}-${globalSettings.content.channel}-${locale}`
                                productModelAttribute.data.push({
                                    locale: splits[3], scope: splits[2], value: item[key]
                                })
                            } else if (attributeSettings.localizable && !attributeSettings.scopable) {
                                // Note: export `attribute-${productAttribute.code}-${locale}`
                                productModelAttribute.data.push({
                                    locale: splits[2], value: item[key]
                                })
                            } else if (!attributeSettings.localizable && attributeSettings.scopable) {
                                // Note: export `attribute-${productAttribute.code}-${globalSettings.content.channel}`
                                productModelAttribute.data.push({
                                    scope: splits[2], value: item[key]
                                })
                            } else {
                                // Note: export `attribute-${productAttribute.code}`
                                productModelAttribute.data.push({
                                    value: item[key]
                                })
                            }
                            productModelAttributes.push(productModelAttribute)
                        }
                    }
                }

                const productModelRequestData = ProductModel.safeParse({
                    code: productModelImportItem.data.code,
                    family: productModelImportItem.data.family,
                    variant: productModelImportItem.data.variant,
                    categories: productModelImportItem.data.categories.split(","),
                    attributes: productModelAttributes.length ? productModelAttributes : undefined,
                })
                if (productModelRequestData.success === false) {
                    job.failed += 1
                } else {
                    try {
                        await Classes.Product.getInstance({
                            body: {
                                dataType: DataType.Enum.PRODUCT_MODEL,
                                data: productModelRequestData
                            }
                        })
                        job.processed += 1
                    } catch (e) {
                        job.failed += 1
                    }
                }
            }
            break
        default:
            throw new Error("Unsupported job process!")
    }

    if (job.failed + job.processed === job.total) {
        job.finishedAt = new Date()
        await saveJobToDB(job, data.context.instanceId)
        await unlockExecution()
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
            "Content-Type": jobSettings.connector === Connectors.Enum.xlsx ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv",
            "Content-Disposition": `attachment; filename="${filename}"`
        }

    }

    return data
}

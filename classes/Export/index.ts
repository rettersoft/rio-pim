import RDK, {Data, Response} from "@retter/rdk";
import {AccountIDInput, Classes} from "./rio";
import {
    AttributeOption,
    AttributeSettings,
    Category,
    Code,
    ExportConnectors,
    ExportJobs,
    ExportProfile,
    ExportProfileContent,
    GlobalProductModelExportSettings,
    Job,
    JobStatus,
    ProductExportCSVSettings,
    ProductExportXLSXSettings,
    ProductModelExportCSVSettings,
    ProductModelExportXLSXSettings
} from "./models";
import {
    generateJobId,
    getAllProductModels,
    getAllProducts,
    getCatalogSettings,
    getCurrentExecution,
    getExportFileName,
    getJobFromDB,
    getJobPartKey,
    json2CSV,
    json2XLSX,
    lockExecution,
    saveJobToDB,
    unlockExecution
} from "./helpers";


const rdk = new RDK();

export interface ExportPrivateState {
    profiles: ExportProfile[]
}

export interface ExportPublicState {
}

export type ExportData<Input = any, Output = any> = Data<Input, Output, ExportPublicState, ExportPrivateState>

export async function authorizer(data: ExportData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"
    const isThisClassInstance = data.context.identity === "Export" && data.context.userId === data.context.instanceId

    if (isDeveloper) {
        return {statusCode: 200}
    }

    if ([
        "upsertExportProfile",
        "deleteExportProfile",
        "getExportProfiles",
        "startExport",
        "getExportProfileExecutions",
        "getExportedFile",
        "getExecution",
    ].includes(data.context.methodName)) {
        return {statusCode: 200}
    }

    switch (data.context.methodName) {
        case 'executeExport':
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

export async function getInstanceId(data: ExportData<AccountIDInput>): Promise<string> {
    return data.request.body.accountId
}

export async function init(data: ExportData): Promise<ExportData> {

    data.state.private = {
        profiles: [
            {
                code: "attribute_export",
                job: ExportJobs.Enum.attribute_export,
                label: "Attributes Export XLSX",
                connector: ExportConnectors.Enum.xlsx,
                createdAt: new Date()
            },
            {
                code: "attribute_group_export",
                job: ExportJobs.Enum.attribute_group_export,
                label: "Attribute Groups Export XLSX",
                connector: ExportConnectors.Enum.xlsx,
                createdAt: new Date()
            },
            {
                code: "attribute_option_export",
                job: ExportJobs.Enum.attribute_option_export,
                label: "Attribute Options Export XLSX",
                connector: ExportConnectors.Enum.xlsx,
                createdAt: new Date()
            },
            {
                code: "category_export",
                job: ExportJobs.Enum.category_export,
                label: "Categories Export XLSX",
                connector: ExportConnectors.Enum.xlsx,
                createdAt: new Date()
            },
            {
                code: "group_export",
                job: ExportJobs.Enum.group_export,
                label: "Groups Export XLSX",
                connector: ExportConnectors.Enum.xlsx,
                createdAt: new Date()
            },
            {
                code: "group_type_export",
                job: ExportJobs.Enum.group_type_export,
                label: "Group Types Export XLSX",
                connector: ExportConnectors.Enum.xlsx,
                createdAt: new Date()
            },
            {
                code: "family_export",
                job: ExportJobs.Enum.family_export,
                label: "Families Export XLSX",
                connector: ExportConnectors.Enum.xlsx,
                createdAt: new Date()
            },
            {
                code: "family_variant_export",
                job: ExportJobs.Enum.family_variant_export,
                label: "Family Variants Export XLSX",
                connector: ExportConnectors.Enum.xlsx,
                createdAt: new Date()
            },

            {
                code: "attribute_export",
                job: ExportJobs.Enum.attribute_export,
                label: "Attributes Export CSV",
                connector: ExportConnectors.Enum.csv,
                createdAt: new Date()
            },
            {
                code: "attribute_group_export",
                job: ExportJobs.Enum.attribute_group_export,
                label: "Attribute Groups Export CSV",
                connector: ExportConnectors.Enum.csv,
                createdAt: new Date()
            },
            {
                code: "attribute_option_export",
                job: ExportJobs.Enum.attribute_option_export,
                label: "Attribute Options Export CSV",
                connector: ExportConnectors.Enum.csv,
                createdAt: new Date()
            },
            {
                code: "category_export",
                job: ExportJobs.Enum.category_export,
                label: "Categories Export CSV",
                connector: ExportConnectors.Enum.csv,
                createdAt: new Date()
            },
            {
                code: "group_export",
                job: ExportJobs.Enum.group_export,
                label: "Groups Export CSV",
                connector: ExportConnectors.Enum.csv,
                createdAt: new Date()
            },
            {
                code: "group_type_export",
                job: ExportJobs.Enum.group_type_export,
                label: "Group Types Export CSV",
                connector: ExportConnectors.Enum.csv,
                createdAt: new Date()
            },
            {
                code: "family_export",
                job: ExportJobs.Enum.family_export,
                label: "Families Export CSV",
                connector: ExportConnectors.Enum.csv,
                createdAt: new Date()
            },
            {
                code: "family_variant_export",
                job: ExportJobs.Enum.family_variant_export,
                label: "Family Variants Export CSV",
                connector: ExportConnectors.Enum.csv,
                createdAt: new Date()
            },
        ]
    }
    return data
}

export async function getState(data: ExportData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

export async function upsertExportProfile(data: ExportData): Promise<ExportData> {
    const result = ExportProfile.safeParse(data.request.body.profile)
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
        case ExportJobs.Enum.product_export:
            const catalogSettingsForProduct = await getCatalogSettings(data.context.instanceId)
            if (catalogSettingsForProduct.channels.length <= 0) {
                data.response = {
                    statusCode: 400,
                    body: {
                        message: "You should add a channel first!"
                    }
                }
                return data
            }
            const exportProfileContentResultForProduct = ExportProfileContent.safeParse({
                channel: catalogSettingsForProduct.channels[0].code,
                locales: catalogSettingsForProduct.channels[0].locales
            })
            if (exportProfileContentResultForProduct.success === false) {
                data.response = {
                    statusCode: 400,
                    body: {
                        message: "Model validation error!",
                        error: exportProfileContentResultForProduct.error
                    }
                }
                return data
            }
            if(result.data.globalSettings === undefined){
                result.data.globalSettings = {
                    content: exportProfileContentResultForProduct.data
                }
            }
            if (result.data.connector === ExportConnectors.Enum.xlsx) {
                const checkSettings = ProductExportXLSXSettings.safeParse(result.data.globalSettings)
                if (checkSettings.success === false) {
                    data.response = {
                        statusCode: 400,
                        body: {
                            message: "Model validation error! (Product settings for xlsx)",
                            error: checkSettings.error
                        }
                    }
                    return data
                }
                result.data.globalSettings = checkSettings.data
            } else if (result.data.connector === ExportConnectors.Enum.csv) {
                const checkSettings = ProductExportCSVSettings.safeParse(result.data.globalSettings)
                if (checkSettings.success === false) {
                    data.response = {
                        statusCode: 400,
                        body: {
                            message: "Model validation error! (Product settings for csv)",
                            error: checkSettings.error
                        }
                    }
                    return data
                }
                result.data.globalSettings = checkSettings.data
            }
            break
        case ExportJobs.Enum.product_model_export:
            const catalogSettingsForProductModel = await getCatalogSettings(data.context.instanceId)
            if (catalogSettingsForProductModel.channels.length <= 0) {
                data.response = {
                    statusCode: 400,
                    body: {
                        message: "You should add a channel first!"
                    }
                }
                return data
            }
            const exportProfileContentResultForProductModel = ExportProfileContent.safeParse({
                channel: catalogSettingsForProductModel.channels[0].code,
                locales: catalogSettingsForProductModel.channels[0].locales
            })
            if (exportProfileContentResultForProductModel.success === false) {
                data.response = {
                    statusCode: 400,
                    body: {
                        message: "Model validation error!",
                        error: exportProfileContentResultForProductModel.error
                    }
                }
                return data
            }
            if(result.data.globalSettings === undefined){
                result.data.globalSettings = {
                    content: exportProfileContentResultForProductModel.data
                }
            }
            if (result.data.connector === ExportConnectors.Enum.xlsx) {
                const checkSettings = ProductModelExportXLSXSettings.safeParse(result.data.globalSettings)
                if (checkSettings.success === false) {
                    data.response = {
                        statusCode: 400,
                        body: {
                            message: "Model validation error! (Product model settings for xlsx)",
                            error: checkSettings.error
                        }
                    }
                    return data
                }
                result.data.globalSettings = checkSettings.data
            } else if (result.data.connector === ExportConnectors.Enum.csv) {
                const checkSettings = ProductModelExportCSVSettings.safeParse(result.data.globalSettings)
                if (checkSettings.success === false) {
                    data.response = {
                        statusCode: 400,
                        body: {
                            message: "Model validation error! (Product model settings for csv)",
                            error: checkSettings.error
                        }
                    }
                    return data
                }
                result.data.globalSettings = checkSettings.data
            }
            break
        case ExportJobs.Enum.group_export:
        case ExportJobs.Enum.category_export:
        case ExportJobs.Enum.attribute_export:
        case ExportJobs.Enum.attribute_option_export:
        case ExportJobs.Enum.attribute_group_export:
        case ExportJobs.Enum.family_export:
        case ExportJobs.Enum.family_variant_export:
        case ExportJobs.Enum.group_type_export:
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

export async function deleteExportProfile(data: ExportData): Promise<ExportData> {
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

    const results = await rdk.queryDatabase({
        partKey: getJobPartKey(data.context.instanceId, codeResult.data),
        reverse: true
    })

    const currentExecution = await getCurrentExecution()
    if(currentExecution && currentExecution.code === codeResult.data){
        await unlockExecution()
    }

    try {
        if (results.success && results.data) {
            const workers = []
            results.data.items.forEach((item: { partKey: string, sortKey: string, data: Job }) => {
                workers.push(rdk.removeFromDatabase({partKey: item.partKey, sortKey: item.sortKey}))
                workers.push(rdk.deleteFile({filename: getExportFileName(data.context.instanceId, item.data.code, item.data.uid, item.data.connector)}))
            })
            await Promise.all(workers)
        }
    } catch (e) {
        console.log(e)
    }

    data.state.private.profiles = data.state.private.profiles.filter(p => p.code !== codeResult.data)

    return data
}

export async function getExportProfiles(data: ExportData): Promise<ExportData> {
    data.response = {
        statusCode: 200,
        body: {
            profiles: data.state.private.profiles
        }
    }
    return data
}

export async function startExport(data: ExportData): Promise<ExportData> {
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

    const result = await new Classes.Export(data.context.instanceId).executeExport()

    if(result.statusCode>=400){
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

export async function executeExport(data: ExportData): Promise<ExportData> {

    const job: Job = await getCurrentExecution()

    const jobSettings = data.state.private.profiles.find(p => p.code === job.code)
    if (!jobSettings) {
        throw new Error("Job settings not found!")
    }

    try {
        const getProductsSettingsResult = await new Classes.ProductSettings(data.context.instanceId).getProductSettings()
        if (getProductsSettingsResult.statusCode >= 400) {
            throw new Error("Product settings error!")
        }

        let fileData;
        let dat = [];
        switch (jobSettings.job) {
            case ExportJobs.Enum.product_export:
                const products = await getAllProducts(data.context.instanceId)
                const preparedData = []
                products.forEach(product => {
                    const productAttributeValues = {}

                    product.data.attributes.forEach((productAttribute) => {
                        const attributeSettings: AttributeSettings = getProductsSettingsResult.body.productSettings.attributes.find(a => a.code === productAttribute.code)
                        const globalSettings: GlobalProductModelExportSettings = jobSettings.globalSettings

                        if (attributeSettings.localizable && attributeSettings.scopable) {
                            globalSettings.content.locales.forEach(locale => {
                                productAttributeValues[`${productAttribute.code}-${globalSettings.content.channel}-${locale}`] =
                                    productAttribute.data.find(d => d.locale === locale && d.scope === globalSettings.content.channel)?.value
                            })
                        } else if (attributeSettings.localizable && !attributeSettings.scopable) {
                            globalSettings.content.locales.forEach(locale => {
                                productAttributeValues[`${productAttribute.code}-${locale}`] =
                                    productAttribute.data.find(d => d.locale === locale)?.value
                            })
                        } else if (!attributeSettings.localizable && attributeSettings.scopable) {
                            productAttributeValues[`${productAttribute.code}-${globalSettings.content.channel}`] =
                                productAttribute.data.find(d => d.scope === globalSettings.content.channel)?.value
                        } else {
                            productAttributeValues[`${productAttribute.code}`] =
                                productAttribute.data.find(d => d.value !== undefined)?.value
                        }
                    })

                    preparedData.push({
                        sku: product.data.sku,
                        family: product.data.family,
                        enabled: product.data.enabled,
                        categories: product.data.categories.join(","),
                        groups: product.data.groups.join(","),
                        parent: product.parent,
                        ...productAttributeValues
                    })
                })
                fileData = preparedData
                job.total = fileData.length
                break
            case ExportJobs.Enum.product_model_export:
                const productModels = await getAllProductModels(data.context.instanceId)
                const preparedDataForProductModel = []
                productModels.forEach(productModel => {
                    const productModelAttributeValues = {}

                    productModel.data.attributes.forEach(attribute => {
                        const attributeSettings: AttributeSettings = getProductsSettingsResult.body.productSettings.attributes.find(a => a.code === attribute)
                        const globalSettings: GlobalProductModelExportSettings = jobSettings.globalSettings

                        if (attributeSettings.localizable && attributeSettings.scopable) {
                            globalSettings.content.locales.forEach(locale => {
                                productModelAttributeValues[`${attribute}-${globalSettings.content.channel}-${locale}`] =
                                    attribute.data.find(d => d.locale === locale && d.scope === globalSettings.content.channel)?.value
                            })
                        } else if (attributeSettings.localizable && !attributeSettings.scopable) {
                            globalSettings.content.locales.forEach(locale => {
                                productModelAttributeValues[`${attribute}-${locale}`] =
                                    attribute.data.find(d => d.locale === locale)?.value
                            })
                        } else if (!attributeSettings.localizable && attributeSettings.scopable) {
                            productModelAttributeValues[`${attribute}-${globalSettings.content.channel}`] =
                                attribute.data.find(d => d.scope === globalSettings.content.channel)?.value
                        } else {
                            productModelAttributeValues[`${attribute}`] =
                                attribute.data.find(d => d.value !== undefined)?.value
                        }
                    })
                    preparedDataForProductModel.push({
                        code: productModel.data.code,
                        family: productModel.data.family,
                        variant: productModel.data.variant,
                        categories: productModel.data.categories.join(","),
                        ...productModelAttributeValues
                    })
                })
                fileData = preparedDataForProductModel
                job.total = fileData.length
                break
            case ExportJobs.Enum.category_export:
                const getCatalogSettingsResponse = await new Classes.CatalogSettings(data.context.instanceId).getCatalogSettings()
                if (getCatalogSettingsResponse.statusCode >= 400) {
                    throw new Error("Catalog settings not found!")
                }
                const categories: Category[] = getCatalogSettingsResponse.body.categories
                const getCategories = (categories: Category[], data = [], parentCode?: string) => {
                    if (categories.length >= 1) {
                        for (const category of categories) {
                            const code = [parentCode, category.code].filter(Boolean).join("#")
                            const labels = {}
                            if (category.label && category.label.length) {
                                category.label.forEach(label => {
                                    labels[`label-${label.locale}`] = label.value
                                })
                            }
                            data.push({
                                code,
                                parent: parentCode,
                                ...labels
                            })
                            getCategories(category.subCategories, data, code)
                        }
                    } else {
                        return []
                    }
                    return data
                }
                fileData = getCategories(categories, [])
                job.total = fileData.length
                break
            case ExportJobs.Enum.attribute_export:
                dat = [];
                getProductsSettingsResult.body.productSettings.attributes.forEach(a => {
                    let obj = a
                    if (a.label && a.label.length) {
                        a.label.forEach(al => {
                            obj[`label-${al.locale}`] = al.value
                        })
                    }
                    dat.push(obj)
                })
                fileData = dat
                job.total = fileData.length
                break
            case ExportJobs.Enum.attribute_option_export:
                dat = [];
                (getProductsSettingsResult.body.productSettings.attributeOptions as AttributeOption[]).forEach(fd => {
                    fd.options.forEach(fdo => {
                        let obj = {
                            attribute: fd.code,
                            code: fdo.code
                        }
                        if (fdo.label && fdo.label.length) {
                            fdo.label.forEach(fdol => {
                                obj[`label-${fdol.locale}`] = fdol.value
                            })
                        }
                        dat.push(obj)
                    })
                })
                fileData = dat
                job.total = fileData.length
                break
            case ExportJobs.Enum.attribute_group_export:
                dat = [];
                getProductsSettingsResult.body.productSettings.attributeGroups.forEach(a => {
                    let obj = a
                    if (a.label && a.label.length) {
                        a.label.forEach(al => {
                            obj[`label-${al.locale}`] = al.value
                        })
                    }
                    dat.push(obj)
                })
                fileData = dat
                job.total = fileData.length
                break
            case ExportJobs.Enum.family_export:
                dat = [];
                const requirements = {}
                getProductsSettingsResult.body.productSettings.families.forEach(family => {
                    let obj = {
                        code: family.code,
                        attributes: family.attributes.map(attr => attr.attribute).join(","),
                        attributeAsLabel: family.attributeAsLabel,
                        attributeAsImage: family.attributeAsImage
                    }
                    if (family.label && family.label.length) {
                        family.label.forEach(al => {
                            obj[`label-${al.locale}`] = al.value
                        })
                    }
                    family.attributes.forEach(attr => {
                        attr.requiredChannels.forEach(reqChannel => {
                            requirements[reqChannel] = [...(requirements[reqChannel] || []), attr]
                        })
                    })
                    Object.keys(requirements).forEach(reqChannel => {
                        obj[`requirements-${reqChannel}`] = requirements[reqChannel].join(",")
                    })
                    dat.push(obj)
                })
                fileData = dat
                job.total = fileData.length
                break
            case ExportJobs.Enum.family_variant_export:
                dat = [];
                getProductsSettingsResult.body.productSettings.families.forEach(family => {
                    family.variants.forEach(variant => {
                        let obj = {
                            code: variant.code,
                            family: family.code,
                            axes: variant.axes.join(","),
                            attributes: variant.attributes.join(",")
                        }
                        if (variant.label && variant.label.length) {
                            variant.label.forEach(al => {
                                obj[`label-${al.locale}`] = al.value
                            })
                        }
                    })
                })
                fileData = dat
                job.total = fileData.length
                break
            case ExportJobs.Enum.group_type_export:
                dat = [];
                getProductsSettingsResult.body.productSettings.groupTypes.forEach(a => {
                    let obj = a
                    if (a.label && a.label.length) {
                        a.label.forEach(al => {
                            obj[`label-${al.locale}`] = al.value
                        })
                    }
                    dat.push(obj)
                })
                fileData = dat
                job.total = fileData.length
                break
            case ExportJobs.Enum.group_export:
                dat = [];
                getProductsSettingsResult.body.productSettings.groups.forEach(a => {
                    let obj = a
                    if (a.label && a.label.length) {
                        a.label.forEach(al => {
                            obj[`label-${al.locale}`] = al.value
                        })
                    }
                    dat.push(obj)
                })
                fileData = dat
                job.total = fileData.length
                break
            default:
                throw new Error("Invalid job!")
        }

        let fileBufferData: Buffer;

        switch (jobSettings.connector) {
            case ExportConnectors.Enum.xlsx:
                fileBufferData = await json2XLSX(fileData)
                break
            case ExportConnectors.Enum.csv:
                fileBufferData = await json2CSV(fileData)
                break
            default:
                throw new Error("Invalid connector!")
        }

        await rdk.setFile({
            filename: getExportFileName(data.context.instanceId, job.code, job.uid, job.connector),
            body: fileBufferData.toString("base64")
        })

        job.processed = fileData.length
        job.status = JobStatus.Enum.DONE
        job.finishedAt = new Date()

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

export async function getExportProfileExecutions(data: ExportData): Promise<ExportData> {
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
        partKey: getJobPartKey(data.context.instanceId, codeResult.data)
    })

    let executions = []

    if (results.success && results.data.items && results.data.items.length) {
        executions = results.data.items.map(i => i.data)
    }

    data.response = {
        statusCode: 200,
        body: {
            profile,
            executions
        }
    }
    return data
}

export async function getExecution(data: ExportData): Promise<ExportData> {
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


export async function getExportedFile(data: ExportData): Promise<ExportData> {
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

    const filename = getExportFileName(data.context.instanceId, jobCode, jobId, jobSettings.connector)

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
            "Content-Type": jobSettings.connector === ExportConnectors.Enum.xlsx ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv",
            "Content-Disposition": `attachment; filename="${filename}"`
        }

    }

    return data
}

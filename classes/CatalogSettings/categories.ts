import {CatalogSettingsData} from "./index";
import {checkUpdateToken, randomString, sendEvent} from "./helpers";
import {WebhookEventOperation, WebhookEventType} from "./rio";
import {Categories, Category} from "PIMModelsPackage";


export async function addCategory(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    checkUpdateToken(data)

    const result = Category.safeParse(data.request.body.category)
    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: 'Model validation failed!',
                error: result.error
            }
        }
        return data
    }

    if (data.state.public.categories.findIndex(c => c.code === result.data.code) !== -1) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Category already exist!"
            }
        }
        return data
    }

    data.state.public.categories.push(result.data)
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: data.context.instanceId + "-" + result.data.code,
        eventOperation: WebhookEventOperation.Create,
        eventType: WebhookEventType.Category
    })

    return data
}

export async function removeCategory(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    checkUpdateToken(data)

    const categoryCode = data.request.body.code

    if (!categoryCode || categoryCode === "") {
        data.response = {
            statusCode: 400,
            body: {
                message: "Category code is required!"
            }
        }
        return data
    }

    data.state.public.categories = data.state.public.categories.filter(c => c.code !== data.request.body.code)
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocumentId: data.context.instanceId + "-" + categoryCode,
        eventOperation: WebhookEventOperation.Delete,
        eventType: WebhookEventType.Category
    })

    return data
}

export async function updateCategory(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    checkUpdateToken(data)

    const result = Category.safeParse(data.request.body.category)
    if (!result.success) {
        data.response = {
            statusCode: 400,
            body: {
                message: 'Model validation failed!',
                error: result.error
            }
        }
        return data
    }

    const cIndex = data.state.public.categories.findIndex(c => c.code === result.data.code)
    if (cIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Category not found!"
            }
        }
        return data
    }
    data.state.public.categories[cIndex] = result.data
    data.state.public.updateToken = randomString()

    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: data.context.instanceId + "-" + result.data.code,
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.Category
    })

    return data
}

export async function upsertCategories(data: CatalogSettingsData): Promise<CatalogSettingsData> {

    checkUpdateToken(data)

    const result = Categories.safeParse(data.request.body.categories)
    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: 'Model validation failed!',
                error: result.error
            }
        }
        return data
    }

    for (const datum of result.data) {
        const oldIndex = data.state.public.categories.findIndex(cat => cat.code === datum.code)
        if (oldIndex === -1) {
            data.state.public.categories.push(datum)
        } else {
            data.state.public.categories[oldIndex] = datum
        }
    }


    data.state.public.updateToken = randomString()
    return data
}

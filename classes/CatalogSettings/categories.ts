import {CatalogSettingsData} from "./index";
import {Category} from "./models";
import {checkUpdateToken, randomString} from "./helpers";


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

    return data
}

export async function removeCategory(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    checkUpdateToken(data)

    data.state.public.categories = data.state.public.categories.filter(c => c.code !== data.request.body.code)
    data.state.public.updateToken = randomString()

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

    return data
}

import {CatalogSettingsData} from "./index";
import {UpsertCategoryInput} from "./rio";
import {randomString} from "./helpers";


export async function upsertCategories(data: CatalogSettingsData<UpsertCategoryInput>): Promise<CatalogSettingsData> {
    if (data.state.public.updateToken !== data.request.body.updateToken) {
        data.response = {
            statusCode: 400,
            body: {
                message: 'Invalid update token. Please, refresh your page and try again!'
            }
        }
        return data
    }
    data.state.public.categories = data.request.body.categories
    data.state.public.updateToken = randomString()
    return data
}

import {CatalogSettingsData} from "./index";
import {checkUpdateToken, randomString} from "./helpers";
import {Currencies} from "./consts";


export async function toggleCurrency(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    checkUpdateToken(data)

    const currencyId = data.request.body.currencyId
    if (!currencyId || !Currencies.map(c => c.id).includes(currencyId)) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid currency id!"
            }
        }
        return data
    }

    if(!data.state.public.enabledCurrencies) data.state.public.enabledCurrencies = []

    const isEnabled = data.state.public.enabledCurrencies.includes(currencyId)

    if (isEnabled) {
        if (data.state.public.enabledCurrencies.length === 1) {
            data.response = {
                statusCode: 400,
                body: {
                    message: "Must have at least one currency"
                }
            }
            return data
        }
        data.state.public.enabledCurrencies = data.state.public.enabledCurrencies.filter(id => id !== currencyId)
    } else {
        data.state.public.enabledCurrencies.push(currencyId)
    }
    data.state.public.updateToken = randomString()

    return data
}

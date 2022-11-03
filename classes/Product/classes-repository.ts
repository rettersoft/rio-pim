import {Classes} from "./rio";
import {GetProductOutputData} from "./index";
import {
    AttributeGroup,
    AttributeOption,
    BaseAttribute,
    Category,
    Channel,
    Family,
    Group,
    GroupType,
    Product
} from "PIMModelsPackage";

export interface GetCatalogSettingsResult {
    categories: Category[]
    enabledCurrencies: string[]
    enabledLocales: string[]
    channels: Channel[]
}

export interface GetProductsSettingsResult {
    attributes: BaseAttribute[],
    attributeOptions: AttributeOption[],
    families: Family[],
    attributeGroups: AttributeGroup[],
    groupTypes: GroupType[],
    groups: Group[],
}

export interface GetProductResult<T = Product> extends GetProductOutputData {
    data: T
}

export class ClassesRepository {

    static async getProductsSettings(accountId: string): Promise<GetProductsSettingsResult> {
        const getProductsSettingsResult = await new Classes.ProductSettings(accountId).getProductSettings()
        if (getProductsSettingsResult.statusCode >= 400) {
            throw new Error("Product settings error!")
        }
        return getProductsSettingsResult.body.productSettings
    }

    static async getCatalogSettings(accountId: string): Promise<GetCatalogSettingsResult> {
        const getProductsSettingsResult = await new Classes.CatalogSettings(accountId).getCatalogSettings()
        if (getProductsSettingsResult.statusCode >= 400) {
            throw new Error("Catalog settings error!")
        }
        return getProductsSettingsResult.body.productSettings
    }

    static async getProduct<T>(accountId: string, id: string): Promise<GetProductResult<T>> {
        if (!id || id === "") {
            throw new Error("Invalid product id!")
        }
        const getProductResult = await new Classes.Product(accountId + "-" + id).getProduct()
        if (getProductResult.statusCode >= 400) {
            throw new Error("Product get error!")
        }
        return getProductResult.body
    }

}

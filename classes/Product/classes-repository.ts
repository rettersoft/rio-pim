import {Classes} from "./rio";
import {AttributeOption, BaseAttribute, Family, Label, Product} from "./models";
import {GetProductOutputData} from "./index";


export interface GetProductsSettingsResult {
    attributes: BaseAttribute[],
    attributeOptions: AttributeOption[],
    families: Family[],
    attributeGroups: { code: string, label: Label }[],
    groupTypes: { code: string, label: Label }[],
    groups: { code: string, type: string, label: Label }[],
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

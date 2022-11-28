import {Classes} from "./rio";
import {GetProductOutputData} from "./index";
import {Product} from "PIMModelsPackage";

export interface GetProductResult<T = Product> extends GetProductOutputData {
    data: T
}

export class ClassesRepository {
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

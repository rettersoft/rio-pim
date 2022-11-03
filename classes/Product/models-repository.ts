import {AxesValuesList, DataType, Product, ProductModel} from "PIMModelsPackage";


export class ModelsRepository {
    static getDataType(data: any): DataType {
        const model = DataType.safeParse(data)
        if (model.success === false) {
            throw new Error("Invalid data! (DataType)")
        } else {
            return model.data
        }
    }

    static getAxesValuesList(data: any): AxesValuesList {
        const model = AxesValuesList.safeParse(data)
        if (model.success === false) {
            throw new Error("Invalid data! (AxesValuesList)")
        } else {
            return model.data
        }
    }

    static getProduct(data: any): Product {
        const model = Product.safeParse(data)
        if (model.success === false) {
            throw new Error("Invalid data! (Product)")
        } else {
            return model.data
        }
    }

    static getProductModel(data: any): ProductModel {
        const model = ProductModel.safeParse(data)
        if (model.success === false) {
            throw new Error("Invalid data! (ProductModel)")
        } else {
            return model.data
        }
    }

}

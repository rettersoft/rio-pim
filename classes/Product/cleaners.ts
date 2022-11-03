import {getProductRemovedImages} from "./helpers";
import {GetProductsSettingsResult} from "./classes-repository";
import RDK from "@retter/rdk";
import {ProductAttribute} from "PIMModelsPackage";

const rdk = new RDK();

export class Cleaners {
    static async productOperationCleaner(unsavedProductAttributes: ProductAttribute[], savedProductAttributes: ProductAttribute[], productsSettings: GetProductsSettingsResult) {
        const removedImages = getProductRemovedImages(unsavedProductAttributes, savedProductAttributes, productsSettings.attributes)

        //remove images
        const removeImageWorkers = []
        removedImages.forEach(ri => {
            removeImageWorkers.push(rdk.deleteFile({filename: ri}))
        })
        await Promise.all(removeImageWorkers)

    }
}

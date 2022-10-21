import {getProductRemovedImages} from "./helpers";
import {ProductAttribute} from "./models";
import {GetProductsSettingsResult} from "./classes-repository";
import RDK from "@retter/rdk";

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

import {CustomValidations, IMAGE_CACHE_TTL_IN_SECONDS} from "PIMModelsPackage";
import {Classes, GetImageByRDKModel} from "./rio";


export class PIMRepository {
    static async getProductImageByRDK(accountId: string, getImageInput: GetImageByRDKModel) {
        CustomValidations.validateImageFilename(getImageInput.filename, accountId)

        const result = await new Classes.Image(accountId).getImageByRDK(getImageInput)

        if (!result || result.statusCode >= 400) {
            throw new Error("Image get error!")
        }

        return {
            fileData: result.body,
            contentType: result.headers ? result.headers["content-type"] : undefined,
            cacheControl: `max-age=${IMAGE_CACHE_TTL_IN_SECONDS}`
        }
    }
}

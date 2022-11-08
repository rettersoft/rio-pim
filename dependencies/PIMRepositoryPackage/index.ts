import {CustomValidations, IMAGE_CACHE_TTL_IN_SECONDS} from "PIMModelsPackage";
import mime from "mime-types";
import RDK from "@retter/rdk";

const rdk = new RDK();


export class PIMRepository {
    static async getProductImageByRDK(filename: string, accountId: string) {
        CustomValidations.validateImageFilename(filename, accountId)

        const file = await rdk.getFile({filename})
        if (!file || file.error) {
            throw new Error(file && file.error ? file.error : "file not found")
        }

        let ext: any = filename.split(".").pop()
        ext = mime.lookup(ext) ? mime.lookup(ext) : undefined
        return {
            fileData: file.data,
            contentType: ext ? ext : undefined,
            cacheControl: `max-age=${IMAGE_CACHE_TTL_IN_SECONDS}`
        }
    }
}

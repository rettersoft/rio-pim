import {Category, CustomValidations, IMAGE_CACHE_TTL_IN_SECONDS} from "PIMModelsPackage";
import {Classes, GetImageByRDKModel} from "./rio";

const IMAGE_NAME_SEPARATOR = "-"

export class PIMRepository {
    static async getImageByRDK(accountId: string, getImageInput: GetImageByRDKModel) {
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

    static getImageBaseURL(projectId: string, accountId: string) {
        return `https://${projectId}.api.retter.io/${projectId}/CALL/API/getImage/${accountId}`
    }

    /**
     * @param accountId
     * @param imageId
     * @param extension
     */
    static buildImageName(accountId: string, imageId: string, extension: string) {
        return [accountId, imageId].join(IMAGE_NAME_SEPARATOR) + `.${extension}`
    }

    static parseImageName(imageName?: string): { accountId: string, imageId: string, extension: string } {
        if (!imageName) {
            throw new Error("image name is required!")
        }

        const splits = imageName.split(IMAGE_NAME_SEPARATOR)
        if (splits.length !== 2) {
            throw new Error("Invalid image name!")
        }

        const subSplits = splits[1].split(".")
        if (subSplits.length !== 2) {
            throw new Error("Invalid image name! (extension)")
        }

        return {
            accountId: splits[0],
            imageId: subSplits[0],
            extension: subSplits[1]
        }
    }


    static getCategoriesInOneLevel(categories: Category[], data: {code: string, parent?: string}[] = [], parentCode?: string) {
        if (categories.length >= 1) {
            for (const category of categories) {
                const code = [parentCode, category.code].filter(Boolean).join("#")
                data.push({
                    code,
                    parent: parentCode,
                })
                this.getCategoriesInOneLevel(category.subCategories, data, code)
            }
        } else {
            return []
        }
        return data
    }



}

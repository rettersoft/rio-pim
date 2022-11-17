import {PimImageExtensions} from "./product-settings-models";
import {PIMRepository} from "../PIMRepositoryPackage";


export class CustomValidations {
    static validateImageFilename(filename: string, accountId: string) {

        const parsedImageName = PIMRepository.parseImageName(filename)

        if (parsedImageName.accountId !== accountId) {
            throw new Error("Permission denied!")
        }

        const supportedExtension = PimImageExtensions.safeParse(parsedImageName.extension)
        if (supportedExtension.success === false) {
            throw new Error("Unsupported file extension!")
        }
    }

}

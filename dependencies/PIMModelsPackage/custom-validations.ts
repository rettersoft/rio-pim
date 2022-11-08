import {PimImageExtensions} from "./product-settings-models";


export class CustomValidations {
    static validateImageFilename(filename: string, accountId: string) {
        if (!filename) {
            throw new Error("Filename is required!")
        }

        const splits = filename.split("-")

        if (splits.length !== 2) {
            throw new Error("Invalid file name!")
        }

        if (splits[0] !== accountId) {
            throw new Error("Permission denied!")
        }

        const extData = splits[1].split(".")

        if (extData.length !== 2) {
            throw new Error("Invalid file extension!")
        }

        const supportedExtension = PimImageExtensions.safeParse(extData[1])
        if (supportedExtension.success === false) {
            throw new Error("Unsupported file extension!")
        }
    }

}

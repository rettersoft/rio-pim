import {CatalogSettingsData, ImageResponse} from "./index";
import {checkUpdateToken, randomString, sendEvent} from "./helpers";
import {WebhookEventOperation, WebhookEventType} from "./rio";
import {Categories, Category, PimImageExtensions, TEMP_IMAGE_TTL_IN_SECONDS} from "PIMModelsPackage";
import {Buffer} from "buffer";
import {PIMRepository} from "PIMRepositoryPackage";
import {v4 as uuidv4} from "uuid";
import RDK from "@retter/rdk";
import * as querystring from "querystring";

const rdk = new RDK();


export async function addCategory(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    checkUpdateToken(data)

    const result = Category.safeParse(data.request.body.category)
    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: 'Model validation failed!',
                error: result.error
            }
        }
        return data
    }

    if (data.state.public.categories.findIndex(c => c.code === result.data.code) !== -1) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Category already exist!"
            }
        }
        return data
    }

    data.state.public.categories.push(result.data)
    data.state.public.updateToken = randomString()

    if (!data.state.private.savedImages) data.state.private.savedImages = []
    if (!data.state.private.tempImages) data.state.private.tempImages = []

    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: data.context.instanceId + "-" + result.data.code,
        eventOperation: WebhookEventOperation.Create,
        eventType: WebhookEventType.Category
    })

    return data
}

export async function removeCategory(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    checkUpdateToken(data)

    const categoryCode = data.request.body.code

    if (!categoryCode || categoryCode === "") {
        data.response = {
            statusCode: 400,
            body: {
                message: "Category code is required!"
            }
        }
        return data
    }

    data.state.public.categories = data.state.public.categories.filter(c => c.code !== data.request.body.code)
    data.state.public.updateToken = randomString()

    if (!data.state.private.savedImages) data.state.private.savedImages = []
    if (!data.state.private.tempImages) data.state.private.tempImages = []

    const removedImages = []
    const allAttachedImages = getAttachedImages(data.state.public.categories)
    for (const savedImage of data.state.private.savedImages) {
        if (!allAttachedImages.includes(savedImage)) {
            removedImages.push(savedImage)
            data.state.private.savedImages = data.state.private.savedImages.filter(si => si !== savedImage)
        }
    }

    await Promise.all(removedImages.map(ri => {
        return rdk.deleteFile({filename: ri})
    }))

    await sendEvent(data.context.instanceId, {
        eventDocumentId: data.context.instanceId + "-" + categoryCode,
        eventOperation: WebhookEventOperation.Delete,
        eventType: WebhookEventType.Category
    })

    return data
}

export async function updateCategory(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    checkUpdateToken(data)

    const result = Category.safeParse(data.request.body.category)
    if (!result.success) {
        data.response = {
            statusCode: 400,
            body: {
                message: 'Model validation failed!',
                error: result.error
            }
        }
        return data
    }

    const cIndex = data.state.public.categories.findIndex(c => c.code === result.data.code)
    if (cIndex === -1) {
        data.response = {
            statusCode: 404,
            body: {
                message: "Category not found!"
            }
        }
        return data
    }
    data.state.public.categories[cIndex] = result.data
    data.state.public.updateToken = randomString()

    if (!data.state.private.savedImages) data.state.private.savedImages = []
    if (!data.state.private.tempImages) data.state.private.tempImages = []

    const modifyMetaData = (category) => {
        if (category.image) {
            category.meta = {
                ...(category.meta || {}),
                url: PIMRepository.getImageBaseURL(data.context.projectId, data.context.instanceId) + "?" + querystring.stringify({filename: category.image})
            }
        } else if (category.meta) {
            category.meta.url = undefined
        }
        for (let i = 0; i < category.subCategories.length; i++) {
            modifyMetaData(category.subCategories[i])
        }
    }
    modifyMetaData(result.data)

    getAttachedImages([result.data]).forEach(image => {
        data.state.private.tempImages = data.state.private.tempImages.filter(ti => ti !== image)
        if (!data.state.private.savedImages.find(si => si === image)) {
            data.state.private.savedImages.push(image)
        }
    })

    const removedImages = []
    const allAttachedImages = getAttachedImages(data.state.public.categories)
    for (const savedImage of data.state.private.savedImages) {
        if (!allAttachedImages.includes(savedImage)) {
            removedImages.push(savedImage)
            data.state.private.savedImages = data.state.private.savedImages.filter(si => si !== savedImage)
        }
    }

    await Promise.all(removedImages.map(ri => {
        return rdk.deleteFile({filename: ri})
    }))


    await sendEvent(data.context.instanceId, {
        eventDocument: result.data,
        eventDocumentId: data.context.instanceId + "-" + result.data.code,
        eventOperation: WebhookEventOperation.Update,
        eventType: WebhookEventType.Category
    })

    return data
}

export async function upsertCategories(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    checkUpdateToken(data)

    const result = Categories.safeParse(data.request.body.categories)
    if (result.success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: 'Model validation failed!',
                error: result.error
            }
        }
        return data
    }

    for (const datum of result.data) {
        const oldIndex = data.state.public.categories.findIndex(cat => cat.code === datum.code)
        if (oldIndex === -1) {
            data.state.public.categories.push(datum)
        } else {
            data.state.public.categories[oldIndex] = datum
        }
    }

    data.state.public.updateToken = randomString()
    return data
}


export async function uploadTempImage(data: CatalogSettingsData): Promise<CatalogSettingsData> {

    if (!data.request.body.image || data.request.body.image === "" ||
        !data.request.body.extension || data.request.body.extension === "") {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid body!"
            }
        }
        return data
    }

    let imageBuffer: Buffer;
    try {
        imageBuffer = Buffer.from(data.request.body.image, "base64")
    } catch (e) {
        data.response = {
            statusCode: 400,
            body: {
                message: "Invalid image data!"
            }
        }
        return data
    }

    const accountId = data.context.instanceId.split("-").shift()
    if (PimImageExtensions.safeParse(data.request.body.extension).success === false) {
        data.response = {
            statusCode: 400,
            body: {
                message: `Not allowed extension! Allowed extensions: (${PimImageExtensions.options.join(", ")})`
            }
        }
        return data
    }

    const imageLengthInMB = (Buffer.byteLength(imageBuffer) / (1024 * 1024)).toFixed(2)
    if (parseFloat(imageLengthInMB) > 3) {
        data.response = {
            statusCode: 400,
            body: {
                message: `Max image size should be 3 MB`
            }
        }
        return data
    }

    const imageId = uuidv4().replace(new RegExp("-", "g"), "")
    const imageFileName = PIMRepository.buildImageName(accountId, imageId, data.request.body.extension)
    await rdk.setFile({body: data.request.body.image, filename: imageFileName})

    const response: ImageResponse = {
        imageId,
        extension: data.request.body.extension,
        filename: imageFileName
    }

    data.tasks.push({
        after: TEMP_IMAGE_TTL_IN_SECONDS,
        method: "checkUploadedImage",
        payload: response
    })

    if (!data.state.private.tempImages) data.state.private.tempImages = []
    data.state.private.tempImages.push(imageFileName)

    data.response = {
        statusCode: 200,
        body: response
    }

    return data
}

export async function deleteUploadedTempImage(data: CatalogSettingsData): Promise<CatalogSettingsData> {

    if (data.state.private.tempImages.includes(data.request.body.filename)) {
        await rdk.deleteFile({filename: data.request.body.filename})
        data.state.private.tempImages = data.state.private.tempImages.filter(t => t !== data.request.body.filename)
    }

    return data
}

export async function checkUploadedImage(data: CatalogSettingsData): Promise<CatalogSettingsData> {
    const payload: ImageResponse = data.request.body

    if (data.state.private.tempImages.includes(payload.filename)) {
        await rdk.deleteFile({filename: payload.filename})
    }

    return data
}

const getAttachedImages = (categories: Category[], images = []) => {
    categories.map(category => {
        if (category.image) images.push(category.image)
        getAttachedImages(category.subCategories, images)
    })
    return images
}

import RDK, {Data, Response} from "@retter/rdk";
import {AccountIDInput, GetImageByRDKModel} from "./rio";
import mime from "mime-types";
import sharp from "sharp";

const rdk = new RDK();


export interface ImagePrivateState {
}

export interface ImagePublicState {
}

export type ImageData<Input = any, Output = any> = Data<Input, Output, ImagePublicState, ImagePrivateState>

export async function authorizer(data: ImageData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"

    if (isDeveloper) {
        return {statusCode: 200}
    }

    if (["getImageByRDK"].includes(data.context.methodName)) {
        return {statusCode: 200}
    }

    switch (data.context.methodName) {
        case 'DESTROY':
            if (data.context.identity === "AccountManager") {
                return {statusCode: 200}
            }
            break
        case 'STATE':
            if (isDeveloper) return {statusCode: 200}
            break
        case 'GET':
            return {statusCode: 200}
        case 'INIT':
            if (data.context.identity === "AccountManager" || isDeveloper) {
                return {statusCode: 200}
            }
            break
    }
    return {statusCode: 401};
}

export async function getInstanceId(data: ImageData<AccountIDInput>): Promise<string> {
    return data.request.body.accountId
}

export async function init(data: ImageData): Promise<ImageData> {
    return data
}

export async function getState(data: ImageData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

export async function getImageByRDK(data: ImageData<GetImageByRDKModel>): Promise<ImageData> {
    const filename = data.request.body.filename
    const file = await rdk.getFile({filename})
    if (!file || file.error) {
        throw new Error(file && file.error ? file.error : "file not found")
    }

    const originalExtension = filename.split(".").pop()
    const originalContentType = originalExtension ? mime.lookup(originalExtension) ? mime.lookup(originalExtension) as string : undefined : undefined

    if (
        data.request.body.compressionLevel &&
        data.request.body.format &&
        data.request.body.height &&
        data.request.body.quality &&
        data.request.body.width
    ) {
        data.response = {
            statusCode: 200,
            body: file.data,
            isBase64Encoded: true,
            headers: {
                "content-type": originalContentType
            }
        }
        return data
    }

    let out = sharp(Buffer.from(file.data, "base64"));

    if (data.request.body.height || data.request.body.width) {
        out = out.resize(data.request.body.width, data.request.body.height, {
            background: data.request.body.background,
            fit: data.request.body.fit,
        })
    }


    let format: any = originalExtension;

    if (data.request.body.format) {
        format = data.request.body.format
    }

    out = out.toFormat(format, {
        compressionLevel: data.request.body.compressionLevel,
        quality: data.request.body.quality
    })

    data.response = {
        statusCode: 200,
        body: (await out.toBuffer()).toString("base64"),
        isBase64Encoded: true,
        headers: {
            "content-type": mime.lookup(format) ? mime.lookup(format) as string : undefined,
        }
    }

    return data
}

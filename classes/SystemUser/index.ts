import RDK, {Data, Response} from "@retter/rdk";
import {SystemUserInitInput, ValidateEmailOtpInput} from "./rio";
import {Env} from "./env";
import fs from "fs";
import {Helpers, md5} from "./Helpers";
import AWS from "aws-sdk"

const rdk = new RDK()

interface SystemUserPrivateState {
    accountId: string
    email: string
    createdAt: string
    roles: string[]
    emailOtp: string
}

export type SystemUserData<Input = any, Output = any> = Data<Input, Output, any, SystemUserPrivateState>

export async function authorizer(data: SystemUserData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"
    let canGetUser = false

    if ([
        "AccountManager",
        "CatalogSettings",
        "Export",
        "Import",
        "InternalDestination",
        "Product",
        "ProductSettings",
        "System",
        "SystemUser"
    ]) {
        if (data.context.identity === "Product" && data.context.instanceId === data.context.userId.split("-").shift()) {
            canGetUser = true
        } else {
            canGetUser = true
        }
    }

    if (isDeveloper) {
        return {statusCode: 200}
    }

    const isInstanceOwner = data.context.instanceId === data.context.userId

    switch (data.context.methodName) {
        case 'getUser':
            if (isInstanceOwner || canGetUser) {
                return {statusCode: 200}
            }
            break
        case 'sendEmailOtp':
        case 'validateEmailOtp':
        case 'GET':
            return {statusCode: 200}
        case 'INIT':
            if (data.context.identity === "System" || isDeveloper) {
                return {statusCode: 200}
            }
            break
    }
    return {statusCode: 401};
}

export async function getInstanceId(data: SystemUserData<SystemUserInitInput>): Promise<string> {
    return md5(data.request.body.accountId + '#' + data.request.body.userEmail)
}

export async function init(data: SystemUserData<SystemUserInitInput>): Promise<SystemUserData> {
    data.state.private = {
        accountId: data.request.body.accountId,
        createdAt: new Date().toISOString(),
        email: data.request.body.userEmail,
        emailOtp: '',
        roles: data.request.body.roles
    }
    return data
}

export async function getState(data: SystemUserData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

async function generateToken(userId: string, email: string): Promise<string> {
    const tokenResult = await rdk.generateCustomToken({
        identity: 'system_user', userId, claims: {email}
    })
    return tokenResult.data.customToken
}

export async function getUser(data: SystemUserData): Promise<SystemUserData> {
    data.response = {
        statusCode: 200,
        body: {
            accountId: data.state.private.accountId,
            email: data.state.private.email,
            createdAt: data.state.private.createdAt,
            roles: data.state.private.roles,
        }
    }
    return data
}

export async function validateEmailOtp(data: SystemUserData<ValidateEmailOtpInput>): Promise<SystemUserData> {
    const TEST_EMAIL_OTP = Env.getOrUndefined('TEST_EMAIL_OTP')
    const EMAIL = data.state.private.email
    if (data.state.private.emailOtp === data.request.body.emailOtp ||
        (TEST_EMAIL_OTP && data.request.body.emailOtp === TEST_EMAIL_OTP)
    ) {
        delete data.state.private.emailOtp

        data.response = {
            statusCode: 200,
            body: {
                customToken: await generateToken(data.context.instanceId, EMAIL)
            }
        }
    } else {
        data.response = {
            statusCode: 403,
            body: {message: "Invalid OTP"}
        }
    }
    return data
}


export async function sendEmailOtp(data: SystemUserData): Promise<SystemUserData> {
    data.state.private.emailOtp = Helpers.generateOtp()
    const ses = new AWS.SESV2({
        accessKeyId: Env.getOrUndefined('ACCESS_KEY_ID'),
        secretAccessKey: Env.getOrUndefined('SECRET_ACCESS_KEY'),
        region: 'eu-west-1'
    });

    let htmlTemplate = ''
    try {
        htmlTemplate = fs.readFileSync('./OTP.html').toString('utf-8')
        htmlTemplate = htmlTemplate.replace('{{OTP_CODE}}', data.state.private.emailOtp)
    } catch (e) {
    }

    await ses.sendEmail({
        Destination: {
            ToAddresses: [data.state.private.email]
        },
        FromEmailAddress: Env.get('FROM_EMAIL_ADDRESS'),
        Content: {
            Simple: {
                Body: {
                    Text: {
                        Data: 'OTP: ' + data.state.private.emailOtp
                    },
                    Html: {
                        Data: htmlTemplate
                    }
                },
                Subject: {
                    Data: 'Sign in to Retter PIM'
                }
            }
        }
    }).promise()
    data.response = {statusCode: 204}
    return data
}

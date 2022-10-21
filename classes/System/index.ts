import {Data, Response} from "@retter/rdk";
import {Classes, SystemInitInput} from "./rio";
import SystemUser = Classes.SystemUser;


interface User {
    userEmail: string
    roles: string[]
}

export interface SystemPrivateState {
    users: User[]
}

export type SystemData<Input = any, Output = any> = Data<Input, Output, any, SystemPrivateState>

export async function authorizer(data: SystemData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"

    switch (data.context.methodName) {
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

export async function getInstanceId(data: SystemData<SystemInitInput>): Promise<string> {
    return data.request.body.accountId
}

export async function init(data: SystemData<SystemInitInput>): Promise<SystemData> {
    data.state.private = {
        users: [{
            userEmail: data.request.body.rootEmail,
            roles: ['root']
        }]
    }

    await SystemUser.getInstance({
        body: {
            accountId: data.request.body.accountId,
            userEmail: data.request.body.rootEmail,
            roles: ["root"]
        }
    })

    return data
}

export async function getState(data: SystemData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

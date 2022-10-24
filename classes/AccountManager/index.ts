import {Data, Response} from "@retter/rdk";
import {CreateAccountInput} from "./rio";
import {ClassInits} from "./class-inits";
import {generateAccountId} from "./helpers";


export interface AccountStateData extends CreateAccountInput {
    accountId: string
}

export interface AccountPrivateState {
    accounts: AccountStateData[]
}

export type AccountData<Input = any, Output = any> = Data<Input, Output, any, AccountPrivateState>

export async function authorizer(data: AccountData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"

    if (isDeveloper) {
        return {statusCode: 200}
    }

    switch (data.context.methodName) {
        case 'createAccount':
            if (isDeveloper) return {statusCode: 200}
            break
        case 'STATE':
            if (isDeveloper) return {statusCode: 200}
            break
        case 'GET':
            return {statusCode: 200}
        case 'INIT':
            if (isDeveloper) {
                return {statusCode: 200}
            }
            break
    }
    return {statusCode: 401};
}

export async function init(data: AccountData): Promise<AccountData> {
    data.state.private = {
        accounts: []
    }
    return data
}

export async function getState(data: AccountData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

export async function getInstanceId(data: AccountData): Promise<string> {
    return "AccountManager"
}

export async function createAccount(data: AccountData<CreateAccountInput>): Promise<AccountData> {
    const accountId = generateAccountId()
    const Account: AccountStateData = {
        ...data.request.body,
        accountId
    }
    data.state.private.accounts.push(Account)

    const classInits = new ClassInits(accountId)

    classInits.add({_class: "System", body: {rootEmail: data.request.body.rootEmail}})
    classInits.add({_class: "CatalogSettings"})
    classInits.add({_class: "ProductSettings"})
    classInits.add({_class: "Import"})
    classInits.add({_class: "Export"})
    classInits.add({_class: "API"})
    classInits.add({_class: "InternalDestination"})

    const results = await classInits.run()

    data.response = {
        statusCode: 200,
        body: {
            accountId,
            results
        }
    }

    return data
}

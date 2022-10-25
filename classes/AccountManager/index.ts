import RDK, {Data, Response} from "@retter/rdk";
import {CreateAccountInput} from "./rio";
import {ClassInits} from "./class-inits";
import {generateAccountId} from "./helpers";
import {ElasticHelper} from "./elastic";

const rdk = new RDK();


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

    const elasticHelper = new ElasticHelper(accountId);
    await elasticHelper.createIndex()

    data.response = {
        statusCode: 200,
        body: {
            accountId,
            results
        }
    }

    return data
}

export async function deleteAccount(data: AccountData): Promise<AccountData> {
    const accountId = data.request.body.accountId
    if (!accountId || accountId === "") {
        data.response = {
            statusCode: 400,
            body: {
                message: "accountId is required!"
            }
        }
        return data
    }

    await Promise.all([
        rdk.deleteInstance({classId: "System", instanceId: accountId}),
        rdk.deleteInstance({classId: "CatalogSettings", instanceId: accountId}),
        rdk.deleteInstance({classId: "ProductSettings", instanceId: accountId}),
        rdk.deleteInstance({classId: "Import", instanceId: accountId}),
        rdk.deleteInstance({classId: "Export", instanceId: accountId}),
        rdk.deleteInstance({classId: "API", instanceId: accountId}),
        rdk.deleteInstance({classId: "InternalDestination", instanceId: accountId}),
    ])

    const productInstances: {success: boolean, data: {instanceIds: string[]}} = (await rdk.listInstanceIds({classId: "Product"})) as any

    const elasticHelper = new ElasticHelper(accountId);
    try {
        await elasticHelper.deleteIndex()
    } catch (e) {
        if (!e.body || !e.body.error || e.body.error.type !== "index_not_found_exception") {
            data.response = {
                statusCode: 400,
                body: {
                    message: e.toString()
                }
            }
            return data
        }
    }

    data.state.private.accounts = data.state.private.accounts.filter(a => a.accountId !== accountId)
    return data
}

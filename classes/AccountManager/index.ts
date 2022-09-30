import {Data, Response} from "@retter/rdk";
import {Classes, CreateAccountInput} from "./rio";
import {v4 as uuidv4} from 'uuid';
import CatalogSettings = Classes.CatalogSettings;
import System = Classes.System;
import InternalDestination = Classes.InternalDestination;


export interface AccountStateData extends CreateAccountInput {
    accountId: string
}

export interface AccountPrivateState {
    accounts: AccountStateData[]
}

export type AccountData<Input = any, Output = any> = Data<Input, Output, any, AccountPrivateState>

export async function authorizer(data: AccountData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"
    switch (data.context.methodName) {
        case 'createAccount':
            if (isDeveloper) return {statusCode: 200}
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
    const accountId = uuidv4().replace(new RegExp(/-/, 'g'), '')
    const Account: AccountStateData = {
        ...data.request.body,
        accountId
    }
    data.state.private.accounts.push(Account)

    let catalogSettings;
    let system;
    let internalDestination;
    let api;

    try {
        await CatalogSettings.getInstance({body: {accountId}})
        catalogSettings = "DONE"
    } catch (e) {
        catalogSettings = "FAIL - " + e.toString()
    }

    try {
        await System.getInstance({body: {accountId, rootEmail: data.request.body.rootEmail}})
        system = "DONE"
    } catch (e) {
        system = "FAIL - " + e.toString()
    }

    try {
        await InternalDestination.getInstance({body: {accountId}})
        internalDestination = "DONE"
    } catch (e) {
        internalDestination = "FAIL - " + e.toString()
    }

    try {
        await Classes.API.getInstance({body: {accountId}})
        api = "DONE"
    } catch (e) {
        api = "FAIL - " + e.toString()
    }

    data.response = {
        statusCode: 200,
        body: {
            accountId,
            catalogSettings,
            system,
            internalDestination,
            api
        }
    }

    return data
}

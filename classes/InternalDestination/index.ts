import {Data, Response} from "@retter/rdk";
import {AccountIDInput, ElasticProductHandlerMethod, InternalDestinationProductHandlerInput} from "./rio";
import {Client} from "@elastic/elasticsearch";
import {Env} from "./env";
const client = new Client({
    cloud:{
        id: Env.get("ELASTIC_CLOUD_ID")
    },
    auth: {
        username: Env.get("ELASTIC_CLOUD_USERNAME"),
        password: Env.get("ELASTIC_CLOUD_PASSWORD")
    }
})

const ELASTIC_INDEX_PREFIX = "search"

export interface InternalDestinationPrivateState {
}

export type InternalDestinationData<Input = any, Output = any> = Data<Input, Output, any, InternalDestinationPrivateState>

export async function authorizer(data: InternalDestinationData): Promise<Response> {
    const isDeveloper = data.context.identity === "developer"

    if ([
        "productHandler"
    ].includes(data.context.methodName)) {
        return {statusCode: 200}
    }

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

export async function getInstanceId(data: InternalDestinationData<AccountIDInput>): Promise<string> {
    return data.request.body.accountId
}

export async function init(data: InternalDestinationData): Promise<InternalDestinationData> {
    return data
}

export async function getState(data: InternalDestinationData): Promise<Response> {
    return {statusCode: 200, body: data.state};
}

export async function productHandler(data: InternalDestinationData<InternalDestinationProductHandlerInput>): Promise<InternalDestinationData>{
    switch (data.request.body.method) {
        case ElasticProductHandlerMethod.Create:
            if(!data.request.body.product) throw new Error("Product can not be null!")
            await client.create({
                index: ELASTIC_INDEX_PREFIX + "-" + data.context.instanceId,
                id: data.request.body.productInstanceId,
                document: data.request.body.product
            })
            break
        case ElasticProductHandlerMethod.Update:
            if(!data.request.body.product) throw new Error("Product can not be null!")
            await client.update({
                index: ELASTIC_INDEX_PREFIX + "-" + data.context.instanceId,
                id: data.request.body.productInstanceId,
                doc: data.request.body.product
            })
            break
        case ElasticProductHandlerMethod.Delete:
            await client.delete({
                index: ELASTIC_INDEX_PREFIX + "-" + data.context.instanceId,
                id: data.request.body.productInstanceId,
            })
            break
        default:
            throw new Error("Invalid handler method!")
    }
    return data
}

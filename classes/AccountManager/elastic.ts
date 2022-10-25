import {Client} from "@elastic/elasticsearch";
import {Env} from "./env";

const client = new Client({
    cloud: {
        id: Env.get("ELASTIC_CLOUD_ID")
    },
    auth: {
        username: Env.get("ELASTIC_CLOUD_USERNAME"),
        password: Env.get("ELASTIC_CLOUD_PASSWORD")
    }
})
const ELASTIC_INDEX_PREFIX = "search"

export class ElasticHelper {
    private readonly _accountId: string
    private readonly _index: string

    constructor(accountId: string) {
        this._accountId = accountId
        this._index = ELASTIC_INDEX_PREFIX + "-" + accountId
    }

    async createIndex() {
        await client.indices.create({
            index: this._index
        })
    }

    async deleteIndex() {
        await client.indices.delete({
            index: this._index
        })
    }

}

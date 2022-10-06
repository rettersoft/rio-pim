import {Client} from "@elastic/elasticsearch";
import {DataType} from "../Product/models";
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

    async getProducts(props?: { pageSize?: number, pageFrom?: number, filters?: { family?: string, parent?: string, variant?: string, dataType?: DataType } }) {
        const query = {
            bool: {
                must: []
            }
        }

        if (props && props.filters) {
            if (props.filters.family) query.bool.must.push({match: {"data.family": props.filters.family}})
            if (props.filters.parent) query.bool.must.push({match: {"parent": props.filters.parent}})
            if (props.filters.variant) query.bool.must.push({match: {"data.variant": props.filters.variant}})
            if (props.filters.dataType) query.bool.must.push({match: {"dataType": props.filters.parent}})
        }

        return await client.search({
            index: this._index,
            from: props?.pageFrom,
            size: props?.pageSize,
            query,
        })
    }

}

import {Client} from "@elastic/elasticsearch";
import {Env} from "./env";
import {GetProductsInput} from "./rio";

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

    async getProducts(props?: GetProductsInput) {
        const pageFrom = props?.pageFrom || 0
        const pageSize = props?.pageSize || 50

        const query = {
            bool: {
                must: []
            }
        }

        if (props && props.filters) {
            if (props.filters.family) query.bool.must.push({match: {"data.family": props.filters.family}})
            if (props.filters.parent) query.bool.must.push({match: {"parent": props.filters.parent}})
            if (props.filters.variant) query.bool.must.push({match: {"data.variant": props.filters.variant}})
            if (props.filters.dataType) query.bool.must.push({match: {"dataType": props.filters.dataType}})
        }

        if (props && props.filters && props.filters.isVariant !== undefined) {
            if (props.filters.isVariant) {
                query.bool.must.push({exists: {field: "parent"}})
            } else {
                query.bool["must_not"] = [{exists: {field: "parent"}}]
            }
        }

        if (props && props.searchText) {
            query.bool.must.push({
                query_string: {
                    fields: ["data.sku", "data.code"],
                    query: `*${props.searchText}*`,
                    default_operator: "AND"
                }
            })
        }

        const result = await client.search({
            index: this._index,
            from: pageFrom,
            size: pageSize,
            query,
        })

        return {
            from: pageFrom,
            size: pageSize,
            result
        }
    }

}

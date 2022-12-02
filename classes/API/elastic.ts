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

        const sort = []

        const query = {
            bool: {
                must: [],
                must_not: [],
                should: []
            }
        }

        if (props && props.filters) {
            if (props.filters.family) query.bool.must.push({match: {"data.family": props.filters.family}})
            if (props.filters.parent) query.bool.must.push({match: {"parent": props.filters.parent}})
            if (props.filters.variant) query.bool.must.push({match: {"data.variant": props.filters.variant}})
            if (props.filters.dataType) query.bool.must.push({match: {"dataType": props.filters.dataType}})
            if (props.filters.isVariant !== undefined) {
                query.bool[(props.filters.isVariant ? "must" : "must_not")].push({exists: {field: "parent"}})
            }
            if (props.filters.group) {
                const forceGroupFilter = props.filters.forceGroupFilter === undefined ? true : props.filters.forceGroupFilter
                query.bool[(forceGroupFilter ? "must" : "should")].push({match_phrase: {"data.groups": props.filters.group}})
            }
        }

        if (props && props.sorts) {
            if (props.sorts.family) sort.push({"data.family.enum": props.sorts.family})
            if (props.sorts.id) {
                sort.push({"data.sku.enum": props.sorts.id})
                sort.push({"data.code.enum": props.sorts.id})
            }
            if (props.sorts.createdAt) sort.push({"meta.createdAt": props.sorts.createdAt})
            if (props.sorts.updatedAt) sort.push({"meta.updatedAt": props.sorts.updatedAt})
            if (props.sorts.enabled) sort.push({"data.enabled": props.sorts.enabled})
            if (props.sorts.label) sort.push({"attributeAsLabel.enum": props.sorts.label})
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
            sort
        })

        return {
            from: pageFrom,
            size: pageSize,
            result
        }
    }

}

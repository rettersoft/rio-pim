import {AxesValuesList} from "./models";
import _ from "lodash";

export function getProductAttributeKeyMap(props: {
    accountId: string, attributeCode: string, attributeValue: string
}): { partKey: string, sortKey: string } {
    return {
        partKey: [props.accountId, "unique", props.attributeCode].join("-"),
        sortKey: props.attributeValue
    }
}


export function getProductAxeKeyMap(props: { accountId: string, productModelCode: string, axesValues: AxesValuesList }): { partKey: string, sortKey: string } {

    return {
        partKey: [props.accountId, "productVariant", props.productModelCode].join("-"),
        sortKey: _.sortBy(props.axesValues, "axe").map(av => (av.axe + "#" + av.value)).join("-")
    }
}

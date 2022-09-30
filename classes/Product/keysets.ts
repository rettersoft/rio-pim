import {AxesValuesList} from "./models";

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
        sortKey: props.axesValues.map(av => (av.axe + "#" + av.value)).join("-")
    }
}

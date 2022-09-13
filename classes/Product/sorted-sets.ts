export function getProductAttributeSortedSetKeyMap(props: {
    accountId: string, attributeCode: string, attributeValue: string
}): { setName: string, sortKey: string } {
    return {
        setName: props.accountId,
        sortKey: "unique-" + props.attributeCode + "-" + props.attributeValue
    }
}

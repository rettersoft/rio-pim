const EXECUTION_PART_KEY_PREFIX = "import_execution"


export function getExecutionPartKey(accountId: string, profileCode: string) {
    return [EXECUTION_PART_KEY_PREFIX, accountId, profileCode].join("#")
}

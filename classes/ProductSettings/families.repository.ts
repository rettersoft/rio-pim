import {ProductSettingsData} from "./index";
import {AttributeTypes, Code} from "PIMModelsPackage";


export const ALLOWED_AXE_TYPES = [AttributeTypes.Enum.SIMPLESELECT, AttributeTypes.Enum.BOOLEAN]

export function getFamily(code: string | undefined, data: ProductSettingsData) {
    const result = Code.safeParse(code)
    if (result.success === false) throw new Error("Invalid family code!")

    const item = data.state.public.families.find(a => a.code === result.data)

    if (!item) throw new Error("Family not found!")

    return item
}

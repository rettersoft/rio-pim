import {Classes} from "./rio";
import {ProductData} from "./index";


export async function checkUserRole(data: ProductData) {
    if(data.context.identity === "developer"){
        return true
    }
    if (data.context.identity === "system_user") {
        try {
            const result = await new Classes.SystemUser(data.context.userId).getUser()
            if (result.statusCode >= 400 || result.body.accountId !== data.request.body.accountId) {
                throw new Error("Permission Denied! (User not found)")
            }
        } catch (e) {
            throw new Error(`Permission Denied! (${e.toString()})`)
        }
    } else {
        throw new Error("Permission Denied! (Invalid user identity)")
    }
}

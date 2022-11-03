import {Classes} from "./rio";

export class PIMMiddlewarePackage {

    async checkUserRole(props: { accountId: string, identity: string, userId: string }) {
        if (props.identity === "developer") {
            return true
        }
        if (props.identity === "system_user") {
            try {
                const result = await new Classes.SystemUser(props.userId).getUser()
                if (!result || result.statusCode >= 400 || result.body.accountId !== props.accountId) {
                    throw new Error("Permission Denied! (User not found)")
                }
            } catch (e) {
                throw new Error(`Permission Denied! (${e.toString()})`)
            }
        } else {
            throw new Error("Permission Denied! (Invalid user identity)")
        }
    }


}

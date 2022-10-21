import {APIData} from "./index";
import {MiddlewarePackage} from "MiddlewarePackage";


export async function checkUserRoleIfUser(data: APIData){
    if(data.context.identity === "system_user"){
        const middlewarePackage = new MiddlewarePackage();
        await middlewarePackage.checkUserRole({accountId: data.context.instanceId, userId: data.context.userId, identity: data.context.identity})
    }
}

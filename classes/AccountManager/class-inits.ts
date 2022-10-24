import {Classes} from "./rio";

export class ClassInits {
    private readonly _accountId: string
    private _methods: Array<{ _class: string, body?: any }> = []

    constructor(accountId: string) {
        this._accountId = accountId
    }

    add(props: { _class: string, body?: any }) {
        this._methods.push(props)
    }

    async run() {
        return await Promise.all(this._methods.map(_method => {
            return new Promise(async (resolve) => {
                try {
                    await Classes[_method._class].getInstance({body: {..._method.body, accountId: this._accountId}})
                    resolve({
                        [_method._class]: {
                            status: "done"
                        }
                    })
                } catch (e) {
                    resolve({
                        [_method._class]: {
                            status: "fail",
                            reason: e.toString()
                        }
                    })
                }
            })
        }))
    }
}

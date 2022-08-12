import Z from "zod"
import {Currencies, Locales} from "./consts";

export const Currency = Z.string().refine((val)=>Currencies.findIndex(l=>l.id === val) !== -1,
    "Invalid currency value!")

export const Locale = Z.string().refine((val)=>Locales.findIndex(l=>l.id === val) !== -1,
        "Invalid locale value!")

export const LocaleSet = Z.object({
    locale: Locale,
    value: Z.string()
})
export type Locale = Z.infer<typeof LocaleSet>

export const Label = Z.array(LocaleSet).default([])
export type Label = Z.infer<typeof Label>

export const Code = Z.string().min(1).max(100).regex(new RegExp(/^([A-Za-z0-9_])*$/g))

export const Category = Z.lazy(() => {
    return Z.object({
        code: Code,
        label: Label.optional(),
        subCategories: Z.array(Category).default([])
    })
})
export type Category = Z.infer<typeof Category>


export const Channel = Z.object({
    code: Code,
    currencies: Z.array(Currency).min(1).max(285),
    locales: Z.array(Locale).min(1).max(442),
    categoryTree: Z.string().min(1),
    label: Label.optional(),
})
export type Channel = Z.infer<typeof Channel>


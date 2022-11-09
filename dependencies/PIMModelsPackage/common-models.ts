import Z from "zod";
import {Currencies, Locales} from "./constants";

export const Url = Z.string().url().optional()
export const Code = Z.string().min(1).max(100).regex(new RegExp(/^([A-Za-z0-9_])*$/g))
export const ProductCategoryCode = Z.string().min(1).max(500).regex(new RegExp(/^([A-Za-z0-9_#])*$/g))
export const Codes = Z.array(Code)

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

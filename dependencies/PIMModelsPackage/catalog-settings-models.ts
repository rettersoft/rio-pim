import Z from "zod";
import {Code, Currency, Label, Locale} from "./common-models";

export const Category = Z.lazy(() => {
    return Z.object({
        code: Code,
        label: Label.optional(),
        image: Z.string().optional(),
        meta: Z.any().optional(),
        subCategories: Z.array(Category).default([])
    })
})
export type Category = Z.infer<typeof Category>
export const Categories = Z.array(Category)


export const Channel = Z.object({
    code: Code,
    currencies: Z.array(Currency).min(1).max(285),
    locales: Z.array(Locale).min(1).max(442),
    categoryTree: Z.string().min(1),
    label: Label.optional(),
})
export type Channel = Z.infer<typeof Channel>
export const Channels = Z.array(Channel)

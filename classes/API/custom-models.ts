import Z from "zod";
import {Fit, Format} from "./rio";

export const GetImageInputForAPI = Z.object({
    background: Z.string().optional(),
    compressionLevel: Z.preprocess((val: any) => {
        return parseInt(val as any)
    }, Z.number().min(0).max(9)).optional(),
    filename: Z.string(),
    fit: Z.nativeEnum(Fit).optional(),
    format: Z.nativeEnum(Format).optional(),
    height: Z.preprocess((val: any) => {
        return parseInt(val as any)
    }, Z.number()).optional(),
    quality: Z.preprocess((val: any) => {
        return parseInt(val as any)
    }, Z.number().min(1).max(100)).optional(),
    width: Z.preprocess((val: any) => {
        return parseInt(val as any)
    }, Z.number()).optional(),
})

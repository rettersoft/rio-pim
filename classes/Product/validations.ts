import RDK from "@retter/rdk"
import {getProductAttributeKeyMap, getProductAxeKeyMap} from "./keysets";
import {ClassesRepository, GetCatalogSettingsResult, GetProductsSettingsResult} from "./classes-repository";
import {ModelsRepository} from "./models-repository";
import {
    AttributeOption,
    AttributeTypes,
    AxesValuesList,
    BaseAttribute,
    Category,
    DATE,
    Family,
    FamilyVariant,
    IDENTIFIER,
    IMAGE,
    NUMBER,
    PimValidationRules,
    PRICE,
    Product,
    ProductAttribute,
    ProductModel,
    TEXT,
    TEXTAREA
} from "PIMModelsPackage";

const rdk = new RDK()

export function checkProductGroups(props: { product: Product, productSettings: GetProductsSettingsResult }) {
    if (props.product.groups.length) {
        for (const group of props.product.groups) {
            if (!props.productSettings.groups.find(g => g.code === group)) {
                throw new Error(`Group not found! (${group})`)
            }
        }
    }
}

export function checkProductCategories(props: { product: Product | ProductModel, catalogSettings: GetCatalogSettingsResult }) {
    if (props.product.categories.length) {
        const getCategoriesInOneLevel = (categories: Category[], data = [], parentCode?: string) => {
            if (categories.length >= 1) {
                for (const category of categories) {
                    const code = [parentCode, category.code].filter(Boolean).join("#")
                    data.push({
                        code,
                        parent: parentCode,
                    })
                    getCategoriesInOneLevel(category.subCategories, data, code)
                }
            } else {
                return []
            }
            return data
        }
        const categoriesInOneLevel = getCategoriesInOneLevel(props.catalogSettings.categories)
        for (const category of props.product.categories) {
            if (!categoriesInOneLevel.find(c => c.code === category)) {
                throw new Error(`Category not found! (${category})`)
            }
        }
    }
}

export async function validateProductAttributes(props: { productFamily: string, productAttributes: ProductAttribute[], accountId: string, productSettings: GetProductsSettingsResult }) {

    const familyData: Family = props.productSettings.families.find(f => f.code === props.productFamily)
    if (!familyData) throw new Error("Product family not found!")

    //detect duplicated attributes
    for (const productAttribute of props.productAttributes) {
        if(props.productAttributes.filter(a=>a.code === productAttribute.code).length > 1){
            throw new Error(`Duplicated attribute detected! (${productAttribute.code})`)
        }
    }

    for (const familyAttribute of familyData.attributes) {
        const productAttribute: ProductAttribute | undefined = props.productAttributes.find(pa => pa.code === familyAttribute.attribute)

        const attributeProperty = props.productSettings.attributes.find(ap => ap.code === familyAttribute.attribute)
        if (!attributeProperty) throw new Error(`Attribute property not found! (${familyAttribute.attribute})`)

        if (familyAttribute.requiredChannels && familyAttribute.requiredChannels.length) {
            for (const requiredChannel of familyAttribute.requiredChannels) {
                if (!productAttribute || !productAttribute.data || (productAttribute.data.find(d => d.scope === requiredChannel) || {}).value === undefined ||
                    (productAttribute.data.find(d => d.scope === requiredChannel) || {}).value === "") {
                    throw new Error(`${familyAttribute.attribute} is required in this channel! (${requiredChannel})`)
                }
            }
        }

        if (!productAttribute) continue


        if (attributeProperty.scopable === false) {
            if (productAttribute.data.find(d => d.scope)) {
                throw new Error(`${productAttribute.code} is not scopable!`)
            }
        }

        if (attributeProperty.localizable === false) {
            if (productAttribute.data.find(d => d.locale)) {
                throw new Error(`${productAttribute.code} is not localizable!`)
            }
        }

        if (attributeProperty.isLocaleSpecific === true) {
            for (const datum of productAttribute.data) {
                if (!attributeProperty.availableLocales.includes(datum.locale)) {
                    throw new Error(`${productAttribute.code} has invalid locale, ${datum.locale}`)
                }
            }
        }

        switch (attributeProperty.type) {
            case AttributeTypes.Enum.TEXT:
                const TEXT_ATTRIBUTE: TEXT = attributeProperty
                if (TEXT_ATTRIBUTE.maxCharacters !== undefined) {
                    for (const datum of productAttribute.data) {
                        if (datum.value.length > TEXT_ATTRIBUTE.maxCharacters) {
                            throw new Error(`${productAttribute.code} maximum length should be ${TEXT_ATTRIBUTE.maxCharacters}`)
                        }
                    }
                }
                if (TEXT_ATTRIBUTE.validationRule !== undefined) {
                    let regex = ""
                    switch (TEXT_ATTRIBUTE.validationRule) {
                        case PimValidationRules.Enum.EMAIL:
                            regex = "^[\\w-\.]+@([\\w-]+\.)+[\\w-]{2,4}$"
                            break
                        case PimValidationRules.Enum.URL:
                            regex = "^https?:\\/\\/(?:www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b(?:[-a-zA-Z0-9()@:%_\\+.~#?&\\/=]*)$"
                            break
                        case PimValidationRules.Enum.REGEXP:
                            if (TEXT_ATTRIBUTE.validationRegexp === undefined) {
                                throw new Error("Validation regexp is null!")
                            }
                            regex = TEXT_ATTRIBUTE.validationRegexp
                            break
                        default:
                            throw new Error(`Invalid validation rule! (${TEXT_ATTRIBUTE.validationRule})`)
                    }
                    for (const datum of productAttribute.data) {
                        if (!new RegExp(regex, "g").test(datum.value)) {
                            throw new Error(`${productAttribute.code}, invalid regex format, ${TEXT_ATTRIBUTE.maxCharacters}`)
                        }
                    }
                }
                break
            case AttributeTypes.Enum.TEXTAREA:
                const TEXTAREA: TEXTAREA = attributeProperty
                if (TEXTAREA.maxCharacters !== undefined) {
                    for (const datum of productAttribute.data) {
                        if (datum.value.length > TEXTAREA.maxCharacters) {
                            throw new Error(`${productAttribute.code} maximum length should be ${TEXTAREA.maxCharacters}`)
                        }
                    }
                }
                break
            case AttributeTypes.Enum.BOOLEAN:
                break
            case AttributeTypes.Enum.IDENTIFIER:
                const IDENTIFIER: IDENTIFIER = attributeProperty
                if (IDENTIFIER.maxCharacters !== undefined) {
                    for (const datum of productAttribute.data) {
                        if (datum.value.length > IDENTIFIER.maxCharacters) {
                            throw new Error(`${productAttribute.code} maximum length should be ${IDENTIFIER.maxCharacters}`)
                        }
                    }
                }
                if (IDENTIFIER.validationRule !== undefined) {
                    let regex = ""
                    switch (IDENTIFIER.validationRule) {
                        case PimValidationRules.Enum.EMAIL:
                            regex = "^[\\w-\.]+@([\\w-]+\.)+[\\w-]{2,4}$"
                            break
                        case PimValidationRules.Enum.URL:
                            regex = "^https?:\\/\\/(?:www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b(?:[-a-zA-Z0-9()@:%_\\+.~#?&\\/=]*)$"
                            break
                        case PimValidationRules.Enum.REGEXP:
                            if (IDENTIFIER.validationRegexp === undefined) {
                                throw new Error("Validation regexp is null!")
                            }
                            regex = IDENTIFIER.validationRegexp
                            break
                        default:
                            throw new Error(`Invalid validation rule! (${IDENTIFIER.validationRule})`)
                    }
                    for (const datum of productAttribute.data) {
                        if (new RegExp(regex, "g").test(datum.value)) {
                            throw new Error(`${productAttribute.code}, invalid regex format, ${IDENTIFIER.maxCharacters}`)
                        }
                    }
                }
                break
            case AttributeTypes.Enum.NUMBER:
                const NUMBER: NUMBER = attributeProperty
                if (NUMBER.negativeAllowed === false) {
                    for (const datum of productAttribute.data) {
                        if (datum.value < 0) {
                            throw new Error(`${productAttribute.code} should not be negative!`)
                        }
                    }
                }
                if (NUMBER.maxNumber !== undefined) {
                    for (const datum of productAttribute.data) {
                        if (datum.value > NUMBER.maxNumber) {
                            throw new Error(`${productAttribute.code} should not be greater than ${NUMBER.maxNumber}!`)
                        }
                    }
                }
                if (NUMBER.minNumber !== undefined) {
                    for (const datum of productAttribute.data) {
                        if (datum.value < NUMBER.minNumber) {
                            throw new Error(`${productAttribute.code} should not be less than ${NUMBER.minNumber}!`)
                        }
                    }
                }
                if (NUMBER.decimalsAllowed === false) {
                    for (const datum of productAttribute.data) {
                        if (!Number.isSafeInteger(datum.value)) {
                            throw new Error(`${productAttribute.code} should not be decimal!`)
                        }
                    }
                }
                break
            case AttributeTypes.Enum.IMAGE:
                const IMAGE: IMAGE = attributeProperty
                if (IMAGE.allowedExtensions !== undefined) {
                    for (const datum of productAttribute.data) {
                        const ext = datum.value.split('.').pop()
                        if (!IMAGE.allowedExtensions.includes(ext)) {
                            throw new Error(`${productAttribute.code} extension is invalid!`)
                        }
                    }
                }
                break
            case AttributeTypes.Enum.MULTISELECT:
                break
            case AttributeTypes.Enum.SIMPLESELECT:
                break
            case AttributeTypes.Enum.DATE:
                const DATE: DATE = attributeProperty
                if (DATE.minDate !== undefined) {
                    for (const datum of productAttribute.data) {
                        if (new Date(datum.value) < DATE.minDate) {
                            throw new Error(`${productAttribute.code} should not be less than ${DATE.minDate}!`)
                        }
                    }
                }
                if (DATE.maxDate !== undefined) {
                    for (const datum of productAttribute.data) {
                        if (new Date(datum.value) > DATE.maxDate) {
                            throw new Error(`${productAttribute.code} should not be greater than ${DATE.maxDate}!`)
                        }
                    }
                }
                break
            case AttributeTypes.Enum.PRICE:
                const PRICE: PRICE = attributeProperty
                if (PRICE.decimalsAllowed === false) {
                    for (const datum of productAttribute.data) {
                        if (!Number.isSafeInteger(datum.value)) {
                            throw new Error(`${productAttribute.code} should not be decimal!`)
                        }
                    }
                }
                if (PRICE.maxNumber !== undefined) {
                    for (const datum of productAttribute.data) {
                        if (datum.value > PRICE.maxNumber) {
                            throw new Error(`${productAttribute.code} should not be greater than ${PRICE.maxNumber}!`)
                        }
                    }
                }
                if (PRICE.minNumber !== undefined) {
                    for (const datum of productAttribute.data) {
                        if (datum.value < PRICE.minNumber) {
                            throw new Error(`${productAttribute.code} should not be less than ${PRICE.minNumber}!`)
                        }
                    }
                }
                break
            default:
                throw new Error("Invalid attribute type!")
        }

    }

    // validate product unique attributes
    for (const attribute of props.productAttributes) {
        const attributeProperty = props.productSettings.attributes.find(ap => ap.code === attribute.code)
        if (!attributeProperty) throw new Error(`Attribute property not found! (${attribute.code})`)

        if (attributeProperty.isUnique) {
            if (attribute.data.length > 1) throw new Error("Unique attribute data should only have one value!")
            if (attribute.data[0].locale !== undefined || attribute.data[0].scope !== undefined) {
                throw new Error("Unique attribute should not be scopable or localizable!")
            }
            if (typeof attribute.data[0].value !== "string") throw new Error("Unique attribute should be string!")
            const val = attribute.data[0].value
            const sortSetResult = await rdk.readDatabase(getProductAttributeKeyMap({
                accountId: props.accountId,
                attributeValue: val,
                attributeCode: attribute.code
            }))
            if (sortSetResult.success) {
                throw new Error("This unique attribute value already taken!")
            }
        }
    }

}


/**
 * check product
 * @param props
 */
export async function checkProduct(props: { data: any, accountId: string, productSettings: GetProductsSettingsResult, catalogSettings: GetCatalogSettingsResult }): Promise<Product> {
    const product = ModelsRepository.getProduct(props.data)

    const productFamily = props.productSettings.families.find(f => f.code === product.family)
    if (!productFamily) {
        throw new Error("Product family not found!")
    }

    if (product.attributes !== undefined) {
        await validateProductAttributes({
            accountId: props.accountId,
            productAttributes: product.attributes,
            productFamily: product.family,
            productSettings: props.productSettings
        })
    }

    checkProductGroups({
        product: product, productSettings: props.productSettings
    })
    checkProductCategories({
        product: product, catalogSettings: props.catalogSettings
    })

    return product
}

/**
 * check product Model
 * @param props
 */
export async function checkProductModel(props: { data: any, accountId: string, productSettings: GetProductsSettingsResult, catalogSettings: GetCatalogSettingsResult }): Promise<ProductModel> {
    const productModel = ModelsRepository.getProductModel(props.data)

    const productModelFamily = props.productSettings.families.find(f => f.code === productModel.family)
    if (!productModelFamily) {
        throw new Error("Product family not found!")
    }

    const productModelVariant = productModelFamily.variants.find(v => v.code === productModel.variant)
    if (!productModelVariant) {
        throw new Error("Product family variant not found!")
    }

    if (productModel.attributes !== undefined) {
        await validateProductAttributes({
            accountId: props.accountId,
            productAttributes: productModel.attributes,
            productFamily: productModel.family,
            productSettings: props.productSettings
        })
    }

    checkProductCategories({
        product: productModel, catalogSettings: props.catalogSettings
    })

    return productModel
}

/**
 * check product model variant
 * @param props
 */
export async function checkProductModelVariant(props: {
    data: any, accountId: string, parent?: string, axesValues: any[],
    productSettings: GetProductsSettingsResult, catalogSettings: GetCatalogSettingsResult
}): Promise<{ parentProduct: ProductModel, childProduct: Product }> {
    if (!props.parent) {
        throw new Error("Parent field is required!")
    }

    const parentProduct = await ClassesRepository.getProduct<ProductModel>(props.accountId, props.parent)

    const parentProductFamilySettings = props.productSettings.families.find(f => f.code === parentProduct.data.family)
    if (!parentProductFamilySettings) {
        throw new Error("Parent product family not found!")
    }

    const parentProductFamilyVariantSettings = parentProductFamilySettings.variants.find(v => v.code === parentProduct.data.variant)
    if (!parentProductFamilyVariantSettings) {
        throw new Error("Parent product family variant not found!")
    }

    // overwrite given data family by parent product
    props.data.family = parentProduct.data.family

    const product = ModelsRepository.getProduct(props.data)

    if (product.attributes !== undefined) {
        for (const productAttribute of product.attributes) {
            if (parentProductFamilyVariantSettings.axes.find(a => a === productAttribute.code)) {
                throw new Error(`You can not edit an axe in the attributes! (${productAttribute.code})`)
            }
            if (!parentProductFamilyVariantSettings.attributes.find(a => a === productAttribute.code)) {
                throw new Error(`You can not edit common attributes in a variant! (${productAttribute.code})`)
            }
        }
        await validateProductAttributes({
            accountId: props.accountId,
            productAttributes: product.attributes,
            productFamily: product.family,
            productSettings: props.productSettings
        })
    }

    checkProductGroups({
        product: product, productSettings: props.productSettings
    })
    checkProductCategories({
        product: product, catalogSettings: props.catalogSettings
    })

    return {
        childProduct: product,
        parentProduct: parentProduct.data
    }
}

/**
 * check product model variant axes for INIT
 * @param props
 */
export async function checkVariantAxesForInit(props: {
    accountId: string, axesValues: any[], parentProductModel: ProductModel, childProduct: Product,
    productSettings: GetProductsSettingsResult
}): Promise<AxesValuesList> {
    const axesValues = ModelsRepository.getAxesValuesList(props.axesValues)

    const variantSettings: FamilyVariant = props.productSettings.families.find(f => f.code === props.parentProductModel.family).variants.find(v => v.code === props.parentProductModel.variant)

    for (const axe of variantSettings.axes) {
        const axeVal = axesValues.find(d => d.axe === axe)?.value
        if (axeVal === undefined || axeVal === "") {
            throw new Error(`Axe value required! (${axe})`)
        }
    }

    for (const axeValue of axesValues) {
        if (!variantSettings.axes.includes(axeValue.axe)) {
            throw new Error(`Unsupported axe! (${axeValue.axe})`)
        } else {
            const axeProperty: BaseAttribute = props.productSettings.attributes.find(attr => attr.code === axeValue.axe)
            if (!axeProperty) {
                throw new Error("Axe attribute property not found!")
            }
            if (axeProperty.type === AttributeTypes.Enum.SIMPLESELECT) {
                const selectOptions: AttributeOption | undefined = props.productSettings.attributeOptions.find(opt => opt.code === axeValue.axe)
                if (!selectOptions?.options.find(so => so.code === axeValue.value)) throw new Error("Invalid axe value!")
            }
        }
    }

    const axesSet = await rdk.readDatabase(getProductAxeKeyMap({
        accountId: props.accountId,
        productModelCode: props.parentProductModel.code,
        axesValues
    }))
    if (axesSet.success) {
        throw new Error("These axes are already in use!")
    }

    return axesValues
}

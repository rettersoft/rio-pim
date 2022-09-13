import {
    AttributeOption,
    AttributeTypes,
    BaseAttribute,
    BOOLEAN,
    DATE,
    Family,
    IDENTIFIER,
    IMAGE,
    MULTISELECT,
    NUMBER,
    PimValidationRules,
    PRICE,
    ProductAttribute,
    SIMPLESELECT,
    TEXT,
    TEXTAREA
} from "./models";
import RDK from "@retter/rdk"
import {getProductAttributeSortedSetKeyMap} from "./sorted-sets";

const rdk = new RDK()

export async function validateProductUniqueAttributes(attributes: ProductAttribute[], attributeProperties: BaseAttribute[], accountId: string) {
    for (const attribute of attributes) {
        const attributeProperty = attributeProperties.find(ap => ap.code === attribute.code)
        if (!attributeProperty) throw new Error(`Attribute property not found! (${attribute.code})`)

        if (attributeProperty.isUnique) {
            if (attribute.data.length > 1) throw new Error("Unique attribute data should only have one value!")
            if (attribute.data[0].locale !== undefined || attribute.data[0].scope !== undefined) {
                throw new Error("Unique attribute should not be scopable or localizable!")
            }
            if (typeof attribute.data[0].value !== "string") throw new Error("Unique attribute should be string!")
            const val = attribute.data[0].value
            const sortSetResult = await rdk.getFromSortedSet(getProductAttributeSortedSetKeyMap({
                accountId,
                attributeValue: val,
                attributeCode: attribute.code
            }))
            if (sortSetResult.success) {
                throw new Error("This unique attribute value already taken!")
            }
        }
    }

}

export async function validateProductAttributes(productFamily: string, productAttributes: ProductAttribute[], productSettings: {
    attributes: BaseAttribute[],
    attributeOptions: AttributeOption[],
    families: Family[]
}) {

    const familyData: Family = productSettings.families.find(f => f.code === productFamily)
    if (!familyData) throw new Error("Product family not found!")

    for (const familyAttribute of familyData.attributes) {
        const productAttribute: ProductAttribute | undefined = productAttributes.find(pa => pa.code === familyAttribute.attribute)

        const attributeProperty = productSettings.attributes.find(ap => ap.code === familyAttribute.attribute)
        if (!attributeProperty) throw new Error(`Attribute property not found! (${familyAttribute.attribute})`)

        if (familyAttribute.requiredChannels && familyAttribute.requiredChannels.length) {
            for (const requiredChannel of familyAttribute.requiredChannels) {
                if (!productAttribute || (productAttribute.data.find(d => d.scope === requiredChannel) || {}).value === undefined ||
                    (productAttribute.data.find(d => d.scope === requiredChannel) || {}).value === "") {
                    throw new Error(`${productAttribute.code} is required in this channel! (${requiredChannel})`)
                }
            }
        }

        if(!productAttribute) continue


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
                        if (new RegExp(regex, "g").test(datum.value)) {
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
                const BOOLEAN: BOOLEAN = attributeProperty
                if (BOOLEAN.defaultValue === undefined) {
                    throw new Error("Default value is null!")
                }
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
                const MULTISELECT: MULTISELECT = attributeProperty
                break
            case AttributeTypes.Enum.SIMPLESELECT:
                const SIMPLESELECT: SIMPLESELECT = attributeProperty
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

}

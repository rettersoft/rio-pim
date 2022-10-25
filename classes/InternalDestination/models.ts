import Z from "zod";

const Url = Z.string().url().optional()

export const WebhookHandlers = Z.object({
    product: Url,
    productModel: Url,
    family: Url,
    attributeGroup: Url,
    attribute: Url,
    attributeOption: Url,
    group: Url,
    groupType: Url,
    category: Url,
    channel: Url,
    currencies: Url,
    locales: Url,
}).optional();

export const Webhook = Z.object({
    handlers: WebhookHandlers,
    apiKey: Z.string().optional(),
    enabled: Z.boolean().default(true),
})
export type Webhook = Z.infer<typeof Webhook>

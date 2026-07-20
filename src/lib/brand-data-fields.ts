import type { BrandContactRecord, ContactView } from '@/types/brand-data'

export const CONTACT_FIELD_LABELS: Record<keyof BrandContactRecord, string> = {
  brandName: '品牌名称',
  merchandisingOwner: '商品部-负责人',
  brandOperationOwner: '品牌部-运营负责人',
  country: '品牌国家',
  category: '类目',
  designer: '主理人',
  contactPerson: '商品对接人',
  phone: '电话',
  orderEmail: '订单邮箱',
  ccEmail: '抄送邮箱',
  publicPaymentInfo: '付款对公信息',
  privatePaymentInfo: '付款对私信息',
  alipayInfo: '支付宝信息',
  invoiceInfo: '开票信息',
  cooperationDiscount: '合作折扣',
  taxIncluded: '是否含票',
  specialInvoice: '专票',
  normalInvoice: '普票',
  privatePaymentMethod: '对私',
  cooperationTime: '合作时间',
  afterSalesAddress: '售后地址',
  sampleAddress: '样衣地址',
  weekendShippingTime: '周末发货时间',
}

export const CONTACT_FIELD_GROUPS = {
  basic: [
    'brandName',
    'merchandisingOwner',
    'brandOperationOwner',
    'country',
    'category',
  ],
  market: [
    'cooperationDiscount',
    'taxIncluded',
    'specialInvoice',
    'normalInvoice',
    'cooperationTime',
    'afterSalesAddress',
    'sampleAddress',
    'weekendShippingTime',
  ],
  fullOnly: [
    'designer',
    'contactPerson',
    'phone',
    'orderEmail',
    'ccEmail',
    'publicPaymentInfo',
    'privatePaymentInfo',
    'alipayInfo',
    'invoiceInfo',
    'privatePaymentMethod',
  ],
} as const satisfies Record<string, readonly (keyof BrandContactRecord)[]>

export const CONTACT_ALL_FIELDS = [
  ...CONTACT_FIELD_GROUPS.basic,
  'designer',
  'contactPerson',
  'phone',
  'orderEmail',
  'ccEmail',
  'publicPaymentInfo',
  'privatePaymentInfo',
  'alipayInfo',
  'invoiceInfo',
  'cooperationDiscount',
  'taxIncluded',
  'specialInvoice',
  'normalInvoice',
  'privatePaymentMethod',
  'cooperationTime',
  'afterSalesAddress',
  'sampleAddress',
  'weekendShippingTime',
] as const satisfies readonly (keyof BrandContactRecord)[]

export function getContactFields(view: ContactView): readonly (keyof BrandContactRecord)[] {
  if (view === 'full') return CONTACT_ALL_FIELDS
  return [...CONTACT_FIELD_GROUPS.basic, ...CONTACT_FIELD_GROUPS.market]
}

export function projectContactRecord(
  record: BrandContactRecord,
  view: ContactView,
): Partial<BrandContactRecord> {
  const projected: Partial<BrandContactRecord> = {}
  for (const field of getContactFields(view)) {
    projected[field] = record[field]
  }
  return projected
}

export function getContactExportHeaders(view: ContactView): string[] {
  return getContactFields(view).map(field => CONTACT_FIELD_LABELS[field])
}

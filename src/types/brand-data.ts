export type BrandDataType = 'ordering' | 'contact'
export type ContactView = 'market' | 'full'

export interface BrandContactRecord {
  brandName: string
  merchandisingOwner: string
  brandOperationOwner: string
  country: string
  category: string
  designer: string
  contactPerson: string
  phone: string
  orderEmail: string
  ccEmail: string
  publicPaymentInfo: string
  privatePaymentInfo: string
  alipayInfo: string
  invoiceInfo: string
  cooperationDiscount: string
  taxIncluded: string
  specialInvoice: string
  normalInvoice: string
  privatePaymentMethod: string
  cooperationTime: string
  afterSalesAddress: string
  sampleAddress: string
  weekendShippingTime: string
}

export interface BrandDataPayload<TRecord> {
  items: TRecord[]
  updatedAt: string
  updatedBy: string
}

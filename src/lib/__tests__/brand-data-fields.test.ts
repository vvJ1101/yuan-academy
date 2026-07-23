import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getContactExportHeaders, projectContactRecord } from '../brand-data-fields'
import type { BrandContactRecord } from '@/types/brand-data'

const record: BrandContactRecord = {
  brandName: 'REFOUND TEN',
  merchandisingOwner: '商品负责人',
  brandOperationOwner: '运营负责人',
  country: '中国',
  category: '服装',
  designer: 'FFung',
  contactPerson: 'Yaki',
  phone: '15521382508',
  orderEmail: 'sales@refoundten.cn',
  ccEmail: 'lujflu@163.com',
  publicPaymentInfo: '对公',
  privatePaymentInfo: '对私账号',
  alipayInfo: '支付宝',
  invoiceInfo: '开票资料',
  cooperationDiscount: '系统订单折扣为准',
  taxIncluded: '不含票',
  specialInvoice: '/',
  normalInvoice: '/',
  privatePaymentMethod: '支付宝',
  cooperationTime: '已结束',
  afterSalesAddress: '售后地址',
  sampleAddress: '样衣地址',
  weekendShippingTime: '周六正常发，周日不发',
}

test('market projection includes basic fields and yellow fields only', () => {
  const projected = projectContactRecord(record, 'market')
  assert.equal(projected.brandName, 'REFOUND TEN')
  assert.equal(projected.merchandisingOwner, '商品负责人')
  assert.equal(projected.brandOperationOwner, '运营负责人')
  assert.equal(projected.cooperationDiscount, '系统订单折扣为准')
  assert.equal('phone' in projected, false)
  assert.equal('orderEmail' in projected, false)
  assert.equal('publicPaymentInfo' in projected, false)
  assert.equal('invoiceInfo' in projected, false)
  assert.equal('privatePaymentMethod' in projected, false)
})

test('full projection includes sensitive merchandising fields', () => {
  const projected = projectContactRecord(record, 'full')
  assert.equal(projected.phone, '15521382508')
  assert.equal(projected.orderEmail, 'sales@refoundten.cn')
  assert.equal(projected.publicPaymentInfo, '对公')
  assert.equal(projected.invoiceInfo, '开票资料')
  assert.equal(projected.privatePaymentMethod, '支付宝')
})

test('market export headers match the allowed market view', () => {
  assert.deepEqual(getContactExportHeaders('market'), [
    '品牌名称',
    '商品部-负责人',
    '品牌部-运营负责人',
    '品牌国家',
    '类目',
    '合作折扣',
    '是否含票',
    '专票',
    '普票',
    '合作时间',
    '售后地址',
    '样衣地址',
    '周末发货时间',
  ])
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import { mergeBrandContactRecords, parseBrandContactWorkbook } from '../brand-data-excel'
import type { BrandContactRecord } from '@/types/brand-data'

function workbookBuffer() {
  const rows = [
    [
      '品牌名称',
      '商品部-负责人',
      '品牌部-运营负责人',
      '品牌国家',
      '类目',
      '主理人',
      '商品对接人',
      '电话',
      '订单邮箱',
      '抄送邮箱',
      '付款对公信息',
      '付款对私信息',
      '支付宝信息',
      '开票信息',
      '合作折扣',
      '是否含票',
      '专票',
      '普票',
      '对私',
      '合作时间',
      '售后地址',
      '样衣地址',
      '周末发货时间',
    ],
    [
      'REFOUND TEN',
      '商品A',
      '市场A',
      '中国',
      '服装',
      'FFung',
      'Yaki',
      '155',
      'sales@example.com',
      'cc@example.com',
      '对公',
      '对私',
      '支付宝',
      '开票',
      '4折',
      '不含票',
      '/',
      '/',
      '支付宝',
      '已结束',
      '售后',
      '样衣',
      '周六发',
    ],
    ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, '工作表2')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

test('parses contact workbook by Chinese headers', () => {
  const records = parseBrandContactWorkbook(workbookBuffer())
  assert.equal(records.length, 1)
  assert.equal(records[0].brandName, 'REFOUND TEN')
  assert.equal(records[0].merchandisingOwner, '商品A')
  assert.equal(records[0].brandOperationOwner, '市场A')
  assert.equal(records[0].phone, '155')
  assert.equal(records[0].cooperationDiscount, '4折')
})

test('merge mode does not overwrite existing non-empty values with blanks', () => {
  const merged = mergeBrandContactRecords(
    [{ brandName: 'REFOUND TEN', phone: '155', orderEmail: 'old@example.com' } as BrandContactRecord],
    [{ brandName: 'REFOUND TEN', phone: '', orderEmail: 'new@example.com' } as BrandContactRecord],
    'merge',
  )
  assert.equal(merged[0].phone, '155')
  assert.equal(merged[0].orderEmail, 'new@example.com')
})

test('replace mode uses the incoming workbook records only', () => {
  const merged = mergeBrandContactRecords(
    [{ brandName: 'OLD', phone: '155' } as BrandContactRecord],
    [{ brandName: 'NEW', phone: '166' } as BrandContactRecord],
    'replace',
  )
  assert.deepEqual(merged.map(item => item.brandName), ['NEW'])
})

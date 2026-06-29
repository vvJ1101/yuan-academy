import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const FAQS = [
  // ── 市场部 ──
  { dept: 'marketing', q: '云仓、现货、期货订单有什么区别？', a: '**云仓**：无需截单，订单审核后直接回款登记，提交人自行审核即可出货。\n\n**现货**：需在限定时日截单 → 商品部转采购 → 市场部做回款单 → 财务审核 → 商品部配货出货。\n\n**期货**：截单 → 转采购 → 市场部收 50% 订金 → 品牌生产 → 收尾款 50% → 财务审核 → 商品部出货。\n\n详见：[市场部操作指南](/showroom/internal/documents?audience=marketing)', cat: 'order', dtype: 'training', order: 1 },
  { dept: 'marketing', q: '回款登记怎么做？', a: '在康雷系统找到对应回款单 → 编辑填写：付款方式、收款金额、备注 → **必须上传付款凭证截图**（含收款方、金额、时间） → 确认无误提交。\n\n- 云仓订单：提交人自行审核\n- 现货/期货订单：提交后由财务审核', cat: 'order', dtype: 'training', order: 2 },
  { dept: 'marketing', q: '余额支付怎么操作？', a: '**纯余额支付**：做一张「余额转入抵扣单」。\n\n**混合支付**（余额不足）：一张余额抵扣单 + 一张现金回款单。\n\n在余额使用界面选择客户余额账号，注意品牌余额区分，输入余额支付额度，上传余额使用截图后保存提交。', cat: 'payment', dtype: 'training', order: 3 },
  { dept: 'marketing', q: '客户退换货怎么处理？', a: '**换同等金额款式**：线下跟商品部沟通换货即可，不需要经过系统。\n\n**换款有差额**：市场部需重新在联欣下单，商品部在康雷系统做退货处理。\n\n**订单取消**：需联系商品部做退货处理，不可私自跟品牌沟通退换。', cat: 'order', dtype: 'sop', order: 4 },
  { dept: 'marketing', q: '上传付款凭证被驳回怎么办？', a: '凭证截图必须包含：收款方名称、金额、时间。模糊不清会导致财务驳回。\n\n检查以下三项是否一致：\n1. 付款金额\n2. 付款方式\n3. 付款凭证截图\n\n三者一致后重新提交。', cat: 'payment', dtype: 'sop', order: 5 },

  // ── 商品部 ──
  { dept: 'product', q: '怎么新建商品档案？', a: '在联欣系统：新增货号 → 填写货号、货品名称、状态、吊牌价、分类、品牌、权限分类、折扣类型、供应商编号、尺寸组、颜色、规格及属性值。\n\n- **权限分类**：必须选择对应品牌权限，错选导致数据隔离\n- **聚水潭品牌**：需在【条形码对应】做导入对应关系', cat: 'setup', dtype: 'training', order: 1 },
  { dept: 'product', q: '什么时候做截单转采购？', a: '市场部完成回款后，在限定时日内统一截单：\n\n- **云仓**：无需操作，等待市场部回款后直接确认出货\n- **现货**：截单 → 转采购 → 生成采购单\n- **期货**：截单 → 转采购 → 通知品牌方生产\n\n关键：商品部操作在市场部回款完成**之后**进行。', cat: 'order', dtype: 'training', order: 2 },
  { dept: 'product', q: '颜色/尺码建错了怎么删？', a: '**颜色**：新增保存后**无法删除**，做错只能选择「停用」该颜色。\n\n**尺码**：新增尺寸组后可在组内维护不同尺寸值，不同条码的尺寸值需分别维护。\n\n建议：新建前仔细核对，避免后期需要大量停用操作。', cat: 'setup', dtype: 'sop', order: 3 },
  { dept: 'product', q: '条形码对应是什么？为什么必须做？', a: '聚水潭同步品牌必须在【条形码对应】做导入对应关系。\n\n按 Excel 规则填写导入，确保商品资料（货号/颜色/尺码/编码）与聚水潭完全一致，否则库存无法同步。', cat: 'setup', dtype: 'sop', order: 4 },

  // ── 财务部 ──
  { dept: 'finance', q: '回款单审核要注意什么？', a: '审核铁律：**金额、方式、凭证截图三者必须一致**，缺一不可。\n\n1. 核对付款金额是否与订单一致\n2. 核对付款方式（余额/现金/混合）\n3. 核对付款凭证截图（含收款方、金额、时间）\n\n不一致 → 驳回并通知市场部修正。', cat: 'audit', dtype: 'training', order: 1 },
  { dept: 'finance', q: '预付款和应付付款有什么区别？', a: '**预付款**：商品部截单后新建，关联采购单号，金额为采购单的 50%，财务付款后提交。\n\n**应付付款**：月结时商品部根据发货明细与品牌确认后新建，金额 = 全款云仓 + 全款现货 + 50% 期货尾款。', cat: 'payment', dtype: 'training', order: 2 },
  { dept: 'finance', q: '余额混合支付怎么审核？', a: '纯余额 = 一张余额回款单\n混合支付 = 一张余额回款单 + 一张现金回款单\n\n审核时需核对两张单的金额总和是否等于订单金额。', cat: 'payment', dtype: 'sop', order: 3 },
  { dept: 'finance', q: '月度核算怎么做？', a: '导出渠道订单报表（订单）+ 收渠道退货单报表（退货） → 叠加计算应付总额 → 核实无误 → 生成账单 → 封账结存。\n\n注意：费用类型不可混淆。云仓 → 仓库出货单，现货/期货 → 采购收货单。', cat: 'audit', dtype: 'sop', order: 4 },

  // ── 品牌部 ──
  { dept: 'brand', q: '想看某个品牌的确认订单怎么看？', a: '登录联欣系统 → 订货客户汇总 → 筛选条件：\n- 时间范围\n- 品牌\n- 订单状态选「发货」+「已完成」\n\n点击查询后导出 Excel。不要包含「待确认」状态。', cat: 'report', dtype: 'training', order: 1 },
  { dept: 'brand', q: '意向订单和确认订单有什么区别？', a: '**意向订单**：通过「购物车管理」查看，各品牌意向订单用汇总/一维/二维导出。\n\n**确认订单**：通过「订货客户汇总」查看，筛选状态选发货+已完成。\n\n**订单汇总分析**：通过「汇总分析」选择分析维度查看。', cat: 'report', dtype: 'training', order: 2 },
  { dept: 'brand', q: '怎么导出数据做分析？', a: '根据需求选择对应报表：\n- 各客户订单明细 → 主题订单 → 二维按店导出\n- 商品销售排行 → 货品排行 → 自定义维度\n\n所有导出均为 Excel 格式。数据量大时不要选过宽的时间范围。', cat: 'report', dtype: 'sop', order: 3 },

  // ── 品牌方（partner 部门） ──
  { dept: 'partner', q: '聚水潭怎么同步库存？', a: '1. 接受 YUAN 供应商邀请\n2. 开启「库存同步」选项\n3. 设置分销价格和库存规则\n4. 确保商品资料（货号/颜色/尺码/编码）与聚水潭**完全一致**\n\n配置完成后库存自动同步，无需手动维护。', cat: 'inventory', dtype: 'training', order: 1 },
  { dept: 'partner', q: '不会用聚水潭，怎么手动维护库存？', a: '仓务中心 → 库存调整单 → 新建 → 两种方式：\n\n1. **手动输入**：输入款号 → 回车 → 弹出颜色尺码界面 → 填写发货颜色和尺码\n2. **Excel 导入**：下载模板 → 按规则填写 → 导入\n\n⚠️ 正数 = 增加库存，负数 = 减少库存，不要填反。', cat: 'inventory', dtype: 'training', order: 2 },
  { dept: 'partner', q: '收到出货指令单后怎么操作？', a: '确认采购单 → 维护库存 → 收到出货指令单 → 核对商品/数量/收货地址 → 打包发货 → 填写物流单号 → 提交发货确认。\n\n**必须先确认采购单再发货**，顺序不可颠倒。', cat: 'order', dtype: 'sop', order: 3 },
  { dept: 'partner', q: '库存数据跟实际不一致怎么办？', a: '如果是聚水潭同步：检查商品资料是否完全一致（货号/颜色/尺码/编码任一不匹配都会同步失败）。\n\n如果是手动维护：检查最近一次库存调整单是否有误。可通过新建库存调整单修正（正数补增，负数扣减）。', cat: 'inventory', dtype: 'sop', order: 4 },
]

async function main() {
  // Get department IDs
  const depts = await prisma.department.findMany()
  const bySlug: Record<string, string> = {}
  depts.forEach(d => bySlug[d.slug] = d.id)

  let created = 0
  for (const faq of FAQS) {
    const deptId = bySlug[faq.dept]
    if (!deptId) { console.log(`  SKIP ${faq.q} — dept ${faq.dept} not found`); continue }

    await prisma.faq.create({
      data: {
        question: faq.q,
        answer: faq.a,
        departmentId: deptId,
        category: `${faq.cat}|${(faq as any).dtype || 'training'}`,
        order: faq.order,
      },
    })
    created++
  }

  console.log(`Done: ${created} FAQs created`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

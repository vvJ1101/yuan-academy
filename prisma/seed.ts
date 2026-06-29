import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // ── Companies (upsert to handle existing) ──
  const companiesData = [
    { name: '时胜', slug: 'shisheng', description: '深圳时胜商贸发展有限公司' },
    { name: '圜界', slug: 'huanjie', description: '圜界' },
    { name: '屹圆', slug: 'yiyuan', description: '屹圆' },
    { name: '元睎', slug: 'yuanxi', description: '元睎' },
  ]

  const companies: Record<string, string> = {}
  for (const c of companiesData) {
    const company = await prisma.company.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description },
      create: c,
    })
    companies[c.slug] = company.id
  }

  const shishengId = companies['shisheng']

  // ── Create/update departments under 时胜 ──
  const deptSlugs = ['hr', 'finance', 'brand', 'product', 'marketing', 'showroom', 'partner']
  for (const slug of deptSlugs) {
    const existing = await prisma.department.findFirst({ where: { slug, companyId: shishengId } })
    if (existing) {
      await prisma.department.update({ where: { id: existing.id }, data: { companyId: shishengId } })
    } else {
      await prisma.department.create({
        data: { name: slug, slug, companyId: shishengId },
      })
    }
  }

  // ── Admin user (upsert) ──
  const passwordHash = await hash('admin123', 12)
  const hrDept = await prisma.department.findFirst({ where: { slug: 'hr' } })

  await prisma.user.upsert({
    where: { email: 'admin@yuanshowroom.com' },
    update: { companyId: shishengId },
    create: {
      email: 'admin@yuanshowroom.com',
      name: '管理员',
      passwordHash,
      role: 'super_admin',
      companyId: shishengId,
      departmentId: hrDept?.id,
    },
  })

  // ── Folders (knowledge spaces) ──
  // If no folders exist, seed them
  const folderCount = await prisma.folder.count()
  if (folderCount === 0) {
    // ── 集团公共 spaces (companyId=null) ──
    const groupSpaces = [
      { name: '集团制度与规范', slug: 'group-policies', sortOrder: 0 },
      { name: '通用培训资料', slug: 'group-training', sortOrder: 1 },
      { name: '公告通知', slug: 'group-notices', sortOrder: 2 },
    ]
    for (const s of groupSpaces) {
      await prisma.folder.create({ data: s })
    }

    // ── Per-company spaces ──
    const companySpaces: Record<string, { name: string; slug: string; sortOrder: number; subfolders?: string[] }[]> = {
      shisheng: [
        { name: '品牌运营', slug: 'ss-brand', sortOrder: 0, subfolders: ['品牌手册', '季度规划'] },
        { name: '订货管理', slug: 'ss-ordering', sortOrder: 1, subfolders: ['26SS 订货', '26AW 订货'] },
        { name: '展厅管理', slug: 'ss-showroom', sortOrder: 2 },
        { name: 'Showroom SOP', slug: 'ss-sop', sortOrder: 3, subfolders: ['销售流程', '客户接待', '售后处理'] },
      ],
      huanjie: [
        { name: '品牌资料', slug: 'hj-brand', sortOrder: 0, subfolders: ['品牌故事', '产品目录'] },
        { name: '运营规范', slug: 'hj-ops', sortOrder: 1 },
      ],
      yiyuan: [
        { name: '产品知识', slug: 'yy-product', sortOrder: 0, subfolders: ['面料知识', '工艺标准'] },
        { name: '销售政策', slug: 'yy-sales', sortOrder: 1 },
      ],
      yuanxi: [
        { name: '品牌手册', slug: 'yx-brand', sortOrder: 0 },
        { name: '培训资料', slug: 'yx-training', sortOrder: 1, subfolders: ['新人培训', '进阶培训'] },
      ],
    }

    for (const [companySlug, spaces] of Object.entries(companySpaces)) {
      const companyId = companies[companySlug]
      if (!companyId) continue
      for (const s of spaces) {
        const subfolders = s.subfolders
        const { subfolders: _, ...spaceData } = s
        const folder = await prisma.folder.create({
          data: { ...spaceData, companyId },
        })
        // Create subfolders
        if (subfolders) {
          for (let i = 0; i < subfolders.length; i++) {
            await prisma.folder.create({
              data: {
                name: subfolders[i],
                slug: `${s.slug}-sub-${i}`,
                parentId: folder.id,
                companyId,
                sortOrder: i,
              },
            })
          }
        }
      }
    }

    console.log(`  ✅ Created ${groupSpaces.length} group spaces + ${Object.values(companySpaces).flat().length} company spaces with subfolders`)
  }

  // ── Documents (seed if empty) ──
  const docCount = await prisma.document.count()
  if (docCount <= 1) {
    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@yuanshowroom.com' } })
    const brandDept = await prisma.department.findFirst({ where: { slug: 'brand', companyId: shishengId } })
    if (!adminUser || !brandDept) { console.log('  ⚠️  Skipping document seed: missing admin or brand dept'); return }

    const aid = adminUser.id
    const bid = brandDept.id
    const fid = (slug: string) => prisma.folder.findFirst({ where: { slug } }).then(f => f?.id || null)

    const docs = [
      // ── 集团公共 · 集团制度与规范 ──
      { folder: 'group-policies', title: '员工行为准则', category: 'policy', content: `# 员工行为准则\n\n## 总则\n全体员工须遵守国家法律法规及公司规章制度，维护公司形象与利益。\n\n## 工作纪律\n- 按时出勤，不得无故迟到早退\n- 工作期间保持专业态度\n- 保守公司商业秘密\n\n## 礼仪规范\n- 着装整洁得体\n- 礼貌待人，尊重同事与客户\n- 办公区域保持整洁\n\n## 信息安全\n- 妥善保管账号密码\n- 不得私自外传公司文件\n- 离职时归还所有公司资产` },
      { folder: 'group-policies', title: '差旅报销制度', category: 'policy', content: `# 差旅报销制度\n\n## 交通标准\n- 高铁二等座 / 飞机经济舱\n- 市内交通实报实销\n\n## 住宿标准\n- 一线城市：≤500元/晚\n- 其他城市：≤350元/晚\n\n## 餐补\n- 出差期间每人每天 100 元\n\n## 报销流程\n1. 出差前提交申请\n2. 保留所有票据\n3. 返程后 5 个工作日内提交报销单` },

      // ── 集团公共 · 通用培训资料 ──
      { folder: 'group-training', title: '新员工入职指南', category: 'general', content: `# 新员工入职指南\n\n## 第一天\n- 办理入职手续\n- 领取办公设备\n- 认识团队成员\n\n## 第一周\n- 了解公司组织架构\n- 学习 OA 系统操作\n- 参加新员工培训\n\n## 第一个月\n- 熟悉业务流程\n- 完成岗位技能培训\n- 与导师定期沟通\n\n## 常用联系方式\n- 行政部：hr@yuanshowroom.com\n- IT 支持：内线 888` },
      { folder: 'group-training', title: 'YUAN Academy 使用教程', category: 'general', content: `# YUAN Academy 使用教程\n\n## 知识空间\n左侧边栏可浏览各公司/部门的知识空间，按权限访问。\n\n## 文档搜索\n顶部搜索栏支持关键词搜索，输入问题可直接跳转 AI 问答。\n\n## AI 助手\n点击 AI 助手可针对文档内容提问，支持追问和深度分析。\n\n## 个人工作区\n- 收藏：星标重要文档\n- 学习路径：按路径系统学习\n- 最近访问：快速找回浏览记录` },

      // ── 集团公共 · 公告通知 ──
      { folder: 'group-notices', title: '2026年春节放假通知', category: 'general', content: `# 2026年春节放假通知\n\n根据国家规定及公司安排：\n\n- 放假时间：2026年2月14日-2月20日\n- 2月21日（周六）正常上班\n- 请各部门提前做好工作安排\n- 离岗前检查电源、门窗\n\n祝大家新春快乐！` },

      // ── 时胜 · 品牌运营 ──
      { folder: 'ss-brand', title: 'SEAMEW 品牌介绍', category: 'brand', content: `# SEAMEW 品牌介绍\n\n## 品牌定位\nSEAMEW 是当代艺术风格的独立设计师品牌，以极简克制的设计语言诠释现代女性力量。\n\n## 核心客群\n25-40岁都市女性，追求品质生活，审美独立。\n\n## 价格带\n- 主力客单：890-2999 元\n- 高端系列：3000-8000 元\n\n## 渠道策略\n- 品牌集合店\n- 高端百货\n- 线上旗舰店` },
      { folder: 'ss-brand', title: '2026春夏品牌运营规划', category: 'brand', content: `# 2026春夏品牌运营规划\n\n## Q1 (1-3月)\n- 26SS 新品到货陈列\n- 春节营销活动\n- 买手订货会准备\n\n## Q2 (4-6月)\n- 26AW 订货会执行\n- 换季清仓促销\n- 新品牌引进评估\n\n## 关键指标\n- 销售额同比增长 15%\n- 新客转化率 ≥ 8%\n- 库存周转天数 < 90 天` },

      // ── 时胜 · 订货管理 ──
      { folder: 'ss-ordering', title: '订货流程规范', category: 'policy', content: `# 订货流程规范\n\n## 1. 品牌评估\n- 市场调研\n- 竞品分析\n- 销售数据回顾\n\n## 2. 订货会参与\n- 提前注册\n- 买手团队组建\n- 预算审批\n\n## 3. 下单流程\n| 步骤 | 内容 | 负责人 |\n|------|------|--------|\n| 选款 | 现场选款+线上补选 | 买手 |\n| 核价 | 确认折扣阶梯 | 采购经理 |\n| 下单 | 提交订单 | 买手 |\n| 审批 | 订单金额审核 | 品牌总监 |\n| 支付 | 按合同支付定金 | 财务 |\n\n## 4. 交货跟踪\n- 工厂生产进度跟进\n- 质检安排\n- 物流协调` },
      { folder: 'ss-ordering', title: '各品牌订货政策汇总', category: 'policy', content: `# 各品牌订货政策汇总\n\n详细政策见 [订货政策](/internal/policy) 页面。\n\n## 通用规则\n- 每款每色 3 件起订\n- 定金 30%，发货前付清\n- 换货率 5%-15%（按订货额度）\n\n## 折扣梯度\n| 订货金额 | 折扣 | 换货率 |\n|----------|------|--------|\n| 5万 | 4.5折 | - |\n| 8万 | 4.0折 | 5% |\n| 12万+ | 3.8折 | 10-15% |` },

      // ── 时胜 · 展厅管理 ──
      { folder: 'ss-showroom', title: '展厅日常管理规范', category: 'policy', content: `# 展厅日常管理规范\n\n## 营业时间\n- 周一至周六：10:00-19:00\n- 周日及节假日：预约制\n\n## 展厅陈列\n- 每周一调整陈列\n- 新品到货 48 小时内上架\n- 保持陈列整洁饱满\n\n## 客户接待\n- 进门 30 秒内主动迎接\n- 提供茶水/咖啡\n- 记录客户偏好\n\n## 安全管理\n- 每日清点贵重货品\n- 闭店检查电源门窗\n- 监控 24 小时运行` },
      { folder: 'ss-showroom', title: '展厅陈列标准手册', category: 'brand', content: `# 展厅陈列标准手册\n\n## 陈列原则\n- 色彩协调：同色系相邻陈列\n- 品类分区：服装/鞋履/配饰分区\n- 高低错落：利用层板与道具创造层次\n\n## 灯光标准\n- 色温：3000K（暖白）\n- 重点照明：新品/主推款 2 倍亮度\n- 避免直射顾客视线\n\n## 季节性调整\n- 春夏：明亮清爽色调\n- 秋冬：温暖厚重氛围\n- 节庆：根据主题调整装饰` },

      // ── 时胜 · Showroom SOP ──
      { folder: 'ss-sop', title: '客户接待标准流程', category: 'sop', content: `# 客户接待标准流程\n\n## 1. 迎宾（0-2分钟）\n- 微笑迎接，点头致意\n- \"您好，欢迎来到 YUAN SHOWROOM\"\n- 询问需求：自选还是需要介绍\n\n## 2. 需求了解（2-5分钟）\n- 了解客户喜好风格\n- 了解预算范围\n- 了解穿着场景\n\n## 3. 产品推荐（5-15分钟）\n- 根据需求推荐 3-5 款\n- 讲解面料、设计亮点\n- 提供搭配建议\n\n## 4. 试穿服务\n- 准备合适尺码\n- 协助试穿\n- 记录反馈\n\n## 5. 促成成交\n- 确认满意度\n- 介绍优惠政策\n- 添加客户微信` },
      { folder: 'ss-sop', title: '售后处理流程', category: 'sop', content: `# 售后处理流程\n\n## 退换货政策\n- 7 天内无理由退换\n- 商品须保持原状（吊牌完整、未穿着）\n- 特价商品不退不换\n\n## 处理流程\n1. 客户提出售后需求\n2. 核验购买凭证\n3. 检查商品状态\n4. 填写售后单\n5. 处理退换/维修\n6. 7 个工作日内完成\n\n## 客户投诉处理\n- 先道歉，再了解情况\n- 24 小时内给出解决方案\n- 重大投诉上报品牌总监` },

      // ── 圜界 · 品牌资料 ──
      { folder: 'hj-brand', title: '圜界品牌矩阵', category: 'brand', content: `# 圜界品牌矩阵\n\n圜界专注于生活方式品牌运营，涵盖：\n\n## 家居生活\n- 香氛系列\n- 家居装饰\n- 生活器皿\n\n## 个人护理\n- 护肤系列\n- 身体护理\n- 旅行套装\n\n## 目标市场\n- 追求品质生活的都市人群\n- 25-45岁中高收入群体` },

      // ── 圜界 · 运营规范 ──
      { folder: 'hj-ops', title: '门店运营SOP', category: 'sop', content: `# 门店运营SOP\n\n## 开店准备\n- 提前 30 分钟到店\n- 检查卫生/陈列/设备\n- 晨会 10 分钟\n\n## 日常运营\n- 每小时巡店一次\n- 记录客流数据\n- 及时补货\n\n## 闭店流程\n- 核对收银\n- 填写日报\n- 关闭电源/设防` },

      // ── 屹圆 · 产品知识 ──
      { folder: 'yy-product', title: '面料知识手册', category: 'general', content: `# 面料知识手册\n\n## 天然纤维\n| 面料 | 特点 | 洗涤 |\n|------|------|------|\n| 棉 | 透气吸湿 | 机洗 |\n| 麻 | 凉爽挺括 | 手洗 |\n| 丝 | 柔软光滑 | 干洗 |\n| 羊毛 | 保暖弹性 | 干洗 |\n\n## 合成纤维\n| 面料 | 特点 | 用途 |\n|------|------|------|\n| 涤纶 | 抗皱耐磨 | 外套 |\n| 锦纶 | 轻便耐用 | 运动 |\n| 腈纶 | 蓬松保暖 | 毛衣 |\n\n## 混纺面料\n常见的棉涤混纺、毛涤混纺等结合了天然与合成纤维的优点。` },
      { folder: 'yy-product', title: '服装质检标准', category: 'policy', content: `# 服装质检标准\n\n## AQL 抽检标准\n- 一般缺陷 AQL 2.5\n- 严重缺陷 AQL 1.0\n\n## 外观检查\n- 色差 ≥4 级\n- 无明显线头\n- 对称部位对齐\n\n## 尺寸公差\n| 部位 | 公差 |\n|------|------|\n| 胸围 | ±1.5cm |\n| 衣长 | ±1.0cm |\n| 袖长 | ±0.8cm |\n\n## 牢度测试\n- 耐洗色牢度 ≥4 级\n- 耐摩擦色牢度 ≥3-4 级` },

      // ── 屹圆 · 销售政策 ──
      { folder: 'yy-sales', title: '销售提成方案', category: 'policy', content: `# 销售提成方案\n\n## 基础提成\n- 月度销售额 ≤10万：2%\n- 月度销售额 10-20万：3%\n- 月度销售额 >20万：4%\n\n## 附加奖励\n- 季度销冠：额外奖金 3000 元\n- 年度销冠：额外奖金 10000 元\n- 大单奖励：单笔 >5万奖励 500 元\n\n## 考核标准\n- 客户满意度 ≥90%\n- 出勤率 ≥95%\n- 无重大客诉` },

      // ── 元睎 · 品牌手册 ──
      { folder: 'yx-brand', title: '元睎品牌文化手册', category: 'brand', content: `# 元睎品牌文化手册\n\n## 品牌使命\n以东方美学为根基，融合现代设计语言，为当代女性打造兼具美感与实穿性的着装方案。\n\n## 品牌愿景\n成为亚洲领先的独立设计师品牌孵化平台。\n\n## 核心价值观\n- **匠心**：对工艺极致追求\n- **创新**：不断突破设计边界\n- **真诚**：对客户、对伙伴以诚相待\n- **可持续**：关注环保与社会责任\n\n## 设计哲学\n「少即是多」—— 用最简练的线条表达最丰富的情感。` },

      // ── 元睎 · 培训资料 ──
      { folder: 'yx-training', title: '销售技巧培训', category: 'training', content: `# 销售技巧培训\n\n## FAB 销售法\n- **F (Feature)**：产品特点\n- **A (Advantage)**：产品优势\n- **B (Benefit)**：客户利益\n\n## 异议处理\n1. 倾听 — 完整听完客户顾虑\n2. 认同 — \"我理解您的顾虑\"\n3. 回应 — 用事实和数据打消顾虑\n4. 确认 — \"这样您放心了吗？\"\n\n## 连带销售\n- 成套搭配推荐\n- \"这件外套配我们那条裤子效果很好\"\n- 目标：客单件 ≥2.5 件\n\n## 客户维护\n- 每季度至少联系一次\n- 新品到店主动通知\n- 生日/节日问候` },
      { folder: 'yx-training', title: '时尚趋势分析 - 2026', category: 'general', content: `# 时尚趋势分析 - 2026\n\n## 核心趋势\n1. **静奢风 (Quiet Luxury)**：低调质感面料、中性色调\n2. **新中式 2.0**：东方元素现代化演绎\n3. **运动时装化**：功能性面料融入日常穿搭\n\n## 色彩趋势\n- 年度色：柔和桃 (Peach Fuzz)\n- 关键色：静谧蓝、大地棕、翡翠绿\n\n## 面料趋势\n- 可持续面料持续增长\n- 科技功能性面料\n- 天然纹理面料\n\n## 廓形趋势\n- 宽松廓形持续流行\n- 解构主义设计\n- 多层次叠穿` },
    ]

    let created = 0
    for (const d of docs) {
      const folderId = await fid(d.folder)
      await prisma.document.create({
        data: {
          title: d.title,
          slug: d.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          content: d.content,
          category: d.category,
          authorId: aid,
          ownerDeptId: bid,
          folderId,
          visibility: 'department',
        },
      })
      created++
    }
    console.log(`  📄 Created ${created} documents across ${new Set(docs.map(d => d.folder)).size} folders`)
  }


  // ── Seed default role permissions ──
  const rolePerms: Record<string, string[]> = {
    super_admin: ['*'],
    dept_admin: [
      'menu.dashboard','menu.recent','menu.favorites','menu.workspace','menu.documents','menu.sop','menu.faq',
      'menu.admin','menu.admin.folders','menu.admin.analytics',
      'action.folders.create','action.folders.edit','action.folders.delete',
      'action.documents.upload','action.documents.edit','action.documents.delete',
      'action.faq.create','action.faq.edit','action.faq.delete',
    ],
    editor: [
      'menu.dashboard','menu.recent','menu.favorites','menu.workspace','menu.documents','menu.sop','menu.faq',
      'action.documents.upload','action.documents.edit','action.faq.create','action.faq.edit',
    ],
    viewer: [
      'menu.dashboard','menu.recent','menu.favorites','menu.workspace','menu.documents','menu.sop',
    ],
  }
  for (const [role, perms] of Object.entries(rolePerms)) {
    await (prisma as any).rolePermission.upsert({
      where: { role },
      update: { permissions: JSON.stringify(perms) },
      create: { role, permissions: JSON.stringify(perms) },
    })
  }
  console.log('  🔐 Seeded default role permissions')

  console.log('Seed complete: 4 companies, 7 departments updated → 时胜, admin user, folders')
  await prisma.$disconnect()
}

main()

// cloudfunctions/manageTestData/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 模拟数据源
const mockData = [
  // ---------------- 1. 银行存款 (10条) ----------------
  { type: '银行存款', name: '工商银行大额存单', principal: '200000', balance: '200000', annualRate: '2.85', depositTerm: '3年', buyDate: '2023-01-15' },
  { type: '银行存款', name: '招商银行结构性存款', principal: '50000', balance: '50000', annualRate: '1.65', depositTerm: '6个月', buyDate: '2023-11-20' },
  { type: '银行存款', name: '建设银行定期', principal: '100000', balance: '100000', annualRate: '2.10', depositTerm: '2年', buyDate: '2023-05-10' },
  { type: '银行存款', name: '微众银行Plus', principal: '30000', balance: '30000', annualRate: '2.45', depositTerm: '1年', buyDate: '2023-08-01' },
  { type: '银行存款', name: '江苏银行直销', principal: '80000', balance: '80000', annualRate: '3.10', depositTerm: '3年', buyDate: '2022-12-12' },
  { type: '银行存款', name: '平安银行口袋零钱', principal: '15000', balance: '15000', annualRate: '1.95', depositTerm: '灵活', buyDate: '2024-01-01' },
  { type: '银行存款', name: '农业银行定存', principal: '60000', balance: '60000', annualRate: '2.25', depositTerm: '2年', buyDate: '2023-03-15' },
  { type: '银行存款', name: '交通银行特色存', principal: '45000', balance: '45000', annualRate: '2.00', depositTerm: '1年', buyDate: '2023-09-09' },
  { type: '银行存款', name: '邮储银行养老金', principal: '120000', balance: '120000', annualRate: '2.60', depositTerm: '3年', buyDate: '2023-02-20' },
  { type: '银行存款', name: '已到期空仓测试', principal: '10000', balance: '0', annualRate: '1.50', depositTerm: '3个月', buyDate: '2022-01-01' }, // 空仓测试

  // ---------------- 2. 公募基金 (10条 - 涵盖赚、亏、清仓) ----------------
  { type: '公募基金', name: '易方达蓝筹精选', code: '005827', principal: '50000', balance: '38000', shares: '20000', buyDate: '2021-06-01' }, // 亏损
  { type: '公募基金', name: '招商中证白酒', code: '161725', principal: '20000', balance: '18500', shares: '15000', buyDate: '2022-03-15' }, // 亏损
  { type: '公募基金', name: '中欧医疗健康', code: '003095', principal: '30000', balance: '22000', shares: '12000', buyDate: '2021-09-10' }, // 大亏
  { type: '公募基金', name: '广发纳斯达克100', code: '006479', principal: '10000', balance: '14500', shares: '8000', buyDate: '2023-01-05' }, // 盈利
  { type: '公募基金', name: '景顺长城新能源', code: '005911', principal: '15000', balance: '13000', shares: '6000', buyDate: '2022-11-11' },
  { type: '公募基金', name: '华宝券商ETF联接', code: '006098', principal: '8000', balance: '8200', shares: '9000', buyDate: '2023-12-01' },
  { type: '公募基金', name: '博时黄金ETF', code: '002611', principal: '25000', balance: '28000', shares: '7000', buyDate: '2023-05-20' }, // 盈利
  { type: '公募基金', name: '兴全合润混合', code: '163406', principal: '40000', balance: '39000', shares: '22000', buyDate: '2022-08-08' },
  { type: '公募基金', name: '天弘余额宝', code: '000198', principal: '5000', balance: '5020', shares: '5000', buyDate: '2024-01-15' },
  { type: '公募基金', name: '已清仓基金测试', code: '000001', principal: '10000', balance: '0', shares: '0', buyDate: '2020-01-01' }, // 空仓

  // ---------------- 3. 股票/ETF (10条) ----------------
  { type: '股票/ETF', name: '腾讯控股(HK)', code: '00700', principal: '80000', balance: '92000', shares: '300', buyDate: '2022-10-25' }, // 盈利
  { type: '股票/ETF', name: '贵州茅台', code: '600519', principal: '170000', balance: '165000', shares: '100', buyDate: '2023-06-18' },
  { type: '股票/ETF', name: '宁德时代', code: '300750', principal: '50000', balance: '42000', shares: '200', buyDate: '2022-01-01' },
  { type: '股票/ETF', name: '特斯拉(美股)', code: 'TSLA', principal: '30000', balance: '28000', shares: '15', buyDate: '2023-12-20' },
  { type: '股票/ETF', name: '阿里巴巴', code: 'BABA', principal: '40000', balance: '35000', shares: '400', buyDate: '2021-11-11' },
  { type: '股票/ETF', name: '沪深300ETF', code: '510300', principal: '60000', balance: '58000', shares: '15000', buyDate: '2023-04-01' },
  { type: '股票/ETF', name: '科创50ETF', code: '588000', principal: '20000', balance: '16000', shares: '20000', buyDate: '2022-07-15' },
  { type: '股票/ETF', name: '红利ETF', code: '510880', principal: '30000', balance: '33000', shares: '10000', buyDate: '2023-02-01' },
  { type: '股票/ETF', name: '苹果公司', code: 'AAPL', principal: '45000', balance: '52000', shares: '40', buyDate: '2023-01-10' },
  { type: '股票/ETF', name: '已卖出股票测试', code: '600000', principal: '20000', balance: '0', shares: '0', buyDate: '2021-01-01' }, // 空仓

  // ---------------- 4. 定期理财 (10条) ----------------
  { type: '定期理财', name: '建信理财安鑫', principal: '50000', balance: '51200', buyDate: '2023-05-01' },
  { type: '定期理财', name: '招银理财招睿', principal: '80000', balance: '82500', buyDate: '2023-01-15' },
  { type: '定期理财', name: '工银理财核心优选', principal: '30000', balance: '29800', buyDate: '2023-11-01' }, // 微亏
  { type: '定期理财', name: '交银理财稳享', principal: '20000', balance: '20600', buyDate: '2023-06-18' },
  { type: '定期理财', name: '信银理财安盈', principal: '10000', balance: '10300', buyDate: '2023-03-20' },
  { type: '定期理财', name: '光大理财阳光金', principal: '150000', balance: '156000', buyDate: '2022-12-01' },
  { type: '定期理财', name: '农银理财农银安心', principal: '60000', balance: '61500', buyDate: '2023-07-07' },
  { type: '定期理财', name: '中邮理财邮银财富', principal: '25000', balance: '25400', buyDate: '2023-09-10' },
  { type: '定期理财', name: '兴银理财稳利', principal: '40000', balance: '40900', buyDate: '2023-04-15' },
  { type: '定期理财', name: '已赎回理财测试', principal: '50000', balance: '0', buyDate: '2022-01-01' } // 空仓
];

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const type = event.action; // 'clear' 或 'init'

  try {
    if (type === 'clear') {
      // 1. 清空当前用户的所有资产
      // 注意：where是必须的，防止误删整表，_openid由云端自动注入确保安全
      await db.collection('assets').where({
        _openid: wxContext.OPENID 
      }).remove();
      
      return { success: true, msg: '所有数据已清空' };
    } 
    
    else if (type === 'init') {
      // 2. 批量插入数据
      // 云数据库不支持一次插入大数组，需要分批或者循环
      // 这里为了简单，我们使用 Promise.all 并发插入
      
      const tasks = [];
      for (const item of mockData) {
        tasks.push(db.collection('assets').add({
          data: {
            ...item,
            _openid: wxContext.OPENID,
            createTime: new Date()
          }
        }));
      }
      
      await Promise.all(tasks);
      return { success: true, msg: `成功插入 ${mockData.length} 条模拟数据` };
    }
    
  } catch (e) {
    return { success: false, msg: e.message };
  }
};
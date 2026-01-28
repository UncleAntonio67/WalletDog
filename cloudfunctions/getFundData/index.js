// cloudfunctions/getFundData/index.js
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 1. 查实时详情的核心函数
function fetchFundDetail(code) {
  return new Promise((resolve) => {
    // 天天基金实时估值接口
    const url = `https://fundgz.1234567.com.cn/js/${code}.js`
    
    https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          // 提取 jsonpgz({...}) 中的 JSON
          const jsonStr = data.match(/jsonpgz\((.*?)\)/);
          if (jsonStr && jsonStr[1]) {
            const result = JSON.parse(jsonStr[1]);
            resolve({ 
              code: code, 
              nav: result.dwjz,  // 单位净值
              date: result.jzrq, // 净值日期
              rate: result.gszzl, // 估算涨跌幅
              name: result.name
            })
          } else {
            // 解析失败（可能是代码填错，或接口变了）
            console.error(`解析失败: ${code}`)
            resolve({ code: code, error: '解析失败' })
          }
        } catch (e) {
          console.error(`异常: ${code}`, e)
          resolve({ code: code, error: '数据异常' })
        }
      })
    }).on('error', (err) => {
      resolve({ code: code, error: err.message })
    })
  })
}

// 2. 查历史走势的核心函数
function fetchFundHistory(code) {
  return new Promise((resolve) => {
    const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`
    https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const match = data.match(/Data_netWorthTrend\s*=\s*(\[.*?\]);/);
          if (match && match[1]) {
            const fullList = JSON.parse(match[1]);
            // 返回全部历史数据
            const history = fullList.map(item => {
              return {
                date: new Date(item.x).toLocaleDateString(), 
                timestamp: item.x, 
                value: item.y 
              };
            });
            resolve({ code: code, history: history })
          } else {
            resolve({ code: code, history: [] })
          }
        } catch (e) { resolve({ code: code, history: [] }) }
      })
    })
  })
}

// 3. 主入口
exports.main = async (event, context) => {
  const type = event.type || 'detail'; // 默认是查详情
  const codes = event.codes || [];

  if (type === 'history') {
    // 详情页查历史
    if (codes.length === 0) return { error: '无代码' };
    const result = await fetchFundHistory(codes[0]);
    return { data: result }
  } else {
    // 首页查最新净值
    // ⚠️ 如果你刚才这里没写对，首页就会刷新不出数据
    const tasks = codes.map(code => fetchFundDetail(code));
    const results = await Promise.all(tasks);
    return { data: results }
  }
}
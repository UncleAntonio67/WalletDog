// cloudfunctions/getFundData/index.js
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 封装抓取函数
function fetchFund(code) {
  return new Promise((resolve, reject) => {
    // 天天基金接口
    const url = `https://fundgz.1234567.com.cn/js/${code}.js`
    
    https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          // 返回格式通常是 jsonpgz({...}); 提取括号内 JSON
          const jsonStr = data.match(/jsonpgz\((.*?)\)/);
          if (jsonStr && jsonStr[1]) {
            const result = JSON.parse(jsonStr[1]);
            resolve({ 
              code: code, 
              nav: result.dwjz,  // 单位净值
              date: result.jzrq, // 净值日期
              rate: result.gszzl, // 日涨跌幅估算
              name: result.name
            })
          } else {
            resolve({ code: code, error: '解析失败' })
          }
        } catch (e) {
          resolve({ code: code, error: '数据异常' })
        }
      })
    }).on('error', (err) => {
      resolve({ code: code, error: err.message })
    })
  })
}

exports.main = async (event, context) => {
  const codes = event.codes || []
  if (codes.length === 0) return { msg: '没有代码' }

  // 并发查询
  const tasks = codes.map(code => fetchFund(code))
  const results = await Promise.all(tasks)

  return { data: results }
}
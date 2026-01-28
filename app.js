// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        // ⚠️ 重要：请把下面的 '你的环境ID' 替换成你刚才复制的真实ID
        // 例如：env: 'fund-app-8g8kxxxx',
        env: 'cloud1-9gf0kg4bcef8b41d', 
        traceUser: true,
      })
    }

    this.globalData = {}
  }
})
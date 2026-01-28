// pages/detail/detail.js
Page({
  data: {
    asset: {},
    fixedProfit: 0,
    totalRate: 0
  },

  onLoad(options) {
    // 接收参数
    if (options.assetStr) {
      const asset = JSON.parse(decodeURIComponent(options.assetStr));
      
      // 计算累计盈亏金额
      const profit = parseFloat(asset.balance) - parseFloat(asset.principal);
      
      // 计算累计收益率 = (累计盈亏 / 本金) * 100
      let rate = 0;
      if (asset.principal > 0) {
        rate = (profit / asset.principal) * 100;
      }

      this.setData({
        asset: asset,
        fixedProfit: profit.toFixed(2),
        totalRate: rate.toFixed(2)
      });
      
      // 设置导航栏标题
      wx.setNavigationBarTitle({ title: asset.name });
    }
  },

  // 如果图片加载失败（比如不是基金而是存款），给个提示
  onImageError() {
    wx.showToast({ title: '暂无走势图', icon: 'none' });
  }
})
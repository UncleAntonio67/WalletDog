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
  },
  goAddPosition() {
    const asset = this.data.asset;
    
    // 把名称、代码、类型传过去
    // 注意：如果是中文，最好 encodeURIComponent 一下，防止乱码
    const url = `/pages/add/add?mode=add&name=${encodeURIComponent(asset.name)}&code=${asset.code}&type=${asset.type}`;
    
    // 因为 add 是 TabBar 页面，必须用 switchTab
    // 但是 switchTab 不支持直接带 ?参数，这是微信的一个坑
    // 所以我们需要把数据存到全局变量或者本地缓存里，让 add 页面去取
    
    // 方案：存入全局 App.globalData
    const app = getApp();
    app.globalData.tempAsset = {
      name: asset.name,
      code: asset.code,
      type: asset.type
    };

    wx.switchTab({
      url: '/pages/add/add'
    });
  }
})
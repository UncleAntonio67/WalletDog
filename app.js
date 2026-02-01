// app.js
App({
  globalData: {
    // ... 原有数据 ...
    tempAsset: null, // 用于详情页传数据给记账页
    targetAssetType: null // ✨✨✨ 新增：用于首页传分类给列表页 ✨✨✨
  },
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-9gf0kg4bcef8b41d', // 请确保填对
        traceUser: true,
      });
    }
  }
});
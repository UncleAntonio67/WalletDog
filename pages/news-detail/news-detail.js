const util = require('../../utils/util.js'); // 假设你有格式化时间的工具
Page({
  data: { article: {}, timeStr: '' },
  onLoad(options) {
    if(options.id) {
      this.loadDetail(options.id);
    }
  },
  loadDetail(id) {
    wx.showLoading({ title: '加载中' });
    wx.cloud.callFunction({
      name: 'newsService',
      data: { action: 'detail', id: id }
    }).then(res => {
      wx.hideLoading();
      const data = res.result.data;
      // 简单格式化时间
      const date = new Date(data.publishTime);
      const timeStr = `${date.getMonth()+1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
      
      this.setData({ article: data, timeStr });
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  }
});
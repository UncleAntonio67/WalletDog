// pages/list/list.js
const db = wx.cloud.database()

Page({
  data: { assetList: [], updateTime: '' },

  onShow() { this.loadData(); },

  loadData() {
    wx.showLoading({ title: '加载中...' });
    
    // 【核心修改】从云数据库获取所有数据
    db.collection('assets').get().then(res => {
      wx.hideLoading();
      
      const now = new Date();
      const timeStr = `${now.getMonth()+1}月${now.getDate()}日 ${now.getHours()}:${now.getMinutes()}`;

      this.setData({
        assetList: res.data, // res.data 就是数据库里的数组
        updateTime: timeStr
      });
    }).catch(err => {
      wx.hideLoading();
      console.error(err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 跳转详情 (保持不变)
  goToDetail(e) {
    const item = e.currentTarget.dataset.item;
    const itemStr = encodeURIComponent(JSON.stringify(item));
    wx.navigateTo({ url: `/pages/detail/detail?assetStr=${itemStr}` });
  },

  showDeleteOption(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.assetList[index]; // 获取选中项

    wx.showModal({
      title: '删除资产',
      content: `确定要删除“${item.name}”吗？`,
      confirmColor: '#E74C3C',
      success: (res) => {
        if (res.confirm) {
          this.deleteAsset(item._id); // 使用云数据库的 _id
        }
      }
    })
  },

  deleteAsset(id) {
    wx.showLoading({ title: '删除中...' });
    
    // 【核心修改】根据 _id 删除云端数据
    db.collection('assets').doc(id).remove().then(res => {
      wx.hideLoading();
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadData(); // 重新加载列表
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '删除失败', icon: 'none' });
    });
  }
})
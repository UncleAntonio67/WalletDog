const util = require('../../utils/util.js') // 如果你有用到日期格式化，没有也没关系

Page({
  data: {
    assetList: [],
    updateTime: ''
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const list = wx.getStorageSync('my_assets') || [];
    
    // 获取当前时间作为“更新时间”
    const now = new Date();
    const timeStr = `${now.getMonth()+1}月${now.getDate()}日 ${now.getHours()}:${now.getMinutes()}`;

    this.setData({
      assetList: list,
      updateTime: timeStr
    });
  },

  // 长按删除功能
  showDeleteOption(e) {
    const id = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;
    const name = this.data.assetList[index].name;

    wx.showModal({
      title: '删除资产',
      content: `确定要删除“${name}”吗？删除后不可恢复。`,
      confirmColor: '#E74C3C', // 红色确认键
      success: (res) => {
        if (res.confirm) {
          this.deleteAsset(index);
        }
      }
    })
  },

  deleteAsset(index) {
    const list = this.data.assetList;
    list.splice(index, 1); // 从数组中删除

    // 1. 更新页面
    this.setData({ assetList: list });
    // 2. 更新本地缓存
    wx.setStorageSync('my_assets', list);
    
    wx.showToast({ title: '已删除', icon: 'success' });
  },
  goToDetail(e) {
    const item = e.currentTarget.dataset.item;
    const itemStr = encodeURIComponent(JSON.stringify(item));
    wx.navigateTo({
      url: `/pages/detail/detail?assetStr=${itemStr}`,
    });
  },
})
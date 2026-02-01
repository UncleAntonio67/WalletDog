// pages/news/news.js
const app = getApp();
let refreshTimer = null;

Page({
  data: {
    newsList: [],
    // 必须和后端 TARGET_CHANNELS 一致
    channels: ['推荐', '路透社', '万得Wind', '彭博Bloomberg', '财新Caixin', '华尔街日报', '证券时报', '摩根大通', '高盛', '金十数据', '财联社', '中信证券', '第一财经'],
    currentChannel: '推荐',
    
    indices: [
      { name: '上证指数', value: '----', rate: 0 },
      { name: '纳斯达克', value: '----', rate: 0 },
      { name: '现货黄金', value: '----', rate: 0 },
      { name: '离岸汇率', value: '----', rate: 0 },
      { name: '比特币', value: '----', rate: 0 },
      { name: '原油', value: '----', rate: 0 }
    ],
    loading: false,
    isRefreshing: false,
    lastUpdateTime: ''
  },

  onLoad() {
    // 首次进入，先拉取，如果是空的则触发抓取
    this.getNewsList(true).then(() => {
      if (this.data.newsList.length === 0) {
        this.forceInitData();
      }
    });
  },

  onShow() { this.startAutoRefresh(); },
  onHide() { this.stopAutoRefresh(); },
  onUnload() { this.stopAutoRefresh(); },

  switchChannel(e) {
    const channel = e.currentTarget.dataset.channel;
    if (channel === this.data.currentChannel) return;
    this.setData({ currentChannel: channel });
    this.getNewsList(true);
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ isRefreshing: true });
    this.forceInitData().finally(() => {
        this.setData({ isRefreshing: false });
        wx.stopPullDownRefresh();
    });
  },

  startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { this.getRealTimeIndices(); }, 60000);
  },
  stopAutoRefresh() { if (refreshTimer) clearInterval(refreshTimer); },

  // 强制初始化数据 (核心)
  forceInitData() {
    wx.showLoading({ title: '同步全球数据...', mask: true });
    
    // 1. 调用云函数抓取
    return wx.cloud.callFunction({
      name: 'newsService',
      data: { action: 'fetch' }
    }).then(res => {
      console.log('抓取结果:', res);
      // 2. 抓取成功后，更新行情
      return this.getRealTimeIndices();
    }).then(() => {
      // 3. 重新拉取列表
      return this.getNewsList(true);
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '已更新', icon: 'success' });
    }).catch(err => {
      console.error(err);
      wx.hideLoading();
    });
  },

  getRealTimeIndices() {
    wx.cloud.callFunction({ name: 'newsService', data: { action: 'indices' } })
      .then(res => {
        if (res.result && res.result.data) {
          this.setData({ indices: res.result.data });
          const now = new Date();
          this.setData({ lastUpdateTime: `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}` });
        }
      }).catch(console.error);
  },

  getNewsList(reset = false) {
    if (reset) {
        this.setData({ newsList: [] }); // 先清空，给用户刷新感
    }
    this.setData({ loading: true });

    return wx.cloud.callFunction({
      name: 'newsService',
      data: { 
        action: 'list', 
        channel: this.data.currentChannel // 传入当前Tab
      }
    }).then(res => {
      this.setData({ loading: false });
      if (!res.result || !res.result.data) return;

      const newData = res.result.data.map(item => {
        // 时间格式化
        let timeStr = '';
        if (item.publishTime) {
          const d = new Date(item.publishTime);
          const now = new Date();
          const diff = (now - d) / 1000 / 60;
          if (diff < 60) timeStr = `${Math.floor(diff)}分钟前`;
          else if (diff < 1440) timeStr = `${Math.floor(diff/60)}小时前`;
          else timeStr = `${d.getMonth()+1}-${d.getDate()}`;
        }
        return { ...item, displayTime: timeStr };
      });

      this.setData({ newsList: newData });
    }).catch(err => {
      console.error(err);
      this.setData({ loading: false });
    });
  },

  goDetail(e) { 
      const id = e.currentTarget.dataset.id;
      wx.navigateTo({ url: `/pages/news-detail/news-detail?id=${id}` }); 
  }
});
// pages/index/index.js
const db = wx.cloud.database()

Page({
  data: {
    totalBalance: "0.00",
    totalProfit: 0,
    rankingList: [],
    isRefreshing: false
  },

  onShow() { this.loadData(); },
  onLoad() { this.loadData(); },

  // 1. 加载数据：改为从云端读取
  loadData() {
    // 只有在非刷新状态下才显示loading，避免下拉刷新时loading重叠
    if (!this.data.isRefreshing) {
       // wx.showLoading({ title: '同步数据...' }); // 可选，看体验
    }

    db.collection('assets').get().then(res => {
      wx.hideLoading();
      const assetList = res.data;

      if (assetList.length === 0) {
        this.setData({ totalBalance: "0.00", totalProfit: 0, rankingList: [] });
        return;
      }

      let total = 0;
      let profit = 0;

      assetList.forEach(item => {
        const bal = parseFloat(item.balance) || 0;
        const prin = parseFloat(item.principal) || 0;
        total += bal;
        profit += (bal - prin);
      });

      const sortedList = assetList.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));

      this.setData({
        totalBalance: total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        totalProfit: profit.toFixed(2),
        rankingList: sortedList
      });
    });
  },

  // 2. 下拉刷新：逻辑大升级
  onPullDownRefresh() {
    this.refreshNav();
  },

  refreshNav() {
    this.setData({ isRefreshing: true });
    wx.showLoading({ title: '正在算账...' });

    // 第一步：先从云数据库拿最新列表
    db.collection('assets').get().then(async res => {
      const list = res.data;
      const fundAssets = list.filter(item => item.type === '公募基金' && item.code);
      
      if (fundAssets.length === 0) {
        wx.showToast({ title: '无基金可更新', icon: 'none' });
        wx.stopPullDownRefresh();
        this.setData({ isRefreshing: false });
        return;
      }

      const codes = fundAssets.map(item => item.code);

      // 第二步：调用云函数查净值
      const cloudRes = await wx.cloud.callFunction({
        name: 'getFundData',
        data: { codes: codes }
      });
      
      const cloudData = cloudRes.result.data || [];
      const updateTasks = []; // 存放所有的更新任务

      // 第三步：遍历对比，如果有变化，就生成一个更新任务
      list.forEach(item => {
        const remoteItem = cloudData.find(c => c.code === item.code);
        if (remoteItem && !remoteItem.error) {
          const newNav = parseFloat(remoteItem.nav);
          const rate = parseFloat(remoteItem.rate);
          const newBalance = (parseFloat(item.shares) * newNav).toFixed(2);
          
          // 计算当日收益
          const currentBalanceVal = parseFloat(newBalance);
          const yesterdayBalance = currentBalanceVal / (1 + rate / 100);
          const dayIncomeVal = currentBalanceVal - yesterdayBalance;

          // 【核心】生成更新数据库的 Promise
          // 只有当净值变了，或者之前没存这些字段时才更新
          const task = db.collection('assets').doc(item._id).update({
            data: {
              nav: newNav,
              balance: newBalance,
              rate: rate,
              dayIncome: dayIncomeVal.toFixed(2),
              lastUpdate: remoteItem.date
            }
          });
          updateTasks.push(task);
        }
      });

      // 第四步：等待所有更新写回数据库
      if (updateTasks.length > 0) {
        await Promise.all(updateTasks); // 等所有都存好
        wx.showToast({ title: '收益已更新', icon: 'success' });
        this.loadData(); // 重新拉取展示
      } else {
        wx.showToast({ title: '暂无新数据', icon: 'none' });
      }

    }).catch(err => {
      console.error(err);
      wx.showToast({ title: '更新失败', icon: 'none' });
    }).finally(() => {
      wx.hideLoading();
      wx.stopPullDownRefresh();
      this.setData({ isRefreshing: false });
    });
  },

  goToDetail(e) {
    const item = e.currentTarget.dataset.item;
    const itemStr = encodeURIComponent(JSON.stringify(item));
    wx.navigateTo({ url: `/pages/detail/detail?assetStr=${itemStr}` });
  },
  
  goToAdd() {
    wx.switchTab({ url: '/pages/add/add' });
  }
})
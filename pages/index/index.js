Page({
  data: {
    totalBalance: "0.00",
    totalProfit: 0,
    rankingList: [],
    isRefreshing: false
  },

  onShow() { this.loadData(); },
  onLoad() { this.loadData(); },

  // 加载本地数据
  loadData() {
    const assetList = wx.getStorageSync('my_assets') || [];
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

    // 按余额大小排序
    const sortedList = assetList.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));

    this.setData({
      totalBalance: total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
      totalProfit: profit.toFixed(2),
      rankingList: sortedList
    });
  },

  // 下拉刷新：调用云函数更新净值
  onPullDownRefresh() {
    this.refreshNav();
  },

  refreshNav() {
    const list = wx.getStorageSync('my_assets') || [];
    const fundAssets = list.filter(item => item.type === '公募基金' && item.code);
    
    if (fundAssets.length === 0) {
      wx.showToast({ title: '无基金可更新', icon: 'none' });
      wx.stopPullDownRefresh();
      return;
    }

    wx.showLoading({ title: '正在算账...' }); // 改个有趣的提示
    const codes = fundAssets.map(item => item.code);

    wx.cloud.callFunction({
      name: 'getFundData',
      data: { codes: codes }
    }).then(res => {
      const cloudData = res.result.data || [];
      let hasChange = false;
      
      const newList = list.map(item => {
        const remoteItem = cloudData.find(c => c.code === item.code);
        if (remoteItem && !remoteItem.error) {
          hasChange = true;
          const newNav = parseFloat(remoteItem.nav);    // 最新净值
          const rate = parseFloat(remoteItem.rate);     // 日涨跌幅 (例如 1.25)
          
          // 1. 重新计算总余额
          const newBalance = (parseFloat(item.shares) * newNav).toFixed(2);
          
          // 2. 计算【当日收益金额】
          // 逻辑：昨日市值 = 当前市值 / (1 + 涨跌幅%)
          // 当日收益 = 当前市值 - 昨日市值
          // 简便算法：当前余额 * (涨跌幅 / (100 + 涨跌幅))
          // 或者如果后端返回了dwjz(昨日净值)，直接 (newNav - oldNav) * shares 更准。
          // 这里使用估算公式： 当日收益 = (本金+累计收益) * 涨跌幅% (近似值)
          // 最准公式：当日收益 = 持有金额 - (持有金额 / (1 + rate/100))
          const currentBalanceVal = parseFloat(newBalance);
          const yesterdayBalance = currentBalanceVal / (1 + rate / 100);
          const dayIncomeVal = currentBalanceVal - yesterdayBalance;

          return {
            ...item,
            nav: newNav,
            balance: newBalance,
            rate: rate, // 保存涨跌幅
            dayIncome: dayIncomeVal.toFixed(2), // 保存当日具体赚了多少钱
            lastUpdate: remoteItem.date
          };
        }
        return item;
      });

      if (hasChange) {
        wx.setStorageSync('my_assets', newList);
        this.loadData();
        wx.showToast({ title: '收益已更新', icon: 'success' });
      }
    }).catch(err => {
      console.error(err);
      wx.showToast({ title: '更新失败', icon: 'none' });
    }).finally(() => {
      wx.hideLoading();
      wx.stopPullDownRefresh();
    });
  },
  // 跳转详情页
  goToDetail(e) {
    const item = e.currentTarget.dataset.item;
    // 把对象转成字符串传过去
    const itemStr = encodeURIComponent(JSON.stringify(item));
    wx.navigateTo({
      url: `/pages/detail/detail?assetStr=${itemStr}`,
    });
  },
  goToAdd() { wx.switchTab({ url: '/pages/add/add' }); }
  
})

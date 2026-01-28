Page({
  data: {
    types: ['银行存款', '公募基金', '定期理财', '股票/ETF'],
    typeIndex: 0,
    name: '', code: '', principal: '', shares: '', nav: '', balance: '', annualRate: ''
  },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onCodeInput(e) { this.setData({ code: e.detail.value }) },
  onPrincipalInput(e) { this.setData({ principal: e.detail.value }) },
  onShareInput(e) { this.setData({ shares: e.detail.value }) },
  onNavInput(e) { this.setData({ nav: e.detail.value }) },
  onBalanceInput(e) { this.setData({ balance: e.detail.value }) },
  onRateInput(e) { this.setData({ annualRate: e.detail.value }) },
  onTypeChange(e) { this.setData({ typeIndex: e.detail.value }) },

  saveAsset() {
    if (!this.data.name) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }

    const type = this.data.types[this.data.typeIndex];
    let currentBalance = 0;

    if (type === '银行存款') {
      currentBalance = parseFloat(this.data.balance) || parseFloat(this.data.principal) || 0;
    } else {
      const s = parseFloat(this.data.shares) || 0;
      const n = parseFloat(this.data.nav) || 0;
      currentBalance = s * n;
    }
    
    const newAsset = {
      id: Date.now(),
      name: this.data.name,
      type: type,
      code: this.data.code || '', // 保存代码
      principal: parseFloat(this.data.principal) || 0,
      shares: parseFloat(this.data.shares) || 0, 
      nav: parseFloat(this.data.nav) || 0,
      balance: currentBalance.toFixed(2),
      dayIncome: 0,
      annualRate: this.data.annualRate || 0
    };

    let assetList = wx.getStorageSync('my_assets') || [];
    assetList.unshift(newAsset);
    wx.setStorageSync('my_assets', assetList);

    wx.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/index/index',
        success: function (e) {
            var page = getCurrentPages().pop();
            if (page) page.onLoad();
        }
      });
    }, 1500);
  }
})
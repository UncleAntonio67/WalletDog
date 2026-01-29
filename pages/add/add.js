// pages/add/add.js
const db = wx.cloud.database()
const app = getApp();

// 日期格式化工具
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
};

Page({
  data: {
    types: ['银行存款', '公募基金', '股票/ETF', '定期理财'],
    typeIndex: 1, 
    
    buyDate: formatDate(new Date()),
    amount: '', 
    bankName: '',
    depositTerm: '', 
    annualRate: '',

    code: '',
    name: '',
    nav: '',    
    shares: '', 
    
    historyData: [], 
    latestNav: '',   
    
    isEditMode: false, 
    isAutoFilling: false,
    
    // 【修改点】初始化 buyDate 和 maxDate 都为今天
    buyDate: formatDate(new Date()), 
    maxDate: formatDate(new Date()), // ✨ 新增这一行，用来限制 Picker 的终点
  },

  onShow() {
    if (app.globalData.tempAsset) {
      const data = app.globalData.tempAsset;
      const typeIndex = this.data.types.indexOf(data.type);
      
      this.setData({
        name: data.name,
        code: data.code,
        typeIndex: typeIndex >= 0 ? typeIndex : 1,
        isEditMode: true
      });
      
      if (data.code) {
        this.queryAssetInfo(data.code);
      }
      
      app.globalData.tempAsset = null;
    }
  },

  onTypeChange(e) { this.setData({ typeIndex: e.detail.value }) },
  
  onDateChange(e) { 
    this.setData({ buyDate: e.detail.value });
    if (this.data.code && this.data.historyData.length > 0) {
      this.matchNavByDate(e.detail.value);
    }
  },
  
  onBankNameInput(e) { this.setData({ bankName: e.detail.value }) },
  onTermInput(e) { this.setData({ depositTerm: e.detail.value }) },
  onRateInput(e) { this.setData({ annualRate: e.detail.value }) },

  onCodeInput(e) { this.setData({ code: e.detail.value }) },
  
  onCodeBlur() {
    if (this.data.code && this.data.code.length >= 6) {
      this.queryAssetInfo(this.data.code);
    }
  },

  onAmountInput(e) { 
    this.setData({ amount: e.detail.value });
    this.calcShares(); 
  },
  
  onNavInput(e) {
    this.setData({ nav: e.detail.value });
    this.calcShares(); 
  },

  queryAssetInfo(code) {
    const type = this.data.types[this.data.typeIndex];
    if (type === '银行存款') return;

    this.setData({ isAutoFilling: true });
    
    const p1 = wx.cloud.callFunction({
      name: 'getFundData',
      data: { codes: [code] }
    });

    const p2 = wx.cloud.callFunction({
      name: 'getFundData',
      data: { type: 'history', codes: [code] }
    });

    Promise.all([p1, p2]).then(results => {
      const detailRes = results[0].result.data[0];
      const historyRes = results[1].result.data.history || [];

      if (detailRes && !detailRes.error) {
        this.setData({
          name: detailRes.name,
          latestNav: detailRes.nav, 
          historyData: historyRes   
        });
        
        this.matchNavByDate(this.data.buyDate);
        wx.showToast({ title: '行情已获取', icon: 'none' });
      } else {
         wx.showToast({ title: '未搜到代码，请手动填写', icon: 'none' });
      }
    }).catch(err => {
      console.error(err);
      wx.showToast({ title: '查询超时', icon: 'none' });
    }).finally(() => {
      this.setData({ isAutoFilling: false });
    });
  },

  matchNavByDate(targetDateStr) {
    const history = this.data.historyData;
    const todayStr = formatDate(new Date());

    if (targetDateStr >= todayStr && this.data.latestNav) {
      this.setData({ nav: this.data.latestNav });
      this.calcShares();
      return;
    }

    const targetTs = new Date(targetDateStr.replace(/-/g, '/')).getTime();
    let foundNav = null;

    for (let i = history.length - 1; i >= 0; i--) {
      const item = history[i];
      if (item.timestamp <= targetTs) {
        foundNav = item.value;
        break; 
      }
    }

    if (foundNav) {
      this.setData({ nav: foundNav });
    } else {
      wx.showToast({ title: '未找到当日净值，请手动填写', icon: 'none' });
    }
    
    this.calcShares();
  },

  calcShares() {
    const amount = parseFloat(this.data.amount);
    const nav = parseFloat(this.data.nav);
    if (amount > 0 && nav > 0) {
      const shares = (amount / nav).toFixed(2);
      this.setData({ shares: shares });
    }
  },

  // =========================
  // 提交保存 (已修复 this 指向问题)
  // =========================
  saveAsset() {
    const type = this.data.types[this.data.typeIndex];
    
    // 校验逻辑
    if (type === '银行存款') {
      if (!this.data.bankName) return wx.showToast({ title: '请填写银行', icon: 'none' });
    } else {
      if (!this.data.code) return wx.showToast({ title: '请填写代码', icon: 'none' });
      if (!this.data.nav) return wx.showToast({ title: '缺少净值信息', icon: 'none' });
    }
    
    if (!this.data.amount) return wx.showToast({ title: '请填写金额', icon: 'none' });

    wx.showLoading({ title: '正在记账...' });

    let newData = {
      type: type,
      buyDate: this.data.buyDate,
      createTime: db.serverDate(),
      balance: parseFloat(this.data.amount).toFixed(2),
    };

    if (type === '银行存款') {
      newData.name = this.data.bankName;
      newData.principal = parseFloat(this.data.amount);
      newData.depositTerm = this.data.depositTerm;
      newData.annualRate = this.data.annualRate || 0;
      newData.shares = 0;
    } else {
      newData.code = String(this.data.code).trim();
      newData.name = this.data.name || '未知资产';
      newData.principal = parseFloat(this.data.amount);
      newData.nav = parseFloat(this.data.nav);
      newData.shares = parseFloat(this.data.shares);
      newData.dayIncome = 0;
      newData.rate = 0;
    }
    
    // 【修复点】注意看这里的 .then 写法变化
    if (type !== '银行存款' && newData.code) {
       db.collection('assets').where({ code: newData.code }).get().then(res => {
         if (res.data.length > 0) {
           const old = res.data[0];
           const newShares = parseFloat(old.shares) + newData.shares;
           const newPrincipal = parseFloat(old.principal) + newData.principal;
           
           db.collection('assets').doc(old._id).update({
             data: {
               shares: newShares,
               principal: newPrincipal,
             }
           }).then(() => this.finishSave()); // ✅ 修复：使用箭头函数
         } else {
           db.collection('assets').add({ data: newData }).then(() => this.finishSave()); // ✅ 修复
         }
       })
    } else {
      db.collection('assets').add({ data: newData }).then(() => this.finishSave()); // ✅ 修复
    }
  },

  finishSave() {
    wx.hideLoading();
    wx.showToast({ title: '记账成功', icon: 'success' });
    this.setData({
      amount: '', code: '', name: '', nav: '', shares: '', bankName: '', depositTerm: '', annualRate: ''
    });
    setTimeout(() => {
      wx.switchTab({ url: '/pages/index/index' });
    }, 1500);
  }
})
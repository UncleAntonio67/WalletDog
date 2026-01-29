// pages/add/add.js
const db = wx.cloud.database()
const app = getApp();

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
};

Page({
  data: {
    actions: [
      { id: 'buy', name: '买入 / 存入' },
      { id: 'sell', name: '卖出 / 赎回' }
    ],
    action: 'buy', 

    types: ['公募基金', '银行存款', '股票/ETF', '定期理财'],
    typeIndex: 0,
    
    channels: [
      '支付宝', '微信理财通', '天天基金', 
      '工商银行', '建设银行', '农业银行', '中国银行', '招商银行', 
      '华泰证券', '中信证券', '其他 / 自定义'
    ],
    channelIndex: 0,
    customChannel: '',

    buyDate: formatDate(new Date()),
    maxDate: formatDate(new Date()),
    
    amount: '', 
    
    // ✨✨✨ 费率自动化相关 ✨✨✨
    fee: '',        
    feeRate: 0.15,  // 当前使用的费率%
    feeTip: '',     // 费率提示文案 (如：已按C类0费率计算)
    rateOptions: [0, 0.1, 0.12, 0.15, 0.5, 1.5], // 常用选项备用

    remark: '', 

    bankName: '',
    depositTerm: '', 
    annualRate: '',

    code: '',
    name: '',
    nav: '',    
    shares: '', 
    
    allAssets: [],
    currentTypeAssets: [],
    pickerRange: [],
    myAssetIndex: -1,
    
    historyData: [],
    latestNav: '',
    isEditMode: false,
    isAutoFilling: false
  },

  onShow() {
    if (app.globalData.tempAsset) {
      const data = app.globalData.tempAsset;
      const typeIndex = this.data.types.indexOf(data.type);
      
      this.setData({
        name: data.name,
        code: data.code,
        typeIndex: typeIndex >= 0 ? typeIndex : 0,
        isEditMode: true
      });

      if (data.type === '银行存款') {
        this.setData({ action: 'buy' });
      }

      if (data.code) this.queryAssetInfo(data.code);
      app.globalData.tempAsset = null;
    }
    this.loadMyAssets();
  },

  loadMyAssets() {
    db.collection('assets').field({ name: true, code: true, type: true, nav: true }).get()
      .then(res => {
         this.setData({ allAssets: res.data });
         this.updatePickerList();
      });
  },

  updatePickerList() {
    const currentType = this.data.types[this.data.typeIndex];
    const list = this.data.allAssets.filter(item => item.type === currentType);
    const range = list.map(item => `${item.name} (${item.code})`);
    this.setData({ currentTypeAssets: list, pickerRange: range });
  },

  onQuickSelect(e) {
    const index = parseInt(e.detail.value);
    const asset = this.data.currentTypeAssets[index];
    if (asset) {
      this.setData({ code: asset.code, name: asset.name, nav: '', myAssetIndex: index });
      this.queryAssetInfo(asset.code);
    }
  },

  onActionChange(e) { 
    if (this.data.types[this.data.typeIndex] === '银行存款') return;
    const action = e.currentTarget.dataset.val;
    
    // 切换买卖时，重置费率逻辑
    // 卖出时无法自动获取赎回费（因为与持有时间有关），默认给个 0.5% 提示用户
    let newRate = action === 'buy' ? 0.15 : 0.5;
    let tip = action === 'buy' ? '默认一折费率' : '预估赎回费(7天-1年)';
    
    this.setData({ action, feeRate: newRate, feeTip: tip });
    this.autoCalcFee(); 
  },
  
  onTypeChange(e) { 
    const index = parseInt(e.detail.value);
    this.setData({ typeIndex: index, code: '', name: '', myAssetIndex: -1 });

    if (this.data.types[index] === '银行存款') {
      this.setData({ action: 'buy' });
    }
    this.updatePickerList();
  },
  
  onChannelChange(e) { this.setData({ channelIndex: e.detail.value }) },
  onCustomChannelInput(e) { this.setData({ customChannel: e.detail.value }) },
  
  onDateChange(e) { 
    this.setData({ buyDate: e.detail.value });
    if (this.data.code && this.data.historyData.length > 0) this.matchNavByDate(e.detail.value);
  },
  
  onBankNameInput(e) { this.setData({ bankName: e.detail.value }) },
  onTermInput(e) { this.setData({ depositTerm: e.detail.value }) },
  onRateInput(e) { this.setData({ annualRate: e.detail.value }) },

  onCodeInput(e) { this.setData({ code: e.detail.value }) },
  onCodeBlur() {
    if (this.data.code && this.data.code.length >= 6) this.queryAssetInfo(this.data.code);
  },
  onNavInput(e) { 
    this.setData({ nav: e.detail.value });
    this.calcShares();
  },

  onAmountInput(e) { 
    this.setData({ amount: e.detail.value });
    this.autoCalcFee();
  },

  onRateSelect(e) {
    const rate = parseFloat(e.currentTarget.dataset.rate);
    this.setData({ feeRate: rate, feeTip: '手动选择' });
    this.autoCalcFee();
  },

  onFeeInput(e) { 
    this.setData({ fee: e.detail.value, feeTip: '手动填写' });
    this.calcShares(); 
  },

  onRemarkInput(e) { this.setData({ remark: e.detail.value }) },

  // ✨✨✨ 核心：查询资产信息 + 自动匹配费率 ✨✨✨
  queryAssetInfo(code) {
    const type = this.data.types[this.data.typeIndex];
    if (type === '银行存款') return;
    this.setData({ isAutoFilling: true });
    
    const p1 = wx.cloud.callFunction({ name: 'getFundData', data: { codes: [code] } });
    const p2 = wx.cloud.callFunction({ name: 'getFundData', data: { type: 'history', codes: [code] } });

    Promise.all([p1, p2]).then(results => {
      const detailRes = results[0].result.data[0];
      const historyRes = results[1].result.data.history || [];

      if (detailRes && !detailRes.error) {
        
        // --- 🤖 费率智能分析开始 ---
        let smartRate = 0.15; // 默认A类基金1折
        let smartTip = '自动匹配: A类/标准 (0.15%)';
        
        // 1. 如果是 C 类基金（名称或代码含C），申购费通常为 0
        if (detailRes.name.toUpperCase().indexOf('C') > -1) {
          smartRate = 0;
          smartTip = '自动匹配: C类/免申购费';
        } 
        // 2. 如果是 ETF/股票 (假设类型判断，或代码以15/51开头)
        else if (type.includes('股票') || code.startsWith('15') || code.startsWith('51')) {
          smartRate = 0.03; // 券商常见佣金万三
          smartTip = '自动匹配: 股票/ETF佣金';
        }
        // 3. 如果 API 返回了明确的 buyRate (假设云函数升级了)
        else if (detailRes.buyRate) {
           smartRate = parseFloat(detailRes.buyRate);
           smartTip = '数据来源: 基金档案';
        }

        this.setData({
          name: detailRes.name,
          latestNav: detailRes.nav, 
          historyData: historyRes,
          // 更新费率
          feeRate: smartRate,
          feeTip: smartTip
        });
        
        this.matchNavByDate(this.data.buyDate);
        this.autoCalcFee(); // 立即重算一次（防止先输金额后输代码）

        wx.showToast({ title: '信息已获取', icon: 'none' });
      } else {
         wx.showToast({ title: '未搜到代码', icon: 'none' });
      }
    }).catch(err => { console.error(err); wx.showToast({ title: '查询超时', icon: 'none' }); })
      .finally(() => { this.setData({ isAutoFilling: false }); });
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
      if (history[i].timestamp <= targetTs) {
        foundNav = history[i].value;
        break; 
      }
    }
    if (foundNav) this.setData({ nav: foundNav });
    this.calcShares();
  },

  // 🧮 自动计算
  autoCalcFee() {
    const amount = parseFloat(this.data.amount);
    const rate = this.data.feeRate;
    
    if (amount > 0) {
      // 费率计算：金额 * 费率%
      const feeVal = (amount * rate / 100).toFixed(2);
      this.setData({ fee: feeVal });
    } else {
      this.setData({ fee: '' });
    }
    this.calcShares(); 
  },

  // 计算份额
  calcShares() {
    let amount = parseFloat(this.data.amount) || 0;
    const nav = parseFloat(this.data.nav) || 0;
    const fee = parseFloat(this.data.fee) || 0;
    const action = this.data.action;

    if (amount > 0 && nav > 0) {
      let netAmount = amount;
      if (action === 'buy') {
        netAmount = amount - fee; // 扣除手续费
      } 
      // 卖出时：如果输入的是“赎回金额(含税)”，那份额 = (金额+费)/净值? 
      // 简化逻辑：这里假设用户输入的是“到手金额”，或者简单的 金额/净值
      // 为了记账方便，通常大家习惯输入“卖了多少份额”或者“卖了多少钱”
      // 这里保持：卖出金额 = 份额 * 净值 (手续费单独记，不影响份额计算，只影响盈亏)
      
      if (netAmount > 0) {
        const shares = (netAmount / nav).toFixed(2);
        this.setData({ shares: shares });
      }
    }
  },

  saveAsset() {
    const { action, typeIndex, code, nav, amount, fee, bankName, channelIndex, channels, customChannel } = this.data;
    const type = this.data.types[typeIndex];
    
    let finalChannel = channels[channelIndex];
    if (finalChannel.includes('自定义')) {
      if (!customChannel) return wx.showToast({ title: '请输入渠道名称', icon: 'none' });
      finalChannel = customChannel;
    }

    if (type !== '银行存款' && !code) return wx.showToast({ title: '请填写代码', icon: 'none' });
    if (!amount) return wx.showToast({ title: '请填写金额', icon: 'none' });

    wx.showLoading({ title: '正在记账...' });

    let record = {
      type,
      action,
      channel: finalChannel, 
      buyDate: this.data.buyDate,
      createTime: db.serverDate(),
      amount: parseFloat(amount),
      fee: parseFloat(fee) || 0,
      remark: this.data.remark
    };

    if (type === '银行存款') {
      record.name = bankName || '未知银行';
      record.depositTerm = this.data.depositTerm;
      record.annualRate = this.data.annualRate;
      record.shares = 0;
      record.nav = 1;
    } else {
      record.code = String(code).trim();
      record.name = this.data.name || '未知资产';
      record.nav = parseFloat(nav);
      record.shares = parseFloat(this.data.shares);
    }

    if (type === '银行存款') {
      db.collection('assets').add({ data: { ...record, balance: record.amount, principal: record.amount } })
        .then(() => this.finishSave());
    } else {
      this.mergeAsset(record);
    }
  },

  mergeAsset(record) {
    const isBuy = record.action === 'buy';
    
    db.collection('assets').where({ code: record.code }).get().then(res => {
      if (res.data.length > 0) {
        const old = res.data[0];
        let newShares = parseFloat(old.shares);
        let newPrincipal = parseFloat(old.principal);
        
        if (isBuy) {
          newShares += record.shares;
          newPrincipal += record.amount; 
        } else {
          if (old.shares > 0) {
             const ratio = record.shares / old.shares;
             const reducedPrincipal = old.principal * ratio;
             newShares -= record.shares;
             newPrincipal -= reducedPrincipal;
          }
        }
        
        if (newShares < 0) newShares = 0;
        if (newPrincipal < 0) newPrincipal = 0;

        const newBalance = newShares * record.nav;

        db.collection('assets').doc(old._id).update({
          data: {
            shares: newShares,
            principal: newPrincipal,
            balance: newBalance.toFixed(2),
            nav: record.nav 
          }
        }).then(() => this.finishSave());

      } else {
        if (!isBuy) {
           wx.hideLoading();
           return wx.showToast({ title: '未持有该资产，无法卖出', icon: 'none' });
        }
        db.collection('assets').add({ 
          data: { 
            ...record, 
            balance: record.amount, 
            principal: record.amount 
          } 
        }).then(() => this.finishSave());
      }
    });
  },

  finishSave() {
    wx.hideLoading();
    wx.showToast({ title: this.data.action==='buy'?'记账成功':'减仓成功', icon: 'success' });
    this.setData({ 
      amount: '', code: '', name: '', nav: '', shares: '', bankName: '', depositTerm: '', annualRate: '', fee: '', remark: '', customChannel: ''
    });
    setTimeout(() => { wx.switchTab({ url: '/pages/index/index' }); }, 1500);
  }
})
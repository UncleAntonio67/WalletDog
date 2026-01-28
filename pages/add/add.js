// pages/add/add.js
const db = wx.cloud.database()
const app = getApp(); // 获取全局实例
Page({
  data: {
    // ⚠️ 关键点：这里的 types 数组必须存在，wxml 里的 range="{{types}}" 才能读到数据
    types: ['银行存款', '公募基金', '定期理财', '股票/ETF'], 
    typeIndex: 0,
    
    // 表单数据
    name: '',
    code: '',
    principal: '',
    shares: '',
    nav: '',
    balance: '',
    annualRate: '',
    isEditMode: false // 标记是否为“加仓模式”
  },

  // 监听输入
  onTypeChange(e) { this.setData({ typeIndex: e.detail.value }) },
  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onCodeInput(e) { this.setData({ code: e.detail.value }) },
  onPrincipalInput(e) { this.setData({ principal: e.detail.value }) },
  onShareInput(e) { this.setData({ shares: e.detail.value }) },
  onNavInput(e) { this.setData({ nav: e.detail.value }) },
  onBalanceInput(e) { this.setData({ balance: e.detail.value }) },
  onRateInput(e) { this.setData({ annualRate: e.detail.value }) },

  // 每次进入页面都会触发
  onShow() {
    // 检查全局变量里有没有带过来的数据
    if (app.globalData.tempAsset) {
      const data = app.globalData.tempAsset;
      
      // 找到类型对应的 index
      const typeIndex = this.data.types.indexOf(data.type);

      this.setData({
        name: data.name,
        code: data.code,
        typeIndex: typeIndex >= 0 ? typeIndex : 1, // 默认选中对应类型
        isEditMode: true // 开启加仓模式（可以用来禁用代码输入框）
      });

      // 用完即焚，防止下次进来还是这个数据
      app.globalData.tempAsset = null;
      
      wx.showToast({ title: '已自动填入信息', icon: 'none' });
    }
  },
  // 保存数据
  saveAsset() {
    // 1. 基础校验
    if (!this.data.name) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在上传...' });

    // 2. 准备数据
    const type = this.data.types[this.data.typeIndex];
    let currentBalance = 0;

    // 根据类型计算余额
    if (type === '银行存款') {
      currentBalance = parseFloat(this.data.balance) || parseFloat(this.data.principal) || 0;
    } else {
      const s = parseFloat(this.data.shares) || 0;
      const n = parseFloat(this.data.nav) || 0;
      currentBalance = s * n;
    }
    
    // 3. 写入云数据库
    db.collection('assets').add({
      data: {
        name: this.data.name,
        type: type,
        code: this.data.code || '',
        principal: parseFloat(this.data.principal) || 0,
        shares: parseFloat(this.data.shares) || 0,
        nav: parseFloat(this.data.nav) || 0,
        balance: currentBalance.toFixed(2),
        dayIncome: 0,
        annualRate: this.data.annualRate || 0,
        createTime: db.serverDate()
      }
    }).then(res => {
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });

      // ✨ 保存后清空表单 (除了分类，防止连续录入同类资产)
      this.setData({
        name: '',
        code: '',
        principal: '',
        shares: '',
        nav: '',
        balance: '',
        annualRate: ''
        // typeIndex: 0  <-- 我把这一行注释掉了，这样保存后分类不会乱跳，体验更好
      });

      // 延迟返回
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index',
          success: function(e) {
             const page = getCurrentPages().pop();
             if (page) page.onLoad();
          }
        });
      }, 1500);

    }).catch(err => {
      wx.hideLoading();
      console.error(err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  }
})